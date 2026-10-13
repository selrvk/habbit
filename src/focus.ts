// src/focus.ts
//
// The focus timer, a Pomodoro: a habit can be timed in rounds ("Study", 4 rounds → four
// 25-minute rounds with a short break between, and a longer one after every fourth). Once
// started it runs on its own, round to break to round, until the last round or until it's
// stopped. The rounds are the habit's count for the day: each finished round is one
// check-off, applied as an inbox event (inbox.ts) so a round that ends while the app is
// closed still counts, on the day it ended. Stopping keeps the rounds done; starting again
// that day carries on from the next. One session runs at a time; it's stored, so it carries
// on across app restarts. Finished rounds also log their minutes, for "focused this week".
// A quick session (started from Home, QUICK_FOCUS_ID) has no habit: nothing is checked off,
// and its minutes count like any others.
// ("block" in names here is a round; stored sessions keep the older field names.)

import type { Commission } from './types';
import type { InboxEvent } from './inbox';
import { addDaysToKey, toDateKey } from './helpers';

export type FocusSettings = {
  minutes: number;
  breakMinutes: number;
  /** A longer break after every fourth round (0 or missing: the usual break). */
  longBreakMinutes?: number;
};

export const FOCUS_LENGTHS = [10, 15, 20, 25, 45, 60];
export const BREAK_LENGTHS = [0, 5, 10, 15];
export const LONG_BREAK_LENGTHS = [0, 15, 20, 30];
/** The long break comes after every this many rounds. */
export const LONG_BREAK_EVERY = 4;
/** Rounds a new focus habit starts with, and the most one can have. */
export const DEFAULT_ROUNDS = 4;
export const MAX_ROUNDS = 10;
export const DEFAULT_FOCUS: FocusSettings = { minutes: 25, breakMinutes: 5 };

/** The `habitId` of a quick session, and of its minutes in the log. */
export const QUICK_FOCUS_ID = 'quick';
export const QUICK_FOCUS_LABEL = 'Quick focus';
export const isQuickFocus = (s: { habitId: string }): boolean => s.habitId === QUICK_FOCUS_ID;

/** What a quick session was last set up with, remembered for the next one. */
export type QuickFocusSettings = FocusSettings & { rounds: number };
export const DEFAULT_QUICK_FOCUS: QuickFocusSettings = { rounds: DEFAULT_ROUNDS, ...DEFAULT_FOCUS };

export type FocusSession = {
  id: string;
  habitId: string;
  label: string;
  /** 'focus' counts down a round; 'break' the rest after one. */
  phase: 'focus' | 'break';
  /** The round running, or just finished during a break (1-based), and how many make the day. */
  block: number;
  blocks: number;
  minutes: number;
  breakMinutes: number;
  longBreakMinutes?: number;
  /** When the phase started and ends, in ms. */
  startedAt: number;
  endsAt: number;
  /** Set while paused: ms that were left. */
  pausedLeft?: number;
};

const MINUTE = 60_000;

/** "2026-10-03" for a timestamp, in local time. */
export const dayKeyAt = (ms: number): string => toDateKey(new Date(ms));

/** A new session for `habit`, starting at the next round of its count for today. */
export const startBlock = (habit: Commission & { focus: FocusSettings }, now: number, id: string): FocusSession => {
  const blocks = Math.max(habit.timesPerDay ?? 1, 1);
  const block  = blocks > 1 ? Math.min((habit.completionCount ?? 0) + 1, blocks) : 1;
  return {
    id, habitId: habit.id, label: habit.label, phase: 'focus', block, blocks,
    minutes: habit.focus.minutes, breakMinutes: habit.focus.breakMinutes,
    ...(habit.focus.longBreakMinutes ? { longBreakMinutes: habit.focus.longBreakMinutes } : {}),
    startedAt: now, endsAt: now + habit.focus.minutes * MINUTE,
  };
};

/** A quick session, from round 1. A break only comes between rounds, a long one only past four. */
export const startQuickFocus = (q: QuickFocusSettings, label: string, now: number, id: string): FocusSession => {
  const blocks = Math.min(Math.max(Math.round(q.rounds) || 1, 1), MAX_ROUNDS);
  return {
    id, habitId: QUICK_FOCUS_ID, label: label.trim() || QUICK_FOCUS_LABEL, phase: 'focus', block: 1, blocks,
    minutes: q.minutes, breakMinutes: blocks > 1 ? q.breakMinutes : 0,
    ...(blocks > LONG_BREAK_EVERY && q.longBreakMinutes ? { longBreakMinutes: q.longBreakMinutes } : {}),
    startedAt: now, endsAt: now + q.minutes * MINUTE,
  };
};

/** Minutes a whole session takes: its rounds and the breaks between them. */
export const sessionLength = (rounds: number, f: FocusSettings): number => {
  let total = rounds * f.minutes;
  for (let block = 1; block < rounds; block++) {
    total += breakMinutesAfter({ block, blocks: rounds, breakMinutes: f.breakMinutes, longBreakMinutes: rounds > LONG_BREAK_EVERY ? f.longBreakMinutes : 0 });
  }
  return total;
};

