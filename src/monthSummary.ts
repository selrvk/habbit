// src/monthSummary.ts
//
// A month's recap: spending against the month before, the budget's result, categories,
// biggest spends, money added and saved, and perfect habit days. For the month in progress,
// comparisons use the same stretch of the month before ("so far" vs "this time last month").
// Bills are left out of biggest spends and the busiest day so rent doesn't always top them.

import type { CompletionRecord, DailyTotal, SpendingEntry } from './types';
import { addDaysToKey, isRestRecord, parseDateKey, toDateKey } from './helpers';
import { computeBudget, periodEnd, periodStart, type BudgetPeriod, type TopUp } from './budget';
import { spendingByCategory, type CategoryTotal } from './categories';
import { billSpending, type Bill } from './bills';
import type { Savings } from './savings';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export type MonthSummary = {
  /** First day of the month, e.g. "2026-09-01". */
  start: string;
  /** Last day included: the month's end, or today for the month in progress. */
  end: string;
  inProgress: boolean;
  /** "September 2026". */
  label: string;
  /** "September". */
  name: string;
  spent: number;
  /** Same stretch of the month before; null when nothing was logged then. */
  prevSpent: number | null;
  prevName: string;
  avgPerDay: number;
  billsPaid: number;
  added: number;
  saved: number;
  byCategory: (CategoryTotal & { prev: number })[];
  topExpenses: (SpendingEntry & { date: string })[];
  busiestDay: { date: string; total: number } | null;
  budget:
    | { kind: 'monthly' | 'daily'; budget: number; left: number }
    | { kind: 'weekly'; weeksUnder: number; weeks: number }
    | null;
  habits: { perfectDays: number; trackedDays: number };
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const daysInclusive = (from: string, to: string) =>
  Math.round((parseDateKey(to).getTime() - parseDateKey(from).getTime()) / 86_400_000) + 1;

/** "2026-09-01" for any day in September 2026, shifted by `by` months. */
export const monthStart = (dayKey: string, by = 0): string => {
  const d = parseDateKey(dayKey);
  return toDateKey(new Date(d.getFullYear(), d.getMonth() + by, 1));
};

export const monthLabel = (start: string) => {
  const d = parseDateKey(start);
  return { name: MONTHS[d.getMonth()], label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` };
};

export const monthSummary = ({ month, todayKey, dailyTotals, todayHistory, spentToday, topUps, bills, savings, history, budgetPeriod, budgetAmount }: {
  /** Any day in the month. */
  month: string;
  todayKey: string;
  dailyTotals: DailyTotal[];
  todayHistory: SpendingEntry[];
  spentToday: number;
  topUps: TopUp[];
  bills: Bill[];
  savings: Savings;
  history: CompletionRecord[];
  budgetPeriod: BudgetPeriod;
  budgetAmount: number;
}): MonthSummary => {
  const start      = monthStart(month);
  const monthEnd   = periodEnd('monthly', start);
  const inProgress = todayKey <= monthEnd && todayKey >= start;
  const end        = inProgress ? todayKey : monthEnd;

  // Today lives outside dailyTotals until midnight.
  const allDays: DailyTotal[] = [
    ...dailyTotals.filter(d => d.date !== todayKey),
    ...(spentToday > 0 ? [{ date: todayKey, total: spentToday, entries: todayHistory }] : []),
  ];
  const daysIn = (from: string, to: string) => allDays.filter(d => d.date >= from && d.date <= to);
  const total  = (days: DailyTotal[]) => round2(days.reduce((s, d) => s + d.total, 0));

  // The month before, cut to the same length while this month is still going.
  const prevStart = monthStart(start, -1);
  const prevEnd   = inProgress
    ? [addDaysToKey(prevStart, daysInclusive(start, end) - 1), periodEnd('monthly', prevStart)].sort()[0]
    : periodEnd('monthly', prevStart);

  const days     = daysIn(start, end);
  const prevDays = daysIn(prevStart, prevEnd);
  const spent    = total(days);
  const entries  = days.flatMap(d => (d.entries ?? []).map(e => ({ ...e, date: d.date })));

  // Categories, with last month's (same stretch) total for each.
  const categoriesFor = (ds: DailyTotal[], from: string, to: string) => spendingByCategory(ds, [], from, addDaysToKey(to, 1));
  const prevByKey  = new Map(categoriesFor(prevDays, prevStart, prevEnd).map(c => [c.key, c.total]));
  const byCategory = categoriesFor(days, start, end).map(c => ({ ...c, prev: prevByKey.get(c.key) ?? 0 }));

  const dayToDay = days.map(d => ({ date: d.date, total: round2(d.total - billSpending(d.entries)) })).filter(d => d.total > 0);
  const busiestDay = dayToDay.sort((a, b) => b.total - a.total)[0] ?? null;

  const inMonth = (date: string) => date >= start && date <= end;

  // How the budget went, measured with the budget as it's set now.
  let budget: MonthSummary['budget'] = null;
  const budgetAt = (dayKey: string) => {
    const day = allDays.find(d => d.date === dayKey);
    return computeBudget({
      period: budgetPeriod, amount: budgetAmount, todayKey: dayKey, spentToday: day?.total ?? 0, todayHistory: day?.entries ?? [],
      dailyTotals: allDays.filter(d => d.date !== dayKey), topUps, bills,
    });
  };
  if (spent > 0 && budgetPeriod === 'monthly') {
    const b = budgetAt(end);
    budget = { kind: 'monthly', budget: round2(b.periodBudget), left: round2(b.periodLeft) };
  } else if (spent > 0 && budgetPeriod === 'daily') {
    // Each day's allowance, over the days with something logged (bills aren't counted on daily budgets).
    const tracked = days.map(d => budgetAt(d.date));
    budget = {
      kind: 'daily',
      budget: round2(tracked.reduce((s, b) => s + b.dailyAllowance, 0)),
      left:   round2(tracked.reduce((s, b) => s + b.leftToday, 0)),
    };
  } else if (spent > 0) {
    // Weeks that ended this month (on a Sunday), with spending logged.
    const sundays: string[] = [];
    for (let key = periodEnd('weekly', start); key <= end; key = addDaysToKey(key, 7)) {
      if (daysIn(periodStart('weekly', key), key).length > 0) sundays.push(key);
    }
    budget = { kind: 'weekly', weeks: sundays.length, weeksUnder: sundays.filter(k => budgetAt(k).periodLeft >= 0).length };
  }

  const records = history.filter(r => inMonth(r.date) && !isRestRecord(r));
  const { name, label } = monthLabel(start);

  return {
    start, end, inProgress, label, name,
    spent,
    prevSpent: prevDays.length > 0 ? total(prevDays) : null,
    prevName: monthLabel(prevStart).name,
    avgPerDay: round2(spent / daysInclusive(start, end)),
    billsPaid: round2(days.reduce((s, d) => s + billSpending(d.entries), 0)),
    added: round2(topUps.filter(t => inMonth(t.date)).reduce((s, t) => s + t.amount, 0)),
    saved: round2(savings.entries.filter(e => inMonth(e.date)).reduce((s, e) => s + e.amount, 0)),
    byCategory,
    topExpenses: entries.filter(e => !e.billId).sort((a, b) => b.amount - a.amount).slice(0, 5),
    busiestDay,
    budget,
    habits: { perfectDays: records.filter(r => r.completed).length, trackedDays: records.length },
  };
};

/** The first month with any spending or habit history, for the month picker. */
export const firstMonth = (dailyTotals: DailyTotal[], history: CompletionRecord[], todayKey: string): string => {
  const earliest = [dailyTotals[0]?.date, history[0]?.date, todayKey].filter(Boolean).sort()[0]!;
  return monthStart(earliest);
};
