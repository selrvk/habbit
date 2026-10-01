// src/dayRollover.ts
//
// Pure "a new day started" logic, shared by app launch and app resume.

import type { Commission, CompletionRecord, DailyTotal, FinanceData, Stats } from './types';
import { addDaysToKey, isScheduledForDay, parseDateKey } from './helpers';

const FINANCE_HISTORY_DAYS    = 62; // enough to cover a monthly budget period
const COMPLETION_HISTORY_DAYS = 60;

/**
 * True when no habit was scheduled on any day strictly between `fromKey` and `toKey`.
 * Rest days (nothing scheduled) must not break a streak.
 */
export const onlyRestDaysBetween = (fromKey: string, toKey: string, commissions: Commission[]): boolean => {
  let key = addDaysToKey(fromKey, 1);
  // The schedule is weekly, so checking at most 7 days covers every weekday.
  for (let i = 0; i < 7 && key < toKey; i++, key = addDaysToKey(key, 1)) {
    const dow = parseDateKey(key).getDay();
    if (commissions.some(c => isScheduledForDay(c, dow))) return false;
  }
  return true;
};

/** Whether completing all of today's habits continues the current streak (vs. starting at 1). */
export const streakContinues = (stats: Stats, todayKey: string, commissions: Commission[]): boolean =>
  !!stats.lastFullDate && stats.currentStreak > 0 && onlyRestDaysBetween(stats.lastFullDate, todayKey, commissions);

export const rolloverFinance = (
  finance: FinanceData,
  dailyTotals: DailyTotal[],
  todayKey: string,
): { finance: FinanceData; dailyTotals: DailyTotal[]; changed: boolean } => {
  if (finance.date === todayKey) return { finance, dailyTotals, changed: false };
  const totals = finance.spentToday > 0
    ? [...dailyTotals.filter(t => t.date !== finance.date), { date: finance.date, total: finance.spentToday, entries: finance.history ?? [] }]
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-FINANCE_HISTORY_DAYS)
    : dailyTotals;
  return { finance: { spentToday: 0, date: todayKey, history: [] }, dailyTotals: totals, changed: true };
};

export const rolloverHabits = (
  prev: { date: string; commissions: Commission[]; stats: Stats; history: CompletionRecord[] },
  todayKey: string,
): { commissions: Commission[]; stats: Stats; history: CompletionRecord[]; changed: boolean } => {
  const { date, commissions } = prev;
  if (date === todayKey) return { commissions, stats: prev.stats, history: prev.history, changed: false };

  // Record the final state of the previous day. Replaces any record written earlier that
  // day, so un-completing a habit after "all done" is reflected accurately.
  const dow       = parseDateKey(date).getDay();
  const scheduled = commissions.filter(c => isScheduledForDay(c, dow));
  let history     = prev.history.filter(r => r.date !== date);
  if (scheduled.length > 0) {
    history = [...history, {
      date,
      completed:    scheduled.every(c => c.completed),
      completedIds: scheduled.filter(c => c.completed).map(c => c.id),
      scheduledIds: scheduled.map(c => c.id),
    }].sort((a, b) => a.date.localeCompare(b.date)).slice(-COMPLETION_HISTORY_DAYS);
  } else if (history.length === prev.history.length) {
    history = prev.history;
  }

  // Streak increments happen live when the last habit is completed; here we only break it.
  // totalCompleted is also counted live, so it is not touched here.
  const kept  = { ...prev.stats, beforeToday: undefined };
  const stats = streakContinues(prev.stats, todayKey, commissions) ? kept : { ...kept, currentStreak: 0 };

  return {
    commissions: commissions.map(c => ({ ...c, completed: false, completionCount: 0 })),
    stats,
    history,
    changed: true,
  };
};