/** Minutes of break after round `s.block`: none after the last, the long one after every fourth. */
export const breakMinutesAfter = (s: Pick<FocusSession, 'block' | 'blocks' | 'breakMinutes' | 'longBreakMinutes'>): number =>
  s.block >= s.blocks ? 0
    : s.longBreakMinutes && s.block % LONG_BREAK_EVERY === 0 ? s.longBreakMinutes
    : s.breakMinutes;

/** Whether the break running is a long one. */
export const onLongBreak = (s: FocusSession): boolean =>
  s.phase === 'break' && !!s.longBreakMinutes && s.block % LONG_BREAK_EVERY === 0;

/** ms left in the current phase. */
export const timeLeft = (s: FocusSession, now: number): number =>
  s.pausedLeft ?? Math.max(0, s.endsAt - now);

/** How far through the current phase, 0 to 1. */
export const progress = (s: FocusSession, now: number): number => {
  const total = (s.phase === 'focus' ? s.minutes : breakMinutesAfter(s)) * MINUTE;
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

/** The next round, starting at `at`. */
const roundAfter = (s: FocusSession, at: number): FocusSession =>
  ({ ...s, phase: 'focus', block: s.block + 1, startedAt: at, endsAt: at + s.minutes * MINUTE });

/**
 * What follows the phase that ends at `s.endsAt`, starting right then: a round's break (or
 * the next round when there's no break), a break's next round, or null after the last round.
 */
export const following = (s: FocusSession): FocusSession | null => {
  if (s.phase === 'focus') {
    if (s.block >= s.blocks) return null;
    const rest = breakMinutesAfter(s);
    if (rest > 0) return { ...s, phase: 'break', startedAt: s.endsAt, endsAt: s.endsAt + rest * MINUTE };
  }
  return roundAfter(s, s.endsAt);
};

/**
 * Settles a session as of `now`, moving it through every phase that has ended: each round
 * that ran out becomes a check-off (an inbox event dated the day it ended) and its minutes,
 * then its break starts, then the next round, and so on until the phase running at `now`,
 * or null after the last round. Paused sessions wait (one paused on an earlier day is
 * dropped). Call it on launch, on resume and when a countdown hits zero; it's safe to call
 * again (a settled session comes back as it is, with nothing to count).
 */
export const settle = (s: FocusSession | null, now: number, todayKey = dayKeyAt(now)): {
  session: FocusSession | null;
  events: InboxEvent[];
  logged: FocusLogEntry[];
} => {
  const events: InboxEvent[] = [];
  const logged: FocusLogEntry[] = [];
  let session = s;
  while (session && session.pausedLeft === undefined && session.endsAt <= now) {
    if (session.phase === 'focus') {
      const date = dayKeyAt(session.endsAt);
      // A quick session has no habit to check off.
      if (!isQuickFocus(session)) events.push({ id: `focus-${session.id}-${session.block}`, kind: 'habit', date, habitId: session.habitId });
      logged.push({ date, habitId: session.habitId, minutes: session.minutes });
    }
    session = following(session);
  }
  if (session && session.pausedLeft !== undefined && dayKeyAt(session.startedAt) < todayKey) session = null;
  return { session, events, logged };
};

/**
 * Skipping a break: the next round, starting now. Null when there's none to start (the
 * last round is done, or the habit was finished or skipped some other way).
 */
export const nextBlock = (s: FocusSession, habit: Commission | undefined, now: number): FocusSession | null => {
  if (s.block >= s.blocks) return null;
  if (!isQuickFocus(s) && (!habit?.focus || habit.completed || habit.skipped)) return null;
  return roundAfter(s, now);
};

/** A switch still to come: a round ending (the last one ends the session) or a break ending. */
export type FocusTransition = {
  at: number;
  kind: 'round-done' | 'break-over' | 'all-done';
  /** The round that just ended, or the one the break followed. */
  block: number;
  blocks: number;
  /** After a round: the break that follows, in minutes (0: the next round starts right away). */
  restMinutes: number;
};

/** The switches ahead if the session runs on from here, soonest first. None while paused. */
export const upcomingTransitions = (s: FocusSession, limit: number): FocusTransition[] => {
  const list: FocusTransition[] = [];
  let phase: FocusSession | null = s.pausedLeft === undefined ? s : null;
  while (phase && list.length < limit) {
    const { block, blocks } = phase;
    list.push(phase.phase === 'break' ? { at: phase.endsAt, kind: 'break-over', block, blocks, restMinutes: 0 }
      : { at: phase.endsAt, kind: block >= blocks ? 'all-done' : 'round-done', block, blocks, restMinutes: breakMinutesAfter(phase) });
    phase = following(phase);
  }
  return list;
};

/** The notification for a switch (ios/FocusActivity.swift writes the same ones). */
export const transitionText = ({ label, habitId }: Pick<FocusSession, 'label' | 'habitId'>, t: FocusTransition): { title: string; body: string } =>
  t.kind === 'all-done' ? {
    title: t.blocks > 1 ? `All ${t.blocks} rounds done 🎉` : 'Focus round done 🥕',
    body: isQuickFocus({ habitId }) ? `${label}: that’s the whole session. Great focus!` : `${label} is done for today. Great focus!`,
  }
    : t.kind === 'break-over' ? { title: 'Break’s over 🐰', body: `${label}: round ${t.block + 1} of ${t.blocks} starts now.` }
    : {
      title: `Round ${t.block} of ${t.blocks} done 🥕`,
      body: t.restMinutes > 0 ? `${label}: enjoy a ${t.restMinutes}-minute break.` : `${label}: round ${t.block + 1} starts now.`,
    };

/** When the whole session ends if it runs on without a pause (ms). */
export const sessionEndsAt = (s: FocusSession, now: number): number => {
  let phase: FocusSession | null = s.pausedLeft !== undefined ? resume(s, now) : s;
  let end = phase.endsAt;
  while ((phase = following(phase))) end = phase.endsAt;
  return end;
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

/** Remembered quick-session settings, or the defaults when there are none (or they're off the lists). */
export const parseQuickFocus = (raw: unknown): QuickFocusSettings => {
  const q = raw as Partial<QuickFocusSettings> | null;
  if (!q || typeof q !== 'object') return DEFAULT_QUICK_FOCUS;
  const pick = (list: number[], value: unknown, fallback: number) => (list.includes(value as number) ? (value as number) : fallback);
  const rounds = Number.isInteger(q.rounds) && q.rounds! >= 1 && q.rounds! <= MAX_ROUNDS ? q.rounds! : DEFAULT_QUICK_FOCUS.rounds;
  const longBreakMinutes = pick(LONG_BREAK_LENGTHS, q.longBreakMinutes, 0);
  return {
    rounds,
    minutes: pick(FOCUS_LENGTHS, q.minutes, DEFAULT_FOCUS.minutes),
    breakMinutes: pick(BREAK_LENGTHS, q.breakMinutes, DEFAULT_FOCUS.breakMinutes),
    ...(longBreakMinutes > 0 ? { longBreakMinutes } : {}),
  };
};

/** Names for the log's ids: each habit's, and "Quick focus" for sessions without one. */
export const focusLabels = (habits: Commission[]): Map<string, string> =>
  new Map([...habits.map(h => [h.id, h.label] as [string, string]), [QUICK_FOCUS_ID, QUICK_FOCUS_LABEL]]);

export const parseFocusSession = (raw: unknown): FocusSession | null => {
  const s = raw as FocusSession | null;
  return s && typeof s.id === 'string' && typeof s.habitId === 'string' && (s.phase === 'focus' || s.phase === 'break')
    && typeof s.endsAt === 'number' && typeof s.startedAt === 'number' ? s : null;
};

// ── For Bonbon ────────────────────────────────────────────────────────────────

export type FocusOverview = {
  /** When this was worked out (ms), for the running timer. */
  at: number;
  /** The round or break running. */
  running: { label: string; phase: 'focus' | 'break'; block: number; blocks: number; minutesLeft: number; paused: boolean } | null;
  todayMinutes: number;
  /** The last 7 days (today included), and the 7 before them. */
  weekMinutes: number;
  prevWeekMinutes: number;
  weekDays: number;
  /** The last 7 days by habit, most first, with quick sessions as "Quick focus" (habits deleted since are left out). */
  byHabit: { label: string; minutes: number }[];
  /** Habits set up with the focus timer, and how many rounds a day each has. */
  timed: { label: string; rounds: number; minutes: number; breakMinutes: number }[];
};

/** The focus timer at a glance, for Bonbon's chat; null if it's never been set up or used. */
export const focusOverview = (log: FocusLogEntry[], session: FocusSession | null, habits: Commission[], todayKey: string, now: number): FocusOverview | null => {
  const timed = habits.flatMap(h => (h.focus ? [{ label: h.label, rounds: Math.max(h.timesPerDay ?? 1, 1), minutes: h.focus.minutes, breakMinutes: h.focus.breakMinutes }] : []));
  if (timed.length === 0 && log.length === 0 && !session) return null;
  const from   = addDaysToKey(todayKey, -6);
  const week   = log.filter(e => e.date >= from && e.date <= todayKey && e.minutes > 0);
  const labels = focusLabels(habits);
  const byHabit = new Map<string, number>();
  for (const e of week) if (labels.has(e.habitId)) byHabit.set(e.habitId, (byHabit.get(e.habitId) ?? 0) + e.minutes);
  return {
    at: now,
    running: session && {
      label: session.label, phase: session.phase, block: session.block, blocks: session.blocks,
      minutesLeft: Math.ceil(timeLeft(session, now) / MINUTE), paused: session.pausedLeft !== undefined,
    },
    todayMinutes:    focusMinutes(log, todayKey, todayKey),
    weekMinutes:     focusMinutes(week, from, todayKey),
    prevWeekMinutes: focusMinutes(log, addDaysToKey(from, -7), addDaysToKey(from, -1)),
    weekDays:        new Set(week.map(e => e.date)).size,
    byHabit: [...byHabit].map(([id, minutes]) => ({ label: labels.get(id)!, minutes })).sort((a, b) => b.minutes - a.minutes),
    timed,
  };
};
