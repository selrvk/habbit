// src/weekSummary.ts
//
// The Sunday recap: a week's habits (Monday to Sunday), money against the budget, the
// best day, and one tip worked out from the numbers. While the week is still going (the
// recap opens on Sunday evening), today counts once it's done and is never held against it.

import type { Commission, CompletionRecord, DailyTotal, SpendingEntry } from './types';
import { addDaysToKey, isRestRecord, isScheduledForDay, parseDateKey } from './helpers';
import { computeBudget, periodStart, type BudgetPeriod, type TopUp } from './budget';
import { categoryOf, spendingByCategory, type CategoryTotal } from './categories';
import { billSpending, type Bill } from './bills';
import { monthLabel, withToday } from './monthSummary';
import { allJarEntries, type Savings } from './savings';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type HabitLine = { id: string; label: string; done: number; of: number };

export type WeekSummary = {
  /** Monday. */
  start: string;
  /** Sunday, or today while the week is going. */
  end: string;
  inProgress: boolean;
  /** "Sep 22 – 28", "Sep 29 – Oct 5". */
  label: string;
  habits: {
    /** Days with every habit done, out of days that had habits on (rest days aside). */
    perfectDays: number;
    trackedDays: number;
    /** Check-offs, "N× a week" habits included. */
    done: number;
    best: HabitLine | null;
    slipped: (HabitLine & { missed: number }) | null;
    weekly: { label: string; done: number; target: number }[];
    /** Set when weekends went clearly worse than weekdays (shares of habits done, 0–1). */
    weekendDip: { weekday: number; weekend: number } | null;
  };
  money: {
    spent: number;
    /** The week before (the same days of it, while this one is going); null if nothing was logged. */
    prevSpent: number | null;
    budget:
      | { kind: 'weekly'; budget: number; left: number }
      | { kind: 'monthly'; left: number; monthName: string }
      | { kind: 'daily'; daysUnder: number; days: number }
      | null;
    topCategory: CategoryTotal | null;
    biggest: (SpendingEntry & { date: string }) | null;
    saved: number;
  };
  bestDay: { date: string; done: number; of: number; spent: number } | null;
};

