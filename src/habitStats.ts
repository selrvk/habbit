// src/habitStats.ts
//
// Per-habit history and streaks, worked out from the daily completion records.
// A day with no record is a day the app wasn't opened, so a scheduled habit counts as
// missed. Days the habit isn't scheduled are rest days, and skipped days are neutral:
// neither breaks a streak or counts towards it.

import type { Commission, CompletionRecord } from './types';
import { addDaysToKey, isScheduledForDay, parseDateKey, toDateKey } from './helpers';
import { periodStart } from './budget';

/** `pending`: today, scheduled and not done yet. It doesn't break the streak. */
export type HabitDayState = 'done' | 'missed' | 'rest' | 'skipped' | 'pending';

export type HabitDay = { date: string; state: HabitDayState };

export type HabitStats = {
  /** Scheduled days done in a row. Today counts once it's done. */
  current: number;
  best: number;
  done: number;
  missed: number;
  /** done / (done + missed), or null before the first finished scheduled day. */
  rate: number | null;
  /** First day the habit is tracked from. */
  since: string;
};

/** Habit ids begin with their creation time in milliseconds (see generateId). */
export const habitCreatedKey = (id: string): string | null =>
  /^\d{13}/.test(id) ? toDateKey(new Date(Number(id.slice(0, 13)))) : null;

/**
 * The first day the habit is judged on: the day it was created, but never before the
 * oldest record (older history may have been trimmed by earlier versions).
 */
export const habitStartKey = (habit: Commission, history: CompletionRecord[], todayKey: string): string => {
  const historyStart = history[0]?.date ?? todayKey;
  const created = habitCreatedKey(habit.id)
    ?? history.find(r => r.scheduledIds.includes(habit.id))?.date
    ?? todayKey;
  const start = created > historyStart ? created : historyStart;
  return start < todayKey ? start : todayKey;
};

/** Every day from the habit's start to today, oldest first. `history` must be sorted by date. */
export const habitDays = (habit: Commission, history: CompletionRecord[], todayKey: string): HabitDay[] => {
  const byDate = new Map(history.map(r => [r.date, r]));
  const days: HabitDay[] = [];
  for (let key = habitStartKey(habit, history, todayKey); key <= todayKey; key = addDaysToKey(key, 1)) {
    const scheduledNow = isScheduledForDay(habit, parseDateKey(key).getDay());
    if (key === todayKey) {
      days.push({ date: key, state: !scheduledNow ? 'rest' : habit.completed ? 'done' : habit.skipped ? 'skipped' : 'pending' });
      break;
    }
    // A record keeps the schedule as it was that day; without one, use today's schedule.
    const record    = byDate.get(key);
    const scheduled = record ? record.scheduledIds.includes(habit.id) : scheduledNow;
    const done      = !!record && record.completedIds.includes(habit.id);
    const skipped   = !!record?.skippedIds?.includes(habit.id);
    days.push({ date: key, state: !scheduled ? 'rest' : done ? 'done' : skipped ? 'skipped' : 'missed' });
  }
  return days;
};

export const statsFromDays = (days: HabitDay[], todayKey: string): HabitStats => {
  let run = 0, best = 0, done = 0, missed = 0;
  for (const { state } of days) {
    if (state === 'done') { run++; done++; best = Math.max(best, run); }
    else if (state === 'missed') { run = 0; missed++; }
  }
  return { current: run, best, done, missed, rate: done + missed > 0 ? done / (done + missed) : null, since: days[0]?.date ?? todayKey };
};

// ── Skips ───────────────────────────────────────────────────────────────────
// Skips are capped so a streak still means something: 2 a week for habits on 4+ days a
// week, 1 for habits on 3 days or fewer. Weeks run Monday to Sunday, like budget weeks.

export type SkipAllowance = { limit: number; used: number; left: number };

export const skipLimit = (habit: Commission): number => {
  const days = habit.days?.length ?? 0;
  return days === 0 || days >= 4 ? 2 : 1;
};

/** Skips used this week, today's included. Un-skipping today gives it back. */
export const skipAllowance = (habit: Commission, history: CompletionRecord[], todayKey: string): SkipAllowance => {
  const weekStart = periodStart('weekly', todayKey);
  const earlier   = history.filter(r => r.date >= weekStart && r.date < todayKey && r.skippedIds?.includes(habit.id)).length;
  const used      = earlier + (habit.skipped ? 1 : 0);
  const limit     = skipLimit(habit);
  return { limit, used, left: Math.max(limit - used, 0) };
};

export type HabitSummary = HabitStats & { skips: SkipAllowance };

export const habitStats = (habit: Commission, history: CompletionRecord[], todayKey: string): HabitSummary => ({
  ...statsFromDays(habitDays(habit, history, todayKey), todayKey),
  skips: skipAllowance(habit, history, todayKey),
});
