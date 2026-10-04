// src/workout.ts
//
// Workout habits: a habit can have routines ("Push", "Pull", "Legs"), each a list of
// exercises with a target of sets × reps. The routines take turns: the next workout is the
// routine after the last one done, whatever the day. A workout fills in each exercise's
// weights from the last time it was done (in any routine, matched by name), and finishing
// it checks the habit off once, on the day it finished (as an inbox event, like the focus
// timer). Ticking a set off starts a rest before the next one. Finished workouts are kept
// for history.

import type { Commission } from './types';
import { dayKeyAt } from './focus';
import { addDaysToKey } from './helpers';

export type WeightUnit = 'kg' | 'lb';
export type ExercisePlan = { id: string; name: string; sets: number; reps: number };
export type Routine = { id: string; name: string; exercises: ExercisePlan[] };
export type WorkoutPlan = {
  unit: WeightUnit;
  routines: Routine[];
  /** Rest after each set, in seconds (0: none). Missing means the default. */
  restSeconds?: number;
};

/** A set as done: weight (null for bodyweight) × reps. */
export type SetLog = { weight: number | null; reps: number };

/** A finished workout. */
export type WorkoutLog = {
  id: string;
  habitId: string;
  routineId: string;
  routineName: string;
  /** The day it finished on (it counts for that day), and when it started and finished (ms). */
  date: string;
  startedAt: number;
  endedAt: number;
  unit: WeightUnit;
  /** The exercises with at least one set done, in order. */
  exercises: { name: string; sets: SetLog[] }[];
};

/** A set while the workout runs: what's typed in, and whether it's ticked off. */
export type LiveSet = { weight: string; reps: string; done: boolean };
export type LiveExercise = { name: string; sets: LiveSet[] };

/** The workout in progress. Stored, so it survives the app closing. */
export type ActiveWorkout = {
  id: string;
  habitId: string;
  label: string;
  routineId: string;
  routineName: string;
  unit: WeightUnit;
  startedAt: number;
  /** The last change (ms): a workout left alone for long is closed (settleWorkout). */
  updatedAt: number;
  exercises: LiveExercise[];
  /** Rest after each set, in seconds (0: none). */
  restSeconds: number;
  /** The rest running: when it ends (ms), how long it is, and the set that started it. */
  rest?: { endsAt: number; seconds: number; ex: number; set: number };
};

export const DEFAULT_REST = 90;
export const REST_LENGTHS = [0, 30, 60, 90, 120, 180];
/** Longest a rest can be stretched to with +15. */
const MAX_REST = 600;

export const SET_COUNTS = [1, 2, 3, 4, 5, 6, 8];
export const MAX_SETS = 12;
/** A workout untouched this long was forgotten: it's finished (or dropped) when the app next looks. */
const FORGOTTEN_MS = 12 * 60 * 60 * 1000;
/** Keep this many workouts (a few years' worth). */
const KEEP_WORKOUTS = 1000;

// ── Starting points ──────────────────────────────────────────────────────────

export const EXERCISE_SUGGESTIONS = [
  'Bench press', 'Squat', 'Deadlift', 'Overhead press', 'Barbell row', 'Pull-up', 'Push-up',
  'Lat pulldown', 'Incline dumbbell press', 'Romanian deadlift', 'Leg press', 'Lunge',
  'Bicep curl', 'Tricep extension', 'Lateral raise', 'Calf raise',
];

type Template = { name: string; routines: { name: string; exercises: [string, number, number][] }[] };

export const ROUTINE_TEMPLATES: Template[] = [
  { name: 'Push / Pull / Legs', routines: [
    { name: 'Push', exercises: [['Bench press', 3, 8], ['Overhead press', 3, 8], ['Incline dumbbell press', 3, 10], ['Tricep extension', 3, 12]] },
    { name: 'Pull', exercises: [['Deadlift', 3, 5], ['Pull-up', 3, 8], ['Barbell row', 3, 8], ['Bicep curl', 3, 12]] },
    { name: 'Legs', exercises: [['Squat', 3, 8], ['Romanian deadlift', 3, 10], ['Leg press', 3, 12], ['Calf raise', 3, 15]] },
  ] },
  { name: 'Upper / Lower', routines: [
    { name: 'Upper', exercises: [['Bench press', 3, 8], ['Barbell row', 3, 8], ['Overhead press', 3, 10], ['Lat pulldown', 3, 10]] },
    { name: 'Lower', exercises: [['Squat', 3, 8], ['Romanian deadlift', 3, 10], ['Lunge', 3, 10], ['Calf raise', 3, 15]] },
  ] },
  { name: 'Full body', routines: [
    { name: 'Full body', exercises: [['Squat', 3, 8], ['Bench press', 3, 8], ['Barbell row', 3, 8], ['Overhead press', 3, 10]] },
  ] },
];

