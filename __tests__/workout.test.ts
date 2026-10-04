import {
  addSet, adjustRest, cleanPlan, endRest, nextUp, parseActiveWorkout, restLeft, convertWeight, editSet, exerciseSummaries, finishWorkout, fromTemplate, lastTime, logWorkout, newBests, nextRoutine, parseWeight, workoutOverview,
  removeSet, ROUTINE_TEMPLATES, setsLabel, settleWorkout, startWorkout, toggleSet, workoutEvent, workoutTotals,
  type WorkoutLog, type WorkoutPlan,
} from '../src/workout';
import type { Commission } from '../src/types';

const at = (day: string, hour: number, minute = 0) => new Date(`${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`).getTime();
const HOUR = 3_600_000;

const plan: WorkoutPlan = {
  unit: 'kg',
  routines: [
    { id: 'push', name: 'Push', exercises: [{ id: 'b', name: 'Bench press', sets: 3, reps: 8 }, { id: 'd', name: 'Dips', sets: 2, reps: 10 }] },
    { id: 'pull', name: 'Pull', exercises: [{ id: 'r', name: 'Barbell row', sets: 3, reps: 8 }] },
    { id: 'legs', name: 'Legs', exercises: [{ id: 's', name: 'Squat', sets: 3, reps: 5 }] },
  ],
};
const gym = (over: Partial<Commission> = {}): Commission & { workout: WorkoutPlan } => ({
  id: 'gym', label: 'Gym', completed: false, days: [], reminderTime: null, timesPerDay: 1, completionCount: 0,
  reminderTimes: [], reminderSplit: null, perWeek: 3, workout: plan, ...over,
});
const logged = (over: Partial<WorkoutLog>): WorkoutLog => ({
  id: 'w', habitId: 'gym', routineId: 'push', routineName: 'Push', date: '2026-09-28', startedAt: at('2026-09-28', 18),
  endedAt: at('2026-09-28', 19), unit: 'kg', exercises: [], ...over,
});

describe('routines', () => {
  it('take turns, after the habit’s last workout', () => {
    expect(nextRoutine(plan, [], 'gym')?.name).toBe('Push');
    const log = [logged({ routineId: 'push' }), logged({ routineId: 'pull', startedAt: at('2026-09-30', 18) }), logged({ habitId: 'run', routineId: 'x', startedAt: at('2026-10-01', 7) })];
    expect(nextRoutine(plan, log, 'gym')?.name).toBe('Legs');
    expect(nextRoutine(plan, [logged({ routineId: 'legs' })], 'gym')?.name).toBe('Push');
    expect(nextRoutine(plan, [logged({ routineId: 'deleted' })], 'gym')?.name).toBe('Push');
  });

  it('start from a template, and drop empty routines and exercises', () => {
    let n = 0;
    const ppl = fromTemplate(ROUTINE_TEMPLATES[0], 'lb', () => `id${n++}`);
    expect(ppl.routines.map(r => r.name)).toEqual(['Push', 'Pull', 'Legs']);
    expect(ppl.unit).toBe('lb');
    const cleaned = cleanPlan({ unit: 'kg', routines: [
      { id: 'a', name: '  ', exercises: [{ id: 'x', name: ' Squat ', sets: 3, reps: 5 }, { id: 'y', name: '', sets: 3, reps: 5 }] },
      { id: 'b', name: 'Empty', exercises: [{ id: 'z', name: ' ', sets: 3, reps: 5 }] },
    ] });
    expect(cleaned.routines).toEqual([{ id: 'a', name: 'Workout A', exercises: [{ id: 'x', name: 'Squat', sets: 3, reps: 5 }] }]);
  });
});