export type WeekData = {
  todayKey: string;
  commissions: Commission[];
  history: CompletionRecord[];
  dailyTotals: DailyTotal[];
  todayHistory: SpendingEntry[];
  spentToday: number;
  topUps: TopUp[];
  bills: Bill[];
  savings: Savings;
  budgetPeriod: BudgetPeriod;
  budgetAmount: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const share  = (done: number, of: number) => (of > 0 ? done / of : 0);

/** "Sep 22 – 28" or "Sep 29 – Oct 5". */
export const weekLabel = (start: string) => {
  const a = parseDateKey(start);
  const b = parseDateKey(addDaysToKey(start, 6));
  return a.getMonth() === b.getMonth()
    ? `${MONTHS[a.getMonth()]} ${a.getDate()} – ${b.getDate()}`
    : `${MONTHS[a.getMonth()]} ${a.getDate()} – ${MONTHS[b.getMonth()]} ${b.getDate()}`;
};

/** Today's habits as a record, the way the day will be recorded at midnight (dayRollover). */
export const liveRecord = (commissions: Commission[], dayKey: string): CompletionRecord => {
  const dow       = parseDateKey(dayKey).getDay();
  const scheduled = commissions.filter(c => isScheduledForDay(c, dow));
  const counted   = scheduled.filter(c => !c.skipped);
  const skipped   = scheduled.filter(c => c.skipped).map(c => c.id);
  return {
    date: dayKey,
    completed:    counted.length > 0 && counted.every(c => c.completed),
    completedIds: [...scheduled, ...commissions.filter(c => c.perWeek)].filter(c => c.completed).map(c => c.id),
    scheduledIds: scheduled.map(c => c.id),
    ...(skipped.length > 0 ? { skippedIds: skipped } : {}),
  };
};

/** The week's records, oldest first, with today's live state. Days the app never saw are left out. */
const recordsFor = (start: string, end: string, d: WeekData): CompletionRecord[] => {
  const byDate = new Map(d.history.map(r => [r.date, r]));
  const out: CompletionRecord[] = [];
  for (let key = start; key <= end; key = addDaysToKey(key, 1)) {
    const r = key === d.todayKey ? liveRecord(d.commissions, key) : byDate.get(key);
    if (r) out.push(r);
  }
  return out;
};

/** Each scheduled habit's day: done, missed, or not yet (today, still to do). Skips don't count. */
const habitDays = (records: CompletionRecord[], todayKey: string) =>
  records.flatMap(r => r.scheduledIds
    .filter(id => !r.skippedIds?.includes(id))
    .map(id => ({ date: r.date, id, done: r.completedIds.includes(id) }))
    .filter(h => h.done || r.date !== todayKey));

/** A day that counts toward perfect days: something was on, and (today) it's finished. */
const isTracked = (r: CompletionRecord, todayKey: string) => !isRestRecord(r) && (r.date !== todayKey || r.completed);

export const weekSummary = (week: string, d: WeekData): WeekSummary => {
  const start      = periodStart('weekly', week);
  const sunday     = addDaysToKey(start, 6);
  const inProgress = d.todayKey >= start && d.todayKey <= sunday;
  const end        = inProgress ? d.todayKey : sunday;

  // ── Habits ──
  const records = recordsFor(start, end, d);
  const tracked = records.filter(r => isTracked(r, d.todayKey));
  const days    = habitDays(records, d.todayKey);
  const labels  = new Map(d.commissions.map(c => [c.id, c.label]));

  const lines = new Map<string, HabitLine>();
  for (const h of days) {
    const label = labels.get(h.id);
    if (!label) continue; // deleted since
    const line = lines.get(h.id) ?? { id: h.id, label, done: 0, of: 0 };
    line.of++; if (h.done) line.done++;
    lines.set(h.id, line);
  }
  const all  = [...lines.values()];
  const best = all.filter(l => l.of >= 2 && l.done > 0 && share(l.done, l.of) >= 0.5)
    .sort((a, b) => share(b.done, b.of) - share(a.done, a.of) || b.done - a.done)[0] ?? null;
  const slipped = all.map(l => ({ ...l, missed: l.of - l.done }))
    .filter(l => l.missed > 0 && l.id !== best?.id)
    .sort((a, b) => b.missed - a.missed || share(a.done, a.of) - share(b.done, b.of))[0] ?? null;

  const isWeekend = (date: string) => [0, 6].includes(parseDateKey(date).getDay());
  const rate = (list: typeof days) => ({ done: list.filter(h => h.done).length, of: list.length });
  const wk = rate(days.filter(h => !isWeekend(h.date)));
  const we = rate(days.filter(h => isWeekend(h.date)));
  const weekendDip = we.of >= 2 && wk.of >= 3 && share(wk.done, wk.of) - share(we.done, we.of) >= 0.3
    ? { weekday: share(wk.done, wk.of), weekend: share(we.done, we.of) }
    : null;

  // ── Money ──
  const allDays = withToday(d.dailyTotals, d.todayKey, d.spentToday, d.todayHistory);
  const daysIn  = (from: string, to: string) => allDays.filter(x => x.date >= from && x.date <= to);
  const total   = (xs: DailyTotal[]) => round2(xs.reduce((s, x) => s + x.total, 0));
  const spendDays = daysIn(start, end);
  const spent     = total(spendDays);
  const prevStart = addDaysToKey(start, -7);
  const prevDays  = daysIn(prevStart, addDaysToKey(end, -7));

  const budgetAt = (dayKey: string) => {
    const day = allDays.find(x => x.date === dayKey);
    return computeBudget({
      period: d.budgetPeriod, amount: d.budgetAmount, todayKey: dayKey, spentToday: day?.total ?? 0, todayHistory: day?.entries ?? [],
      dailyTotals: allDays.filter(x => x.date !== dayKey), topUps: d.topUps, bills: d.bills,
    });
  };
  let budget: WeekSummary['money']['budget'] = null;
  if (spent > 0 && d.budgetPeriod === 'weekly') {
    const b = budgetAt(end);
    budget = { kind: 'weekly', budget: round2(b.periodBudget), left: round2(b.periodLeft) };
  } else if (spent > 0 && d.budgetPeriod === 'monthly') {
    budget = { kind: 'monthly', left: round2(budgetAt(end).periodLeft), monthName: monthLabel(end).name };
  } else if (spent > 0) {
    // Days with something logged, measured against that day's allowance.
    const logged = spendDays.filter(x => x.total > 0);
    budget = { kind: 'daily', days: logged.length, daysUnder: logged.filter(x => budgetAt(x.date).leftToday >= 0).length };
  }

  const entries = spendDays.flatMap(x => (x.entries ?? []).map(e => ({ ...e, date: x.date })));
  // Recurring bills are left out of the top category and biggest spend, so rent doesn't always win.
  const dayToDay    = spendDays.map(x => ({ ...x, total: x.total - billSpending(x.entries), entries: x.entries?.filter(e => !e.billId) }));
  const topCategory = spendingByCategory(dayToDay, [], start, addDaysToKey(end, 1)).find(c => c.key !== 'none') ?? null;

  // ── Best day: most of its habits done, then the least spent ──
  const spentOn = (date: string) => round2((allDays.find(x => x.date === date)?.total ?? 0) - billSpending(allDays.find(x => x.date === date)?.entries));
  const bestDay = tracked.length >= 2
    ? tracked
        .map(r => ({ date: r.date, ...rate(days.filter(h => h.date === r.date)), spent: spentOn(r.date) }))
        .filter(x => x.of > 0)
        .sort((a, b) => share(b.done, b.of) - share(a.done, a.of) || a.spent - b.spent)[0] ?? null
    : null;

  return {
    start, end, inProgress, label: weekLabel(start),
    habits: {
      perfectDays: tracked.filter(r => r.completed).length,
      trackedDays: tracked.length,
      done: records.reduce((s, r) => s + r.completedIds.length, 0),
      best, slipped,
      weekly: d.commissions.filter(c => c.perWeek).map(c => ({
        label: c.label, target: c.perWeek!, done: records.filter(r => r.completedIds.includes(c.id)).length,
      })),
      weekendDip,
    },
    money: {
      spent,
      prevSpent: prevDays.length > 0 ? total(prevDays) : null,
      budget,
      topCategory,
      biggest: entries.filter(e => !e.billId).sort((a, b) => b.amount - a.amount)[0] ?? null,
      saved: round2(allJarEntries(d.savings).filter(e => e.date >= start && e.date <= end).reduce((s, e) => s + e.amount, 0)),
    },
    bestDay,
  };
};

/** One tip from the numbers, for everyone (Pro also gets Bonbon's own take). */
export const weekTip = (s: WeekSummary, commissions: Commission[]): string => {
  const { habits: h, money: m } = s;
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const category = m.topCategory ? categoryOf(m.topCategory.key)?.label.toLowerCase() : null;

  if (h.trackedDays === 0 && m.spent === 0) return 'A quiet week. Check off one Habbit tomorrow to get rolling 🐰';
  if (h.trackedDays >= 3 && h.perfectDays === h.trackedDays) return 'A perfect week 🎉 Keep the streak rolling into next week.';
  if (h.weekendDip) return `Weekends were harder: ${pct(h.weekendDip.weekend)} done, against ${pct(h.weekendDip.weekday)} on weekdays. A weekend reminder might help.`;
  if (h.slipped && h.slipped.missed >= 2) {
    const habit = commissions.find(c => c.id === h.slipped!.id);
    const hasReminder = !!habit && (habit.reminderTime !== null || habit.reminderTimes.length > 0 || habit.reminderSplit !== null);
    return hasReminder
      ? `${h.slipped.label} slipped ${h.slipped.missed} times. Try moving its reminder to a time that suits you better.`
      : `${h.slipped.label} slipped ${h.slipped.missed} times. A reminder might help: you can set one on its page.`;
  }
  if (m.budget?.kind === 'weekly' && m.budget.left < 0) {
    return category ? `You went over budget this week, and ${category} took the biggest share.` : 'You went over budget this week.';
  }
  if (m.prevSpent && m.spent > m.prevSpent * 1.25) {
    return `Spending was up ${pct((m.spent - m.prevSpent) / m.prevSpent)} on last week${category ? `, mostly on ${category}` : ''}.`;
  }
  if (m.prevSpent && m.spent < m.prevSpent * 0.85) return `You spent ${pct((m.prevSpent - m.spent) / m.prevSpent)} less than last week. Nice!`;
  return 'A steady week. Pick one Habbit to nail next week.';
};

export type WeekTrend = { start: string; spent: number; perfectDays: number; trackedDays: number };

/** The last `count` weeks up to `week`, oldest first, for the Pro trends. */
export const weekTrend = (week: string, d: WeekData, count = 8): WeekTrend[] => {
  const last    = periodStart('weekly', week);
  const allDays = withToday(d.dailyTotals, d.todayKey, d.spentToday, d.todayHistory);
  return Array.from({ length: count }, (_, i) => {
    const start = addDaysToKey(last, -7 * (count - 1 - i));
    const end   = addDaysToKey(start, 6) < d.todayKey ? addDaysToKey(start, 6) : d.todayKey;
    const tracked = recordsFor(start, end, d).filter(r => isTracked(r, d.todayKey));
    return {
      start,
      spent: round2(allDays.filter(x => x.date >= start && x.date <= end).reduce((s, x) => s + x.total, 0)),
      perfectDays: tracked.filter(r => r.completed).length,
      trackedDays: tracked.length,
    };
  });
};

/** The week to open: this one on Sunday (it's wrapping up), otherwise last week. */
export const recapWeek = (todayKey: string) =>
  parseDateKey(todayKey).getDay() === 0 ? periodStart('weekly', todayKey) : addDaysToKey(periodStart('weekly', todayKey), -7);