export const fromTemplate = (t: Template, unit: WeightUnit, newId: () => string): WorkoutPlan => ({
  unit, restSeconds: DEFAULT_REST,
  routines: t.routines.map(r => ({
    id: newId(), name: r.name,
    exercises: r.exercises.map(([name, sets, reps]) => ({ id: newId(), name, sets, reps })),
  })),
});

/** Routines worth keeping: named, with at least one named exercise. */
export const cleanPlan = (plan: WorkoutPlan): WorkoutPlan => ({
  unit: plan.unit,
  restSeconds: plan.restSeconds ?? DEFAULT_REST,
  routines: plan.routines
    .map(r => ({ ...r, name: r.name.trim(), exercises: r.exercises.map(e => ({ ...e, name: e.name.trim() })).filter(e => e.name) }))
    .filter(r => r.exercises.length > 0)
    .map((r, i) => ({ ...r, name: r.name || `Workout ${String.fromCharCode(65 + i)}` })),
});

// ── History ──────────────────────────────────────────────────────────────────

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The last time an exercise was done (in any routine): its sets and unit. */
export const lastTime = (log: WorkoutLog[], name: string): { date: string; unit: WeightUnit; sets: SetLog[] } | null => {
  for (let i = log.length - 1; i >= 0; i--) {
    const ex = log[i].exercises.find(e => sameName(e.name, name));
    if (ex && ex.sets.length > 0) return { date: log[i].date, unit: log[i].unit, sets: ex.sets };
  }
  return null;
};

/** The routine after the habit's last workout (the first, if none or it's gone). */
export const nextRoutine = (plan: WorkoutPlan, log: WorkoutLog[], habitId: string): Routine | null => {
  if (plan.routines.length === 0) return null;
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].habitId !== habitId) continue;
    const at = plan.routines.findIndex(r => r.id === log[i].routineId);
    if (at >= 0) return plan.routines[(at + 1) % plan.routines.length];
    break;
  }
  return plan.routines[0];
};

export const logWorkout = (log: WorkoutLog[], w: WorkoutLog): WorkoutLog[] =>
  [...log, w].sort((a, b) => a.startedAt - b.startedAt).slice(-KEEP_WORKOUTS);

// ── Numbers ──────────────────────────────────────────────────────────────────

const round = (n: number, step: number) => Math.round(n / step) * step;

export const convertWeight = (w: number, from: WeightUnit, to: WeightUnit) =>
  from === to ? w : round(from === 'kg' ? w * 2.20462 : w / 2.20462, 0.5);

/** "62.5", or "" for none. */
export const weightText = (w: number | null) => (w === null ? '' : String(Math.round(w * 100) / 100));

export const parseWeight = (text: string): number | null => {
  const n = Number(text.replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(n) && n > 0 ? Math.min(n, 2000) : null;
};

export const parseReps = (text: string): number => {
  const n = Math.floor(Number(text));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 999) : 0;
};

/** "60 kg × 8, 8, 7", "60 × 8, 55 × 10 kg", "12, 10, 8 reps". */
export const setsLabel = (sets: SetLog[], unit: WeightUnit): string => {
  if (sets.length === 0) return '';
  if (sets.every(s => s.weight === null)) return `${sets.map(s => s.reps).join(', ')} reps`;
  const weights = new Set(sets.map(s => s.weight));
  if (weights.size === 1) return `${weightText(sets[0].weight)} ${unit} × ${sets.map(s => s.reps).join(', ')}`;
  return `${sets.map(s => (s.weight === null ? `${s.reps}` : `${weightText(s.weight)} × ${s.reps}`)).join(', ')} ${unit}`;
};

