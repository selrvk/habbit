// src/pastDays.ts
//
// Putting right what's already past. A Habbit done yesterday but not ticked off in time can
// be ticked off the next day (yesterday only, so a streak still means something), and the
// day streak follows. Spending can be logged on, moved to, changed or removed from any of
// the last few days. Pure functions; App.tsx keeps the results.

import type { Commission, CompletionRecord, DailyTotal, FinanceData, SpendingEntry, Stats, StreakBase } from './types';
import { addDaysToKey, isScheduledForDay, parseDateKey } from './helpers';
import { addEntryOnDay, streakContinues } from './dayRollover';
import { habitCreatedKey, habitDays } from './habitStats';

const round2 = (n: number) => Math.round(n * 100) / 100;

// ── A Habbit, yesterday ──────────────────────────────────────────────────────

/**
 * Whether yesterday can be ticked off ('not-done') or undone ('done') for a Habbit: it was
 * scheduled then (missed or skipped), or it's an "N× a week" one, and it existed. Null otherwise.
 */
export const yesterdayState = (habit: Commission, history: CompletionRecord[], todayKey: string): 'done' | 'not-done' | null => {
  const day = habitDays(habit, history, todayKey).find(d => d.date === addDaysToKey(todayKey, -1));
  if (!day) return null;
  if (day.state === 'done') return 'done';
  return habit.perWeek || day.state === 'missed' || day.state === 'skipped' ? 'not-done' : null;
};

const credit = (s: StreakBase, day: string, commissions: Commission[], history: CompletionRecord[]): StreakBase => {
  const run = streakContinues(s, day, commissions, history) ? s.currentStreak + 1 : 1;
  return { currentStreak: run, bestStreak: Math.max(run, s.bestStreak), lastFullDate: day };
};

/**
 * Where the streak stood before yesterday counted. Kept at rollover (Stats.yesterday); for a
 * day rolled over by an older version, worked out as near as it can be.
 */
const yesterdayBase = (stats: Stats, yesterday: string, todayCounted: boolean, history: CompletionRecord[]): StreakBase => {
  if (stats.yesterday?.date === yesterday) return stats.yesterday.base;
  const s = todayCounted && stats.beforeToday ? stats.beforeToday : stats;
  if (s.lastFullDate < yesterday) return { currentStreak: s.currentStreak, bestStreak: s.bestStreak, lastFullDate: s.lastFullDate };
  const before = history.filter(r => r.date < yesterday && r.completed).pop();
  return { currentStreak: Math.max(s.currentStreak - 1, 0), bestStreak: s.bestStreak, lastFullDate: before?.date ?? '' };
};

/**
 * Ticks a Habbit off for yesterday (`done`), or undoes that. Yesterday's record is updated
 * (or made, when the app wasn't opened that day) and the day streak worked out again from
 * where it stood before yesterday, through yesterday, to today if today already counted.
 */
export const setYesterday = ({ habitId, done, commissions, history, stats, todayKey }: {
  habitId: string; done: boolean; commissions: Commission[]; history: CompletionRecord[]; stats: Stats; todayKey: string;
}): { history: CompletionRecord[]; stats: Stats } => {
  const y   = addDaysToKey(todayKey, -1);
  const old = history.find(r => r.date === y);
  const dow = parseDateKey(y).getDay();
  const record: CompletionRecord = old ?? {
    date: y, completed: false, completedIds: [],
    scheduledIds: commissions.filter(c => isScheduledForDay(c, dow) && (habitCreatedKey(c.id) ?? y) <= y).map(c => c.id),
  };
  if (record.completedIds.includes(habitId) === done) return { history, stats };

  const completedIds = done ? [...record.completedIds, habitId] : record.completedIds.filter(id => id !== habitId);
  const counted   = record.scheduledIds.filter(id => !record.skippedIds?.includes(id));
  const completed = counted.length > 0 && counted.every(id => completedIds.includes(id));
  const updated   = { ...record, completedIds, completed };
  const keep      = updated.scheduledIds.length > 0 || completedIds.length > 0;
  const nextHistory = [...history.filter(r => r.date !== y), ...(keep ? [updated] : [])].sort((a, b) => a.date.localeCompare(b.date));
  const totalCompleted = Math.max(stats.totalCompleted + (done ? 1 : -1), 0);
  if (completed === record.completed) return { history: nextHistory, stats: { ...stats, totalCompleted } };

  // Yesterday now counts, or no longer does: the streak runs again from before it.
  const todayCounted = stats.lastFullDate === todayKey;
  const base  = yesterdayBase(stats, y, todayCounted, history);
  const after = completed ? credit(base, y, commissions, nextHistory) : base;
  const streak: StreakBase & { beforeToday?: StreakBase } = todayCounted
    ? { ...credit(after, todayKey, commissions, nextHistory), beforeToday: after }
    : { ...after, currentStreak: streakContinues(after, todayKey, commissions, nextHistory) ? after.currentStreak : 0 };
  return { history: nextHistory, stats: { ...stats, ...streak, totalCompleted } };
};

