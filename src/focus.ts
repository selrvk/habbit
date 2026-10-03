// src/focus.ts
//
// The focus timer: a habit can have focus blocks ("Study 4×" → four 25-minute blocks, with a
// short break between). Each finished block counts as one check-off, applied as an inbox
// event (inbox.ts) so a block that ends while the app is closed still counts, on the day it
// ended. One session runs at a time; it's stored, so it carries on across app restarts.
// Finished blocks also log their minutes, for "focused this week" totals.

import type { Commission } from './types';
import type { InboxEvent } from './inbox';
import { addDaysToKey, toDateKey } from './helpers';

export type FocusSettings = { minutes: number; breakMinutes: number };

export const FOCUS_LENGTHS = [10, 15, 20, 25, 45, 60];
export const BREAK_LENGTHS = [0, 5, 10, 15];
export const DEFAULT_FOCUS: FocusSettings = { minutes: 25, breakMinutes: 5 };

export type FocusSession = {
  id: string;
  habitId: string;
  label: string;
  /** 'focus' counts down a block; 'break' the rest after one (0 left: ready for the next). */
  phase: 'focus' | 'break';
  /** The block running, or just finished during a break (1-based), and how many make the day. */
  block: number;
  blocks: number;
  minutes: number;
  breakMinutes: number;
  /** When the phase started and ends, in ms. */
  startedAt: number;
  endsAt: number;
  /** Set while paused: ms that were left. */
  pausedLeft?: number;
};

const MINUTE = 60_000;

/** "2026-10-03" for a timestamp, in local time. */
export const dayKeyAt = (ms: number): string => toDateKey(new Date(ms));

/** A new block for `habit`: the next of its count for today. */
export const startBlock = (habit: Commission & { focus: FocusSettings }, now: number, id: string): FocusSession => {
  const blocks = Math.max(habit.timesPerDay ?? 1, 1);
  const block  = blocks > 1 ? Math.min((habit.completionCount ?? 0) + 1, blocks) : 1;
  return {
    id, habitId: habit.id, label: habit.label, phase: 'focus', block, blocks,
    minutes: habit.focus.minutes, breakMinutes: habit.focus.breakMinutes,
    startedAt: now, endsAt: now + habit.focus.minutes * MINUTE,
  };
};

/** ms left in the current phase. */
export const timeLeft = (s: FocusSession, now: number): number =>
  s.pausedLeft ?? Math.max(0, s.endsAt - now);

/** How far through the current phase, 0 to 1. */
export const progress = (s: FocusSession, now: number): number => {
  const total = (s.phase === 'focus' ? s.minutes : s.breakMinutes) * MINUTE;
  return total > 0 ? Math.min(1, Math.max(0, 1 - timeLeft(s, now) / total)) : 1;
};

export const pause = (s: FocusSession, now: number): FocusSession =>
  s.pausedLeft !== undefined ? s : { ...s, pausedLeft: timeLeft(s, now) };

export const resume = (s: FocusSession, now: number): FocusSession => {
  if (s.pausedLeft === undefined) return s;
  const { pausedLeft, ...rest } = s;
  return { ...rest, endsAt: now + pausedLeft };
};

/** "24:59", or "1:04:59" for an hour or more. */
export const clock = (ms: number): string => {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

/** The break that follows a finished block, or null when that was the day's last block. */
const breakAfter = (s: FocusSession): FocusSession | null =>
  s.block >= s.blocks || s.breakMinutes <= 0
    ? null
    : { ...s, phase: 'break', startedAt: s.endsAt, endsAt: s.endsAt + s.breakMinutes * MINUTE };

/**
 * Settles a session as of `now`: a focus block that has run out becomes a check-off (an
 * inbox event dated the day it ended) and its minutes, followed by its break if there is
 * one. A break from an earlier day is dropped. Call it on launch, on resume and when the
 * countdown hits zero; it's safe to call again (a settled session has nothing to settle).
 */
export const settle = (s: FocusSession | null, now: number, todayKey = dayKeyAt(now)): {
  session: FocusSession | null;
  events: InboxEvent[];
  logged: { date: string; habitId: string; minutes: number } | null;
} => {
  if (!s) return { session: null, events: [], logged: null };
  if (s.phase === 'focus' && s.pausedLeft === undefined && s.endsAt <= now) {
    const date = dayKeyAt(s.endsAt);
    const next = breakAfter(s);
    return {
      session: next && dayKeyAt(next.endsAt) >= todayKey ? next : null,
      events: [{ id: `focus-${s.id}`, kind: 'habit', date, habitId: s.habitId }],
      logged: { date, habitId: s.habitId, minutes: s.minutes },
    };
  }
  // A break, or a paused block, left over from an earlier day: start fresh today.
  if (dayKeyAt(s.startedAt) < todayKey && (s.phase === 'break' || s.pausedLeft !== undefined)) {
    return { session: null, events: [], logged: null };
  }
  return { session: s, events: [], logged: null };
};

/** The next block after a break (or skipping it), or null when the habit's done for today. */
export const nextBlock = (s: FocusSession, habit: Commission | undefined, now: number, id: string): FocusSession | null => {
  if (!habit?.focus || habit.completed || habit.skipped) return null;
  return startBlock({ ...habit, focus: { minutes: s.minutes, breakMinutes: s.breakMinutes } }, now, id);
};

// ── Focus time ────────────────────────────────────────────────────────────────

export type FocusLogEntry = { date: string; habitId: string; minutes: number };

/** Keep about a year of daily totals. */
const KEEP_DAYS = 400;

export const logFocus = (log: FocusLogEntry[], add: FocusLogEntry): FocusLogEntry[] => {
  const cutoff = addDaysToKey(add.date, -KEEP_DAYS);
  const found  = log.some(e => e.date === add.date && e.habitId === add.habitId);
  const next   = found
    ? log.map(e => (e.date === add.date && e.habitId === add.habitId ? { ...e, minutes: e.minutes + add.minutes } : e))
    : [...log, add];
  return next.filter(e => e.date >= cutoff);
};

/** Minutes focused from `from` to `to` (inclusive), for one habit or all. */
export const focusMinutes = (log: FocusLogEntry[], from: string, to: string, habitId?: string): number =>
  log.reduce((sum, e) => (e.date >= from && e.date <= to && (!habitId || e.habitId === habitId) ? sum + e.minutes : sum), 0);

/** "45 min", "1h 20m", "3h". */
export const durationLabel = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

export const parseFocusLog = (raw: unknown): FocusLogEntry[] =>
  Array.isArray(raw)
    ? raw.filter((e): e is FocusLogEntry => !!e && typeof e.date === 'string' && typeof e.habitId === 'string' && typeof e.minutes === 'number')
    : [];

export const parseFocusSession = (raw: unknown): FocusSession | null => {
  const s = raw as FocusSession | null;
  return s && typeof s.id === 'string' && typeof s.habitId === 'string' && (s.phase === 'focus' || s.phase === 'break')
    && typeof s.endsAt === 'number' && typeof s.startedAt === 'number' ? s : null;
};