export const workoutTotals = (w: WorkoutLog) => {
  const sets = w.exercises.flatMap(e => e.sets);
  return {
    minutes: Math.max(1, Math.round((w.endedAt - w.startedAt) / 60_000)),
    sets: sets.length,
    /** Weight lifted, sets × reps × weight (bodyweight sets aside). */
    volume: Math.round(sets.reduce((sum, s) => sum + (s.weight ?? 0) * s.reps, 0)),
  };
};

// ── Progress (Pro) ───────────────────────────────────────────────────────────

/** Estimated one-rep max (Epley): a fair way to compare 5 heavy reps with 10 lighter ones. */
export const oneRepMax = (weight: number, reps: number) => (reps <= 1 ? weight : weight * (1 + reps / 30));

export type ExercisePoint = {
  date: string;
  /** The heaviest set, and the best estimated one-rep max, in the unit asked for. */
  top: SetLog;
  e1rm: number;
  /** Most reps in a set (for bodyweight exercises). */
  reps: number;
};

/** Each workout an exercise was done in, oldest first, weights in `unit`. */
export const exerciseHistory = (log: WorkoutLog[], name: string, unit: WeightUnit): ExercisePoint[] =>
  log.flatMap(w => {
    const ex = w.exercises.find(e => sameName(e.name, name));
    if (!ex || ex.sets.length === 0) return [];
    const sets = ex.sets.map(s => ({ weight: s.weight === null ? null : convertWeight(s.weight, w.unit, unit), reps: s.reps }));
    const top  = sets.reduce((a, b) => ((b.weight ?? 0) > (a.weight ?? 0) || ((b.weight ?? 0) === (a.weight ?? 0) && b.reps > a.reps) ? b : a));
    return [{
      date: w.date, top,
      e1rm: Math.round(Math.max(...sets.map(s => (s.weight === null ? 0 : oneRepMax(s.weight, s.reps)))) * 10) / 10,
      reps: Math.max(...sets.map(s => s.reps)),
    }];
  });

export type ExerciseSummary = {
  name: string;
  times: number;
  last: ExercisePoint;
  /** Personal bests: heaviest set, best estimated one-rep max, most reps. */
  heaviest: ExercisePoint | null;
  bestE1rm: ExercisePoint | null;
  mostReps: ExercisePoint;
  /** Weighted, or done with bodyweight only. */
  weighted: boolean;
};

/** Every exercise a habit's workouts have had, most recently done first. */
export const exerciseSummaries = (log: WorkoutLog[], habitId: string, unit: WeightUnit): ExerciseSummary[] => {
  const mine  = log.filter(w => w.habitId === habitId);
  const names = new Map<string, string>();
  for (let i = mine.length - 1; i >= 0; i--) for (const e of mine[i].exercises) {
    const key = e.name.trim().toLowerCase();
    if (!names.has(key)) names.set(key, e.name.trim());
  }
  return [...names.values()].map(name => {
    const points   = exerciseHistory(mine, name, unit);
    const weighted = points.some(p => p.top.weight !== null);
    const best = (score: (p: ExercisePoint) => number) => points.reduce((a, b) => (score(b) > score(a) ? b : a));
    return {
      name, times: points.length, last: points[points.length - 1], weighted,
      heaviest: weighted ? best(p => p.top.weight ?? 0) : null,
      bestE1rm: weighted ? best(p => p.e1rm) : null,
      mostReps: best(p => p.reps),
    };
  });
};

/** Personal bests a finished workout set: "Bench press: 62.5 kg" (heaviest set beaten). */
export const newBests = (log: WorkoutLog[], w: WorkoutLog): { name: string; label: string }[] => {
  const before = log.filter(x => x.id !== w.id && x.habitId === w.habitId && x.startedAt < w.startedAt);
  return w.exercises.flatMap(e => {
    const prev = exerciseHistory(before, e.name, w.unit);
    if (prev.length === 0) return [];
    const now = exerciseHistory([w], e.name, w.unit)[0];
    if (!now) return [];
    if (now.top.weight !== null) {
      const heaviest = Math.max(...prev.map(p => p.top.weight ?? 0));
      return now.top.weight > heaviest ? [{ name: e.name, label: `${weightText(now.top.weight)} ${w.unit} × ${now.top.reps}` }] : [];
    }
    const most = Math.max(...prev.map(p => p.reps));
    return now.reps > most && prev.every(p => p.top.weight === null) ? [{ name: e.name, label: `${now.reps} reps` }] : [];
  });
};