describe('a workout', () => {
  const lastBench = logged({ exercises: [{ name: 'bench press', sets: [{ weight: 60, reps: 8 }, { weight: 62.5, reps: 6 }] }] });

  it('fills in last time’s weights and the planned reps', () => {
    const w = startWorkout(gym(), plan.routines[0], [lastBench], at('2026-10-01', 18), 'w2');
    expect(w.exercises[0].sets).toEqual([
      { weight: '60', reps: '8', done: false }, { weight: '62.5', reps: '8', done: false }, { weight: '62.5', reps: '8', done: false },
    ]);
    expect(w.exercises[1].sets).toEqual([{ weight: '', reps: '10', done: false }, { weight: '', reps: '10', done: false }]);
    // In pounds, last time's kilos are converted.
    const lb = startWorkout(gym({ workout: { ...plan, unit: 'lb' } }), plan.routines[0], [lastBench], 0, 'w3');
    expect(lb.exercises[0].sets[0].weight).toBe('132.5');
  });

  it('ticks sets off, passing a weight on to empty sets, and adds or removes sets', () => {
    let w = startWorkout(gym(), plan.routines[0], [], at('2026-10-01', 18), 'w2');
    w = editSet(w, 0, 0, 'weight', '40', 1);
    w = toggleSet(w, 0, 0, 2);
    expect(w.exercises[0].sets.map(s => [s.weight, s.done])).toEqual([['40', true], ['40', false], ['40', false]]);
    expect(w.updatedAt).toBe(2);
    w = addSet(w, 1, 3);
    expect(w.exercises[1].sets).toHaveLength(3);
    w = removeSet(removeSet(removeSet(w, 1, 4), 1, 5), 1, 6);
    expect(w.exercises[1].sets).toHaveLength(1); // never fewer than one
  });

  it('finishes with the sets ticked off, checking the habit off on the day it finished', () => {
    let w = startWorkout(gym(), plan.routines[0], [lastBench], at('2026-10-01', 23, 30), 'w2');
    expect(finishWorkout(w, at('2026-10-02', 0, 30))).toBeNull(); // nothing done yet
    w = toggleSet(toggleSet(w, 0, 0, 0), 0, 1, 0);
    w = toggleSet(editSet(w, 1, 0, 'reps', '12', 0), 1, 0, 0);
    const done = finishWorkout(w, at('2026-10-02', 0, 30))!;
    expect(done.exercises).toEqual([
      { name: 'Bench press', sets: [{ weight: 60, reps: 8 }, { weight: 62.5, reps: 8 }] },
      { name: 'Dips', sets: [{ weight: null, reps: 12 }] },
    ]);
    expect(done.date).toBe('2026-10-02');
    expect(workoutEvent(done)).toEqual({ id: 'workout-w2', kind: 'habit', date: '2026-10-02', habitId: 'gym' });
    expect(workoutTotals(done)).toEqual({ minutes: 60, sets: 3, volume: 60 * 8 + 62.5 * 8 });
    expect(lastTime(logWorkout([lastBench], done), 'Bench Press')?.sets).toHaveLength(2);
  });

  it('closes a workout left alone for 12 hours', () => {
    const w = toggleSet(startWorkout(gym(), plan.routines[0], [], at('2026-10-01', 18), 'w2'), 0, 0, at('2026-10-01', 18, 10));
    expect(settleWorkout(w, at('2026-10-01', 23)).active).toBe(w);
    const r = settleWorkout(w, at('2026-10-02', 7));
    expect(r.active).toBeNull();
    expect(r.finished).toMatchObject({ endedAt: at('2026-10-01', 18, 10), exercises: [{ name: 'Bench press', sets: [{ weight: null, reps: 8 }] }] });
    expect(settleWorkout(startWorkout(gym(), plan.routines[0], [], 0, 'w4'), 13 * HOUR)).toEqual({ active: null, finished: null });
  });
});

describe('resting', () => {
  const start = at('2026-10-01', 18);
  const fresh = () => startWorkout(gym(), plan.routines[0], [], start, 'w2');

  it('starts a rest when a set is ticked off, with the next set lined up', () => {
    const w = toggleSet(fresh(), 0, 0, start);
    expect(w.rest).toEqual({ endsAt: start + 90_000, seconds: 90, ex: 0, set: 0 });
    expect(nextUp(w)).toEqual({ ex: 0, set: 1, name: 'Bench press', of: 3 });
    expect(restLeft(w, start + 30_000)).toBe(60_000);
    expect(restLeft(w, start + 200_000)).toBe(0);
    expect(restLeft(endRest(w), start)).toBeNull();
  });

  it('cancels the rest when that set is ticked back on, and skips it after the last set', () => {
    const w = toggleSet(fresh(), 0, 0, start);
    expect(toggleSet(w, 0, 0, start).rest).toBeUndefined();
    let all = fresh();
    all.exercises.forEach((e, ex) => e.sets.forEach((_, set) => { all = toggleSet(all, ex, set, start); }));
    expect(all.rest).toBeUndefined(); // nothing left to rest for
    expect(nextUp(all)).toBeNull();
  });

  it('can be made longer or shorter, and turned off', () => {
    const w = toggleSet(fresh(), 0, 0, start);
    expect(adjustRest(w, 15, start).rest).toMatchObject({ endsAt: start + 105_000, seconds: 105 });
    expect(adjustRest(w, -120, start).rest?.endsAt).toBe(start);
    const none = toggleSet(startWorkout(gym({ workout: { ...plan, restSeconds: 0 } }), plan.routines[0], [], start, 'w3'), 0, 0, start);
    expect(none.rest).toBeUndefined();
  });

  it('reads older stored workouts with the default rest', () => {
    const { restSeconds, ...old } = fresh();
    expect(parseActiveWorkout(old)?.restSeconds).toBe(90);
  });
});

