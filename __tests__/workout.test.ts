import {
  addSet, cleanPlan, convertWeight, editSet, exerciseSummaries, finishWorkout, fromTemplate, lastTime, logWorkout, newBests, nextRoutine, parseWeight,
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