/**
 * Whether any workout beat a personal best (as newBests counts them), in one pass: a heavier
 * top set, or more reps for an exercise only ever done with bodyweight.
 */
export const hadPersonalBest = (log: WorkoutLog[]): boolean => {
  const best = new Map<string, { kg: number; weighted: boolean; reps: number }>();
  for (const w of [...log].sort((a, b) => a.startedAt - b.startedAt)) {
    for (const e of w.exercises) {
      if (e.sets.length === 0) continue;
      const key  = `${w.habitId}\n${e.name.trim().toLowerCase()}`;
      const kgs  = e.sets.filter(s => s.weight !== null).map(s => convertWeight(s.weight!, w.unit, 'kg'));
      const top  = kgs.length > 0 ? Math.max(...kgs) : null;
      const reps = Math.max(...e.sets.map(s => s.reps));
      const prev = best.get(key);
      if (prev && (top !== null ? top > prev.kg : !prev.weighted && reps > prev.reps)) return true;
      best.set(key, {
        kg: Math.max(prev?.kg ?? 0, top ?? 0), weighted: !!prev?.weighted || top !== null, reps: Math.max(prev?.reps ?? 0, reps),
      });
    }
  }
  return false;
};

// ── A workout in progress ────────────────────────────────────────────────────

/** A workout of `routine`, each set filled in from the last time (weights) and the plan (reps). */
export const startWorkout = (
  habit: Commission & { workout: WorkoutPlan }, routine: Routine, log: WorkoutLog[], now: number, id: string,
): ActiveWorkout => ({
  id, habitId: habit.id, label: habit.label, routineId: routine.id, routineName: routine.name, unit: habit.workout.unit,
  startedAt: now, updatedAt: now, restSeconds: habit.workout.restSeconds ?? DEFAULT_REST,
  exercises: routine.exercises.map(e => {
    const last = lastTime(log, e.name);
    const weightAt = (i: number) => {
      const s = last && (last.sets[i] ?? last.sets[last.sets.length - 1]);
      return s && s.weight !== null ? weightText(convertWeight(s.weight, last.unit, habit.workout.unit)) : '';
    };
    return { name: e.name, sets: Array.from({ length: e.sets }, (_, i) => ({ weight: weightAt(i), reps: String(e.reps), done: false })) };
  }),
});

const touch = (w: ActiveWorkout, exercises: LiveExercise[], now: number): ActiveWorkout => ({ ...w, exercises, updatedAt: now });

const mapExercise = (w: ActiveWorkout, ex: number, change: (e: LiveExercise) => LiveExercise, now: number) =>
  touch(w, w.exercises.map((e, i) => (i === ex ? change(e) : e)), now);

export const editSet = (w: ActiveWorkout, ex: number, set: number, field: 'weight' | 'reps', value: string, now: number) =>
  mapExercise(w, ex, e => ({ ...e, sets: e.sets.map((s, i) => (i === set ? { ...s, [field]: value } : s)) }), now);

/** Ticks a set off (or back on). Ticking one off fills in the next sets' empty weights. */
/**
 * Ticks a set off (or back on). Ticking one off fills in the next sets' empty weights and
 * starts a rest, unless it was the last set; ticking that set back on cancels its rest.
 */
export const toggleSet = (w: ActiveWorkout, ex: number, set: number, now: number): ActiveWorkout => {
  const done = !w.exercises[ex].sets[set].done;
  const next = mapExercise(w, ex, e => {
    const weight = e.sets[set].weight;
    return { ...e, sets: e.sets.map((s, i) => (i === set ? { ...s, done } : done && i > set && !s.done && s.weight === '' ? { ...s, weight } : s)) };
  }, now);
  const { rest, ...rested } = next;
  if (done) {
    return next.restSeconds > 0 && nextUp(next)
      ? { ...rested, rest: { endsAt: now + next.restSeconds * 1000, seconds: next.restSeconds, ex, set } }
      : rested;
  }
  return rest && rest.ex === ex && rest.set === set ? rested : next;
};

