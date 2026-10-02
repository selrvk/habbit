// src/widgetPayload.ts
//
// What the widgets, Siri and quick actions see of today (written to the App Group by
// utils/syncWidget.ts). It includes the coming days' allowances, worked out as if nothing
// more is spent today, so after midnight a widget shows the new day's figure before the
// app has been opened.

import type { Commission, CompletionRecord, DailyTotal, SpendingEntry } from './types';
import { addDaysToKey, countsToday, isRestRecord, isScheduledForDay, parseDateKey } from './helpers';
import { computeBudget, periodStart, type BudgetPeriod, type TopUp } from './budget';
import { withToday } from './monthSummary';
import { billSpending, type Bill } from './bills';
import type { WidgetData, WidgetDay, WidgetHabit } from './utils/syncWidget';

const UPCOMING_DAYS = 6;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Habits as the widgets, Siri and quick actions see them. `thisWeek` gives an "N× a week" habit's count. */
export const widgetHabits = (items: Commission[], thisWeek: (c: Commission) => number): WidgetHabit[] =>
  items.map(c => ({
    id: c.id, label: c.label, days: c.days ?? [], ...(c.perWeek ? { perWeek: c.perWeek } : {}),
    times: c.timesPerDay ?? 1, count: c.completionCount ?? 0, done: c.completed, skipped: !!c.skipped,
    week: c.perWeek ? thisWeek(c) : 0,
  }));

/**
 * This week, Monday to Sunday, for the large widget: how each day went and what was spent
 * day to day (bills aside). A day the app never saw counts as missed if Habbits were on.
 */
export const widgetWeek = (todayKey: string, commissions: Commission[], history: CompletionRecord[], days: DailyTotal[]): WidgetDay[] => {
  const byDate = new Map(history.map(r => [r.date, r]));
  const monday = periodStart('weekly', todayKey);
  return Array.from({ length: 7 }, (_, i) => {
    const date  = addDaysToKey(monday, i);
    const total = days.find(d => d.date === date);
    const spent = total ? round2(total.total - billSpending(total.entries)) : 0;
    if (date > todayKey) return { date, state: 'future', spent: 0 };
    if (date === todayKey) return { date, state: 'today', spent };
    const r = byDate.get(date);
    const state = r
      ? (isRestRecord(r) ? 'rest' : r.completed ? 'done' : 'missed')
      : (commissions.some(c => isScheduledForDay(c, parseDateKey(date).getDay())) ? 'missed' : 'rest');
    return { date, state, spent };
  });
};

export const widgetPayload = ({ todayKey, name, avatar, currency, streak, commissions, history, thisWeek, budget: b }: {
  todayKey: string;
  name: string;
  avatar: string;
  currency: string;
  streak: number;
  commissions: Commission[];
  history: CompletionRecord[];
  thisWeek: (c: Commission) => number;
  budget: {
    period: BudgetPeriod; amount: number; spentToday: number; todayHistory: SpendingEntry[];
    dailyTotals: DailyTotal[]; topUps: TopUp[]; bills: Bill[];
  };
}): WidgetData => {
  const todays = commissions.filter(c => countsToday(c, parseDateKey(todayKey).getDay()));
  const now = computeBudget({
    period: b.period, amount: b.amount, todayKey, spentToday: b.spentToday, todayHistory: b.todayHistory,
    dailyTotals: b.dailyTotals, topUps: b.topUps, bills: b.bills,
  });
  // Today becomes history; each coming day starts with nothing spent.
  const spendDays = withToday(b.dailyTotals, todayKey, b.spentToday, b.todayHistory);
  const upcoming = Array.from({ length: UPCOMING_DAYS }, (_, i) => {
    const date = addDaysToKey(todayKey, i + 1);
    const s = computeBudget({ period: b.period, amount: b.amount, todayKey: date, spentToday: 0, todayHistory: [], dailyTotals: spendDays, topUps: b.topUps, bills: b.bills });
    return { date, allowance: round2(s.dailyAllowance), periodLeft: round2(s.periodLeft) };
  });

  return {
    name, avatar, currency, streak,
    date: todayKey,
    scheduledByDow: [0, 1, 2, 3, 4, 5, 6].map(dow => commissions.filter(c => isScheduledForDay(c, dow)).length),
    completedCount: todays.filter(c => c.completed).length,
    totalCount: todays.length,
    upcomingHabbit: todays.find(c => !c.completed)?.label ?? '',
    spentToday: now.spentToday,
    allocatedPerDay: now.dailyAllowance,
    budgetPeriod: b.period,
    periodLeft: round2(now.periodLeft),
    upcoming,
    habits: widgetHabits(commissions, thisWeek),
    week: widgetWeek(todayKey, commissions, history, spendDays),
  };
};