describe('progress', () => {
  const bench = (id: string, day: string, unit: 'kg' | 'lb', sets: [number | null, number][], habitId = 'gym') => logged({
    id, habitId, date: day, startedAt: at(day, 18), endedAt: at(day, 19), unit,
    exercises: [{ name: 'Bench press', sets: sets.map(([weight, reps]) => ({ weight, reps })) }, { name: 'Pull-up', sets: [{ weight: null, reps: Number(id.slice(1)) + 5 }] }],
  });
  const log = [
    bench('w1', '2026-09-21', 'kg', [[60, 8], [60, 7]]),
    bench('w2', '2026-09-24', 'kg', [[65, 5], [60, 8]]),
    bench('w3', '2026-09-28', 'lb', [[135, 10]]), // 61 kg × 10: the best estimated one-rep max
    bench('w4', '2026-09-29', 'kg', [[100, 1]], 'other'),
  ];

  it('sums up each exercise in the habit’s unit, most recent first', () => {
    const [b, p] = exerciseSummaries(log, 'gym', 'kg');
    expect(b).toMatchObject({ name: 'Bench press', times: 3, weighted: true, last: { date: '2026-09-28', top: { weight: 61, reps: 10 } } });
    expect(b.heaviest?.top).toEqual({ weight: 65, reps: 5 });
    expect(b.bestE1rm?.date).toBe('2026-09-28');
    expect(b.bestE1rm?.e1rm).toBe(81.3);
    expect(p).toMatchObject({ name: 'Pull-up', weighted: false, heaviest: null, mostReps: { reps: 8 } });
  });

  it('spots new personal bests', () => {
    const next = bench('w5', '2026-10-01', 'kg', [[67.5, 4]]);
    expect(newBests(logWorkout(log, next), next)).toEqual([{ name: 'Bench press', label: '67.5 kg × 4' }, { name: 'Pull-up', label: '10 reps' }]);
    expect(newBests(log, log[0])).toEqual([]); // nothing to beat the first time
  });
});

describe('workoutOverview', () => {
  const log = [
    logged({ id: 'w0', date: '2026-09-22', startedAt: at('2026-09-22', 18), endedAt: at('2026-09-22', 19), exercises: [{ name: 'Bench press', sets: [{ weight: 55, reps: 8 }] }] }),
    logged({ id: 'w1', date: '2026-09-28', startedAt: at('2026-09-28', 18), endedAt: at('2026-09-28', 18, 50), exercises: [{ name: 'Bench press', sets: [{ weight: 60, reps: 8 }, { weight: 60, reps: 7 }] }] }),
    logged({ id: 'w2', routineId: 'pull', routineName: 'Pull', date: '2026-09-30', startedAt: at('2026-09-30', 18), endedAt: at('2026-09-30', 18, 40),
      exercises: [{ name: 'Pull-up', sets: [{ weight: null, reps: 8 }, { weight: null, reps: 6 }] }] }),
  ];

  it('sums up routines, recent workouts and lifts', () => {
    const o = workoutOverview(log, null, [gym()], '2026-10-01', at('2026-10-01', 9))!;
    expect(o.running).toBeNull();
    expect(o.habits).toEqual([{ label: 'Gym', routines: ['Push', 'Pull', 'Legs'], next: 'Legs', unit: 'kg', restSeconds: 90 }]);
    expect(o.recent.map(r => [r.routineName, r.minutes, r.sets, r.volume])).toEqual([['Pull', 40, 2, 0], ['Push', 50, 2, 900]]);
    expect(o.prevWeekCount).toBe(1);
    expect(o.exercises).toEqual([
      { habit: 'Gym', name: 'Pull-up', unit: 'kg', times: 1, last: '8, 6 reps', best: null },
      { habit: 'Gym', name: 'Bench press', unit: 'kg', times: 2, last: '60 kg × 8, 7', best: '60 kg × 8' },
    ]);
  });

  it('describes the workout in progress', () => {
    const start = at('2026-10-01', 18);
    const w = toggleSet(startWorkout(gym(), plan.routines[2], log, start, 'w3'), 0, 0, start + 600_000);
    expect(workoutOverview(log, w, [gym()], '2026-10-01', start + 630_000)?.running)
      .toEqual({ label: 'Gym', routineName: 'Legs', minutes: 11, setsDone: 1, next: 'Squat, set 2 of 3', restLeft: 60 });
  });

  it('is null when workouts were never set up or done', () => {
    expect(workoutOverview([], null, [{ ...gym(), workout: undefined }], '2026-10-01', 0)).toBeNull();
  });
});

describe('numbers', () => {
  it('parse and label', () => {
    expect(parseWeight('62,5')).toBe(62.5);
    expect(parseWeight('')).toBeNull();
    expect(parseWeight('0')).toBeNull();
    expect(convertWeight(100, 'lb', 'kg')).toBe(45.5);
    expect(setsLabel([{ weight: 60, reps: 8 }, { weight: 60, reps: 7 }], 'kg')).toBe('60 kg × 8, 7');
    expect(setsLabel([{ weight: 60, reps: 8 }, { weight: 55, reps: 10 }], 'lb')).toBe('60 × 8, 55 × 10 lb');
    expect(setsLabel([{ weight: null, reps: 12 }, { weight: null, reps: 10 }], 'kg')).toBe('12, 10 reps');
  });
});