// ── Resting ──────────────────────────────────────────────────────────────────

/** The next set to do: the first one not ticked off, after the last one ticked off if any. */
export const nextUp = (w: ActiveWorkout): { ex: number; set: number; name: string; of: number } | null => {
  const flat = w.exercises.flatMap((e, ex) => e.sets.map((s, set) => ({ ex, set, done: s.done, name: e.name, of: e.sets.length })));
  const lastDone = flat.map(x => x.done).lastIndexOf(true);
  const pick = flat.slice(lastDone + 1).find(x => !x.done) ?? flat.find(x => !x.done);
  return pick ? { ex: pick.ex, set: pick.set, name: pick.name, of: pick.of } : null;
};

/** ms left of the rest (0 once it's over), or null when there's none. */
export const restLeft = (w: ActiveWorkout, now: number): number | null =>
  w.rest ? Math.max(0, w.rest.endsAt - now) : null;

/** Longer or shorter by `seconds` (it ends when it would go below zero). */
export const adjustRest = (w: ActiveWorkout, seconds: number, now: number): ActiveWorkout => {
  if (!w.rest) return w;
  const endsAt = Math.min(w.rest.endsAt + seconds * 1000, now + MAX_REST * 1000);
  return { ...w, updatedAt: now, rest: { ...w.rest, endsAt: Math.max(endsAt, now), seconds: Math.max(0, w.rest.seconds + seconds) } };
};

export const endRest = (w: ActiveWorkout): ActiveWorkout => {
  const { rest, ...rested } = w;
  return rest ? rested : w;
};

/** One more set, like the last one. */
export const addSet = (w: ActiveWorkout, ex: number, now: number) =>
  mapExercise(w, ex, e => {
    if (e.sets.length >= MAX_SETS) return e;
    const last = e.sets[e.sets.length - 1];
    return { ...e, sets: [...e.sets, { weight: last?.weight ?? '', reps: last?.reps ?? '10', done: false }] };
  }, now);

/** One set fewer: the last one, unless it's the only one. */
export const removeSet = (w: ActiveWorkout, ex: number, now: number) =>
  mapExercise(w, ex, e => (e.sets.length > 1 ? { ...e, sets: e.sets.slice(0, -1) } : e), now);

export const setsDone = (w: ActiveWorkout) => w.exercises.reduce((n, e) => n + e.sets.filter(s => s.done).length, 0);

/** The finished workout: its ticked-off sets with reps. Null if there are none. */
export const finishWorkout = (w: ActiveWorkout, now: number): WorkoutLog | null => {
  const endedAt = Math.max(now, w.startedAt);
  const exercises = w.exercises
    .map(e => ({ name: e.name, sets: e.sets.filter(s => s.done && parseReps(s.reps) > 0).map(s => ({ weight: parseWeight(s.weight), reps: parseReps(s.reps) })) }))
    .filter(e => e.sets.length > 0);
  if (exercises.length === 0) return null;
  return {
    id: w.id, habitId: w.habitId, routineId: w.routineId, routineName: w.routineName,
    date: dayKeyAt(endedAt), startedAt: w.startedAt, endedAt, unit: w.unit, exercises,
  };
};

/**
 * A workout left alone for 12 hours was forgotten: it's finished as of its last change if
 * anything was ticked off, or dropped. Otherwise it carries on.
 */
export const settleWorkout = (w: ActiveWorkout | null, now: number): { active: ActiveWorkout | null; finished: WorkoutLog | null } => {
  if (!w || now - w.updatedAt < FORGOTTEN_MS) return { active: w, finished: null };
  return { active: null, finished: finishWorkout(w, w.updatedAt) };
};

/** The check-off a finished workout makes, on the day it finished (inbox.ts). */
export const workoutEvent = (w: WorkoutLog) => ({ id: `workout-${w.id}`, kind: 'habit' as const, date: w.date, habitId: w.habitId });

// ── Stored data ──────────────────────────────────────────────────────────────

const isUnit = (u: unknown): u is WeightUnit => u === 'kg' || u === 'lb';