// ── Spending on earlier days ─────────────────────────────────────────────────

/** Today's spending (`finance`, whose date is today) and the days before it. */
export type Books = { finance: FinanceData; dailyTotals: DailyTotal[] };

/** How far back spending can be logged or moved: today and the six days before. */
export const RECENT_DAYS = 7;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS   = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Today", "Yesterday", "Thursday", or "Oct 3" further back than a week. */
export const dayName = (day: string, todayKey: string): string => {
  if (day === todayKey) return 'Today';
  if (day === addDaysToKey(todayKey, -1)) return 'Yesterday';
  const d = parseDateKey(day);
  return day > addDaysToKey(todayKey, -RECENT_DAYS) ? WEEKDAYS[d.getDay()] : `${MONTHS[d.getMonth()]} ${d.getDate()}`;
};

/** The days spending can go on, newest first. */
export const recentDays = (todayKey: string): { key: string; label: string }[] =>
  Array.from({ length: RECENT_DAYS }, (_, i) => addDaysToKey(todayKey, -i)).map(key => ({ key, label: dayName(key, todayKey) }));

const entriesOn = (books: Books, date: string): SpendingEntry[] =>
  date === books.finance.date ? books.finance.history ?? [] : books.dailyTotals.find(d => d.date === date)?.entries ?? [];

export const entryOn = (books: Books, id: string, date: string): SpendingEntry | undefined => entriesOn(books, date).find(e => e.id === id);

/** Takes an entry off its day. A past day left with nothing on it goes. */
export const removeEntry = (books: Books, id: string, date: string): Books => {
  const entry = entryOn(books, id, date);
  if (!entry) return books;
  if (date === books.finance.date) {
    const { finance } = books;
    return { ...books, finance: { ...finance, spentToday: round2(Math.max(finance.spentToday - entry.amount, 0)), history: (finance.history ?? []).filter(e => e.id !== id) } };
  }
  const dailyTotals = books.dailyTotals.flatMap(d => {
    if (d.date !== date) return [d];
    const entries = (d.entries ?? []).filter(e => e.id !== id);
    const total   = round2(Math.max(d.total - entry.amount, 0));
    return total > 0 || entries.length > 0 ? [{ ...d, total, entries }] : [];
  });
  return { ...books, dailyTotals };
};

export type EntryChanges = { amount: number; note?: string; category?: string };

/**
 * Changes an entry's amount, note and category, keeping its place in the day, or moves it
 * to `toDate` as well. A bill's payment stays on its due date.
 */
export const changeEntry = (books: Books, id: string, date: string, changes: EntryChanges, toDate: string = date): Books => {
  const entry = entryOn(books, id, date);
  if (!entry || !(changes.amount > 0)) return books;
  const { note: _note, category: _category, ...rest } = entry;
  const updated: SpendingEntry = {
    ...rest, amount: round2(changes.amount),
    ...(changes.note?.trim() ? { note: changes.note.trim() } : {}),
    ...(changes.category ? { category: changes.category } : {}),
  };
  const target = entry.billId ? date : toDate;
  if (target !== date) {
    const off = removeEntry(books, id, date);
    return addEntryOnDay(off.finance, off.dailyTotals, updated, target);
  }
  const diff = updated.amount - entry.amount;
  if (date === books.finance.date) {
    const { finance } = books;
    return { ...books, finance: { ...finance, spentToday: round2(finance.spentToday + diff), history: (finance.history ?? []).map(e => (e.id === id ? updated : e)) } };
  }
  return {
    ...books,
    dailyTotals: books.dailyTotals.map(d => (d.date === date ? { ...d, total: round2(d.total + diff), entries: (d.entries ?? []).map(e => (e.id === id ? updated : e)) } : d)),
  };
};
