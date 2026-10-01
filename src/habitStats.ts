// src/habitStats.ts
//
// Per-habit history and streaks, worked out from the daily completion records.
// A day with no record is a day the app wasn't opened, so a scheduled habit counts as
// missed. Days the habit isn't scheduled are rest days, and skipped days are neutral:
// neither breaks a streak or counts towards it.
//
// "N× a week" habits are judged by week (Monday to Sunday) instead: a week counts once it
// has N done days, and only a finished week that fell short breaks the streak.

import type { Commission, CompletionRecord } from './types';
import { addDaysToKey, isScheduledForDay, parseDateKey, toDateKey } from './helpers';
import { periodStart } from './budget';

/** `pending`: today, scheduled and not done yet. It doesn't break the streak. */
export type HabitDayState = 'done' | 'missed' | 'rest' | 'skipped' | 'pending';

export type HabitDay = { date: string; state: HabitDayState };

export type HabitStats = {
  /** Days for fixed-day habits, weeks for "N× a week" habits. */
  unit: 'day' | 'week';
  /** Units done in a row. Today (or this week) counts once it's done. */
  current: number;
  best: number;
  /** Units done and missed. Skipped days, today and the current week don't count as missed. */
  done: number;
  missed: number;
  /** done / (done + missed), or null before the first finished unit. */
  rate: number | null;
  /** First day the habit is tracked from. */
  since: string;
  /** Days done in total (same as `done` for fixed-day habits). */
  sessions: number;
  /** "N× a week" habits: days done this week, today included. */
  thisWeek: number;
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
    if (habit.perWeek) {
      // Never scheduled on a day: each day is just done or not.
      const done = key === todayKey ? habit.completed : !!byDate.get(key)?.completedIds.includes(habit.id);
      days.push({ date: key, state: done ? 'done' : key === todayKey ? 'pending' : 'rest' });
      continue;
    }
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

const dailyStats = (days: HabitDay[], todayKey: string): HabitStats => {
  let run = 0, best = 0, done = 0, missed = 0;
  for (const { state } of days) {
    if (state === 'done') { run++; done++; best = Math.max(best, run); }
    else if (state === 'missed') { run = 0; missed++; }
  }
  return {
    unit: 'day', current: run, best, done, missed, rate: done + missed > 0 ? done / (done + missed) : null,
    since: days[0]?.date ?? todayKey, sessions: done, thisWeek: 0,
  };
};

const weeklyStats = (perWeek: number, days: HabitDay[], todayKey: string): HabitStats => {
  const doneByWeek = new Map<string, number>(); // in date order, Monday keys
  for (const { date, state } of days) {
    const week = periodStart('weekly', date);
    doneByWeek.set(week, (doneByWeek.get(week) ?? 0) + (state === 'done' ? 1 : 0));
  }
  const thisWeekKey = periodStart('weekly', todayKey);
  const firstWeek   = periodStart('weekly', days[0]?.date ?? todayKey);
  let run = 0, best = 0, met = 0, missed = 0, sessions = 0;
  for (const [week, n] of doneByWeek) {
    sessions += n;
    if (n >= perWeek) { run++; met++; best = Math.max(best, run); }
    // The current week is still going, and a first part-week can't fairly be held against it.
    else if (week !== thisWeekKey && week !== firstWeek) { run = 0; missed++; }
  }
  return {
    unit: 'week', current: run, best, done: met, missed, rate: met + missed > 0 ? met / (met + missed) : null,
    since: days[0]?.date ?? todayKey, sessions, thisWeek: doneByWeek.get(thisWeekKey) ?? 0,
  };
};

/** Streak and rates from `habitDays`, by day or by week depending on the habit. */
export const statsFromDays = (habit: Commission, days: HabitDay[], todayKey: string): HabitStats =>
  habit.perWeek ? weeklyStats(habit.perWeek, days, todayKey) : dailyStats(days, todayKey);

// ── Skips ───────────────────────────────────────────────────────────────────
// Skips are capped so a streak still means something: 2 a week for habits on 4+ days a
// week, 1 for habits on 3 days or fewer. Weeks run Monday to Sunday, like budget weeks.
// "N× a week" habits have no skips: any day already works for them.

export type SkipAllowance = { limit: number; used: number; left: number };

export const skipLimit = (habit: Commission): number => {
  if (habit.perWeek) return 0;
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

export type HabitSummary = HabitStats & {
  skips: SkipAllowance;
  /** "N× a week" habits that have reached N this week: quiet until Monday. */
  weekDone: boolean;
};

export const habitStats = (habit: Commission, history: CompletionRecord[], todayKey: string): HabitSummary => {
  const stats = statsFromDays(habit, habitDays(habit, history, todayKey), todayKey);
  return {
    ...stats,
    skips: skipAllowance(habit, history, todayKey),
    weekDone: !!habit.perWeek && stats.thisWeek >= habit.perWeek,
  };
};