export const parseWorkoutLog = (raw: unknown): WorkoutLog[] =>
  Array.isArray(raw)
    ? raw.filter((w): w is WorkoutLog => !!w && typeof w.id === 'string' && typeof w.habitId === 'string' && typeof w.date === 'string'
        && typeof w.startedAt === 'number' && isUnit(w.unit) && Array.isArray(w.exercises))
    : [];

export const parseActiveWorkout = (raw: unknown): ActiveWorkout | null => {
  const w = raw as ActiveWorkout | null;
  return w && typeof w.id === 'string' && typeof w.habitId === 'string' && typeof w.startedAt === 'number'
    && typeof w.updatedAt === 'number' && isUnit(w.unit) && Array.isArray(w.exercises)
    ? { ...w, restSeconds: typeof w.restSeconds === 'number' ? w.restSeconds : DEFAULT_REST }
    : null;
};

// ── For Bonbon ───────────────────────────────────────────────────────────────

export type WorkoutOverview = {
  /** When this was worked out (ms), for the workout in progress. */
  at: number;
  /** The workout in progress. */
  running: {
    label: string; routineName: string; minutes: number; setsDone: number;
    /** "Bench press, set 2 of 3", or null when every set's ticked off. */
    next: string | null;
    /** Seconds of rest left, if a rest is running. */
    restLeft: number | null;
  } | null;
  /** Habits with workouts: their routines in turn, the next one up, unit and rest. */
  habits: { label: string; routines: string[]; next: string | null; unit: WeightUnit; restSeconds: number }[];
  /** Workouts in the last 7 days (today included), newest first, and how many the 7 before had. */
  recent: { date: string; label: string; routineName: string; minutes: number; sets: number; volume: number; unit: WeightUnit }[];
  prevWeekCount: number;
  /** The exercises done most recently (up to 8 a habit): last time and best, in the habit's unit. */
  exercises: { habit: string; name: string; unit: WeightUnit; times: number; last: string; best: string | null }[];
};

/** The workouts at a glance, for Bonbon's chat; null if workouts were never set up or done. */
export const workoutOverview = (
  log: WorkoutLog[], active: ActiveWorkout | null, habits: Commission[], todayKey: string, now: number,
): WorkoutOverview | null => {
  const planned = habits.filter((h): h is Commission & { workout: WorkoutPlan } => !!h.workout);
  if (planned.length === 0 && log.length === 0 && !active) return null;
  const labels = new Map(habits.map(h => [h.id, h.label]));
  const from   = addDaysToKey(todayKey, -6);
  const up     = active && nextUp(active);
  return {
    at: now,
    running: active && {
      label: active.label, routineName: active.routineName,
      minutes: Math.max(0, Math.round((now - active.startedAt) / 60_000)),
      setsDone: setsDone(active),
      next: up ? `${up.name}, set ${up.set + 1} of ${up.of}` : null,
      restLeft: (() => { const l = restLeft(active, now); return l ? Math.ceil(l / 1000) : null; })(),
    },
    habits: planned.map(h => ({
      label: h.label, routines: h.workout.routines.map(r => r.name), next: nextRoutine(h.workout, log, h.id)?.name ?? null,
      unit: h.workout.unit, restSeconds: h.workout.restSeconds ?? DEFAULT_REST,
    })),
    recent: log.filter(w => w.date >= from && w.date <= todayKey).reverse().map(w => ({
      date: w.date, label: labels.get(w.habitId) ?? 'A deleted habit', routineName: w.routineName, unit: w.unit, ...workoutTotals(w),
    })),
    prevWeekCount: log.filter(w => w.date >= addDaysToKey(from, -7) && w.date < from).length,
    exercises: planned.flatMap(h => {
      const mine = log.filter(w => w.habitId === h.id);
      const unit = h.workout.unit;
      return exerciseSummaries(mine, h.id, unit).slice(0, 8).map(s => {
        const last = lastTime(mine, s.name)!;
        return {
          habit: h.label, name: s.name, unit, times: s.times,
          last: setsLabel(last.sets.map(x => ({ ...x, weight: x.weight === null ? null : convertWeight(x.weight, last.unit, unit) })), unit),
          best: s.heaviest ? `${weightText(s.heaviest.top.weight)} ${unit} × ${s.heaviest.top.reps}` : s.times > 1 ? `${s.mostReps.reps} reps` : null,
        };
      });
    }),
  };
};
