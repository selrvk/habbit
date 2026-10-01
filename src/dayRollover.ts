// src/dayRollover.ts
//
// Pure "a new day started" logic, shared by app launch and app resume.
// History is kept in full (it is small) for stats and backups.

import type { Commission, CompletionRecord, DailyTotal, FinanceData, SpendingEntry, Stats } from './types';
import { addDaysToKey, isRestRecord, isScheduledForDay, parseDateKey } from './helpers';

/**
 * True when every day strictly between `fromKey` and `toKey` was a rest day: nothing was
 * scheduled, or everything scheduled was skipped. Rest days must not break a streak.
 */
export const onlyRestDaysBetween = (
  fromKey: string, toKey: string, commissions: Commission[], history: CompletionRecord[] = [],
): boolean => {
  const byDate = new Map(history.map(r => [r.date, r]));
  for (let key = addDaysToKey(fromKey, 1); key < toKey; key = addDaysToKey(key, 1)) {
    const record = byDate.get(key);
    if (record) {
      if (!isRestRecord(record)) return false;
      continue;
    }
    // No record: the app wasn't opened, so it was a rest day only if nothing was scheduled.
    // The schedule is weekly, so this returns within a week unless skipped days intervene.
    const dow = parseDateKey(key).getDay();
    if (commissions.some(c => isScheduledForDay(c, dow))) return false;
  }
  return true;
};

/** Whether finishing today's habits continues the current streak (vs. starting at 1). */
export const streakContinues = (stats: Stats, todayKey: string, commissions: Commission[], history: CompletionRecord[] = []): boolean =>
  !!stats.lastFullDate && stats.currentStreak > 0 && onlyRestDaysBetween(stats.lastFullDate, todayKey, commissions, history);

export const rolloverFinance = (
  finance: FinanceData,
  dailyTotals: DailyTotal[],
  todayKey: string,
): { finance: FinanceData; dailyTotals: DailyTotal[]; changed: boolean } => {
  if (finance.date === todayKey) return { finance, dailyTotals, changed: false };
  const totals = finance.spentToday > 0
    ? [...dailyTotals.filter(t => t.date !== finance.date), { date: finance.date, total: finance.spentToday, entries: finance.history ?? [] }]
        .sort((a, b) => a.date.localeCompare(b.date))
    : dailyTotals;
  return { finance: { spentToday: 0, date: todayKey, history: [] }, dailyTotals: totals, changed: true };
};

/**
 * Adds a spending entry to its own day: today's (`finance.date`) to today's spending, an
 * earlier day's to that day's history. An entry already there (same id) isn't added twice.
 */
export const addEntryOnDay = (
  finance: FinanceData, dailyTotals: DailyTotal[], entry: SpendingEntry, date: string,
): { finance: FinanceData; dailyTotals: DailyTotal[] } => {
  if (date >= finance.date) {
    const history = finance.history ?? [];
    if (history.some(e => e.id === entry.id)) return { finance, dailyTotals };
    return { finance: { ...finance, spentToday: finance.spentToday + entry.amount, history: [...history, entry] }, dailyTotals };
  }
  const day = dailyTotals.find(t => t.date === date);
  if (day?.entries?.some(e => e.id === entry.id)) return { finance, dailyTotals };
  const withEntry: DailyTotal = day
    ? { ...day, total: day.total + entry.amount, entries: [...(day.entries ?? []), entry] }
    : { date, total: entry.amount, entries: [entry] };
  return { finance, dailyTotals: [...dailyTotals.filter(t => t.date !== date), withEntry].sort((a, b) => a.date.localeCompare(b.date)) };
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
  const scheduled  = commissions.filter(c => isScheduledForDay(c, dow));
  const counted    = scheduled.filter(c => !c.skipped);
  const weeklyDone = commissions.filter(c => c.perWeek && c.completed);
  let history      = prev.history.filter(r => r.date !== date);
  if (scheduled.length > 0 || weeklyDone.length > 0) {
    const skipped = scheduled.filter(c => c.skipped).map(c => c.id);
    history = [...history, {
      date,
      completed:    counted.length > 0 && counted.every(c => c.completed),
      completedIds: [...scheduled, ...weeklyDone].filter(c => c.completed).map(c => c.id),
      scheduledIds: scheduled.map(c => c.id),
      ...(skipped.length > 0 ? { skippedIds: skipped } : {}),
    }].sort((a, b) => a.date.localeCompare(b.date));
  } else if (history.length === prev.history.length) {
    history = prev.history;
  }

  // Streak increments happen live when the last habit is completed, so here it's mostly
  // broken. A day finished outside the app (Siri) was never credited live: credit it now.
  // totalCompleted is counted where habits are completed, so it is not touched here.
  let before = prev.stats;
  if (counted.length > 0 && counted.every(c => c.completed) && before.lastFullDate !== date) {
    const streak = streakContinues(before, date, commissions, history) ? before.currentStreak + 1 : 1;
    before = { ...before, currentStreak: streak, bestStreak: Math.max(streak, before.bestStreak), lastFullDate: date };
  }
  const kept  = { ...before, beforeToday: undefined };
  const stats = streakContinues(before, todayKey, commissions, history) ? kept : { ...kept, currentStreak: 0 };

  return {
    commissions: commissions.map(c => ({ ...c, completed: false, completionCount: 0, skipped: false })),
    stats,
    history,
    changed: true,
  };
};
