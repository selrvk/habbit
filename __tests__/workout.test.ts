import {
  addSet, adjustRest, cleanPlan, endRest, nextUp, parseActiveWorkout, restLeft, convertWeight, editSet, exerciseSummaries, finishWorkout, fromTemplate, lastTime, logWorkout, newBests, nextRoutine, parseWeight, workoutOverview,
  removeSet, ROUTINE_TEMPLATES, setsLabel, settleWorkout, startWorkout, toggleSet, workoutEvent, workoutTotals,
  type WorkoutLog, type WorkoutPlan,
  cancelHold, hadPersonalBest, holdElapsed, holdText, newExercise, planText, startHold, stepHold, stopHold, setsDone,
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

describe('timed exercises', () => {
  const core: WorkoutPlan = {
    unit: 'kg', restSeconds: 60,
    routines: [{ id: 'core', name: 'Core', exercises: [{ id: 'p', name: 'Plank', sets: 3, reps: 10, seconds: 60 }, { id: 'c', name: 'Crunch', sets: 2, reps: 15 }] }],
  };
  const start = at('2026-10-01', 18);
  const begin = (log: WorkoutLog[] = []) => startWorkout(gym({ workout: core }), core.routines[0], log, start, 'w1');
  const held  = (id: string, day: string, seconds: number[], weight: number | null = null) => logged({
    id, date: day, startedAt: at(day, 18), endedAt: at(day, 19), routineId: 'core', routineName: 'Core',
    exercises: [{ name: 'Plank', sets: seconds.map(sec => ({ weight, reps: 0, seconds: sec })) }],
  });

  it('are suggested with a hold, and step by 5 seconds, then 15', () => {
    expect(newExercise('Plank', 'x')).toEqual({ id: 'x', name: 'Plank', sets: 3, reps: 10, seconds: 60 });
    expect(newExercise('Squat', 'y')).toEqual({ id: 'y', name: 'Squat', sets: 3, reps: 10 });
    expect([stepHold(30, true), stepHold(60, true), stepHold(75, false), stepHold(60, false)]).toEqual([35, 75, 60, 55]);
    expect([stepHold(5, false), stepHold(600, true)]).toEqual([5, 600]);
    expect([holdText(45), holdText(60), holdText(150)]).toEqual(['0:45', '1:00', '2:30']);
    expect([planText(newExercise('Plank', 'x')), planText(newExercise('Squat', 'y'))]).toEqual(['Plank 3×1:00', 'Squat 3×10']);
    // A routine keeps a sensible hold, or goes back to reps.
    const cleaned = cleanPlan({ unit: 'kg', routines: [{ id: 'r', name: 'Core', exercises: [
      { id: 'a', name: 'Plank', sets: 3, reps: 10, seconds: 2000 }, { id: 'b', name: 'Crunch', sets: 2, reps: 15, seconds: 0 },
    ] }] });
    expect(cleaned.routines[0].exercises).toEqual([{ id: 'a', name: 'Plank', sets: 3, reps: 10, seconds: 600 }, { id: 'b', name: 'Crunch', sets: 2, reps: 15 }]);
  });

  it('start with their seconds where reps would be', () => {
    const w = begin();
    expect(w.exercises[0]).toEqual({ name: 'Plank', timed: true, sets: Array(3).fill({ weight: '', reps: '60', done: false }) });
    expect(w.exercises[1].timed).toBeUndefined();
  });

  it('time a hold: stopping saves how long it was, ticks the set off and starts the rest', () => {
    const holding = startHold(begin(), 0, 0, start + 1000);
    expect(holding.hold).toEqual({ ex: 0, set: 0, startedAt: start + 1000, target: 60 });
    expect(holdElapsed(holding, start + 24_500)).toBe(23);
    const stopped = stopHold(holding, start + 68_400);
    expect(stopped.hold).toBeUndefined();
    expect(stopped.exercises[0].sets[0]).toEqual({ weight: '', reps: '67', done: true });
    expect(stopped.rest).toMatchObject({ ex: 0, set: 0, seconds: 60 });
    expect(setsDone(stopped)).toBe(1);
    // Ticking the set that's being held stops its timer the same way.
    expect(toggleSet(holding, 0, 0, start + 31_000).exercises[0].sets[0]).toEqual({ weight: '', reps: '30', done: true });
  });

  it('end a rest when a hold starts, and only time sets that can be', () => {
    const resting = toggleSet(begin(), 1, 0, start);
    expect(resting.rest).toBeDefined();
    const holding = startHold(resting, 0, 0, start + 5000);
    expect(holding.rest).toBeUndefined();
    expect(holding.hold?.set).toBe(0);
    expect(startHold(begin(), 1, 0, start).hold).toBeUndefined();          // counted in reps
    expect(startHold(toggleSet(begin(), 0, 0, start), 0, 0, start).hold).toBeUndefined(); // already done
  });

  it('drop a slip of the thumb, a cancelled hold, and one whose set was removed', () => {
    const holding = startHold(begin(), 0, 2, start);
    expect(stopHold(holding, start + 1200).exercises[0].sets[2]).toEqual({ weight: '', reps: '60', done: false });
    expect(cancelHold(holding).hold).toBeUndefined();
    expect(removeSet(holding, 0, start + 2000).hold).toBeUndefined();
    expect(removeSet(holding, 1, start + 2000).hold).toBeDefined(); // another exercise's set
  });

  it('finish as holds, and read back as times', () => {
    let w = stopHold(startHold(begin(), 0, 0, start), start + 67_000);
    w = toggleSet(w, 0, 1, start + 200_000);                         // ticked without the timer: the target
    w = toggleSet(editSet(w, 1, 0, 'weight', '10', start), 1, 0, start + 300_000);
    const done = finishWorkout(w, start + 600_000)!;
    expect(done.exercises).toEqual([
      { name: 'Plank', sets: [{ weight: null, reps: 0, seconds: 67 }, { weight: null, reps: 0, seconds: 60 }] },
      { name: 'Crunch', sets: [{ weight: 10, reps: 15 }] },
    ]);
    expect(setsLabel(done.exercises[0].sets, 'kg')).toBe('1:07, 1:00');
    expect(setsLabel([{ weight: 20, reps: 0, seconds: 45 }, { weight: 20, reps: 0, seconds: 40 }], 'kg')).toBe('20 kg × 0:45, 0:40');
    expect(workoutTotals(done).volume).toBe(150); // holds lift nothing
    expect(lastTime([done], 'plank')?.sets[0].seconds).toBe(67);
  });

  it('have the longest hold as their best', () => {
    const log = [held('w1', '2026-09-21', [45, 40]), held('w2', '2026-09-24', [60, 50]), held('w3', '2026-09-28', [55])];
    const [plank] = exerciseSummaries(log, 'gym', 'kg');
    expect(plank).toMatchObject({ name: 'Plank', timed: true, weighted: false, heaviest: null, times: 3, last: { seconds: 55 } });
    expect(plank.longest).toMatchObject({ date: '2026-09-24', seconds: 60 });
    // A weighted hold is still judged by time.
    expect(exerciseSummaries([held('w1', '2026-09-21', [30], 20)], 'gym', 'kg')[0]).toMatchObject({ timed: true, weighted: false });

    const next = held('w4', '2026-10-01', [75, 50]);
    expect(newBests(logWorkout(log, next), next)).toEqual([{ name: 'Plank', label: '1:15 hold' }]);
    expect(newBests(logWorkout(log, held('w5', '2026-10-01', [60])), held('w5', '2026-10-01', [60]))).toEqual([]);
    expect(hadPersonalBest(log)).toBe(true);                       // 45 → 60
    expect(hadPersonalBest([log[1], log[2]].map((w, i) => ({ ...w, startedAt: at('2026-09-2' + (4 + i * 4), 18) })))).toBe(false); // 60 → 55
    expect(workoutOverview(log, null, [gym({ workout: core })], '2026-09-28', at('2026-09-28', 20))?.exercises[0])
      .toMatchObject({ name: 'Plank', last: '0:55', best: '1:00 hold' });
  });
});
