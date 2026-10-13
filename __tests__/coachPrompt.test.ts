import { focusStatus, habitStatus, workoutStatus } from '../src/utils/coachPrompt';
import type { FocusOverview } from '../src/focus';
import type { HabitsOverview } from '../src/habitStats';
import type { WorkoutOverview } from '../src/workout';

const overview = (over: Partial<FocusOverview> = {}): FocusOverview => ({
  at: new Date('2026-10-03T16:50:00').getTime(), running: null,
  todayMinutes: 50, weekMinutes: 175, prevWeekMinutes: 75, weekDays: 4,
  byHabit: [{ label: 'Study', minutes: 150 }, { label: 'Read', minutes: 25 }],
  timed: [{ label: 'Study', rounds: 4, minutes: 25, breakMinutes: 5 }, { label: 'Read', rounds: 1, minutes: 20, breakMinutes: 0 }],
  ...over,
});

describe('focusStatus', () => {
  it('gives the focus timer to Bonbon', () => {
    expect(focusStatus(overview()).split('\n')).toEqual([
      'Focused today: 50 min.',
      'Last 7 days: 2h 55m over 4 days (Study 2h 30m, Read 25 min); the 7 days before: 1h 15m, so up 133%.',
      'Habits with a focus timer: Study (4 rounds of 25 min, 5-min breaks), Read (one 20-min round).',
    ]);
  });

  it('says what is running', () => {
    const running = (r: Partial<NonNullable<FocusOverview['running']>>) => focusStatus(overview({
      running: { label: 'Study', phase: 'focus', block: 2, blocks: 4, minutesLeft: 12, paused: false, ...r },
    })).split('\n')[0];
    expect(running({})).toBe('Running as of 4:50 PM: Study, round 2 of 4 with 12 min left.');
    expect(running({ paused: true })).toBe('Running as of 4:50 PM: Study, round 2 of 4 paused with 12 min left.');
    expect(running({ blocks: 1, block: 1 })).toBe('Running as of 4:50 PM: Study, a round with 12 min left.');
    expect(running({ phase: 'break', minutesLeft: 3 })).toBe('Running as of 4:50 PM: Study, on a break after round 2 of 4, 3 min left.');
    expect(running({ phase: 'break', minutesLeft: 0 })).toBe('Running as of 4:50 PM: Study, on a break after round 2 of 4, the next round is about to start.');
  });

  it('says when focus time dropped', () => {
    expect(focusStatus(overview({ weekMinutes: 8, weekDays: 1, byHabit: [{ label: 'Study', minutes: 8 }], prevWeekMinutes: 175 })).split('\n')[1])
      .toBe('Last 7 days: 8 min over 1 day (Study 8 min); the 7 days before: 2h 55m, so down 95%.');
  });

  it('says when nothing was focused lately', () => {
    expect(focusStatus(overview({ todayMinutes: 0, weekMinutes: 0, weekDays: 0, byHabit: [], timed: [] })))
      .toBe('Focused today: nothing yet.\nNothing focused in the last 7 days.');
  });
});

describe('workoutStatus', () => {
  const overview: WorkoutOverview = {
    at: new Date('2026-10-01T18:12:00').getTime(),
    running: { label: 'Gym', routineName: 'Legs', minutes: 12, setsDone: 3, next: 'Squat, set 4 of 5', restLeft: 45 },
    habits: [{ label: 'Gym', routines: ['Push', 'Pull', 'Legs'], next: 'Legs', unit: 'kg', restSeconds: 90 }],
    recent: [{ date: '2026-09-30', label: 'Gym', routineName: 'Pull', minutes: 40, sets: 9, volume: 0, unit: 'kg' },
      { date: '2026-09-28', label: 'Gym', routineName: 'Push', minutes: 50, sets: 12, volume: 4200, unit: 'kg' }],
    prevWeekCount: 1,
    exercises: [{ habit: 'Gym', name: 'Bench press', unit: 'kg', times: 2, last: '60 kg × 8, 7', best: '62.5 kg × 5' }],
  };

  it('gives the workouts to Bonbon', () => {
    expect(workoutStatus(overview).split('\n')).toEqual([
      'In progress as of 6:12 PM: Gym, Legs, 12 min in, 3 sets done, resting (45s left); next up: Squat, set 4 of 5.',
      'Gym: routines Push → Pull → Legs (they take turns); next up: Legs; weights in kg; 90s rest between sets.',
      'Last 7 days: 2 workouts (the 7 days before: 1): Wed, Sep 30 Pull (40 min, 9 sets); Mon, Sep 28 Push (50 min, 12 sets, 4,200 kg lifted).',
      'Exercises (last time; best ever):',
      '  Bench press: 60 kg × 8, 7; best 62.5 kg × 5 (2 times)',
    ]);
  });

  it('says when there were no workouts lately', () => {
    expect(workoutStatus({ ...overview, running: null, recent: [], exercises: [] }).split('\n')[1])
      .toBe('No workouts in the last 7 days (the 7 days before: 1).');
  });
});

describe('habitStatus', () => {
  const habits = (over: Partial<HabitsOverview> = {}): HabitsOverview => ({
    none: false,
    today: { done: 1, of: 4, skipped: 0, left: ['Drink water (5 of 8)', 'Read 20 pages', 'Study (2 of 4)'] },
    recent: { days: 6, perfect: 6, notPerfect: [] },
    weeklyGoals: [{ label: 'Gym', done: 2, target: 3 }],
    ...over,
  });

  it('spells out today, the days before it and weekly goals', () => {
    expect(habitStatus(habits()).split('\n')).toEqual([
      'Today (still going): 1 of 4 habits done so far. Left to do: Drink water (5 of 8), Read 20 pages, Study (2 of 4).',
      'The 6 days tracked before today (last 6 days): all 6 were perfect days (every scheduled habit done).',
      'Weekly goals (any days, Monday to Sunday): Gym 2 of 3 this week.',
    ]);
  });

  it('names the days that were not perfect', () => {
    // 2026-09-29 is a Tuesday, 2026-10-02 a Friday.
    const recent = { days: 5, perfect: 3, notPerfect: [{ date: '2026-09-29', missed: ['Read 20 pages'] }, { date: '2026-10-02', missed: [] }] };
    expect(habitStatus(habits({ recent, weeklyGoals: [] })).split('\n')[1])
      .toBe('The 5 days tracked before today (last 6 days): 3 of 5 were perfect days (every scheduled habit done). Not perfect: Tuesday (missed Read 20 pages); Friday.');
  });

  it('covers a finished day, rest days and a first day', () => {
    const first = (over: Partial<HabitsOverview>) => habitStatus(habits(over)).split('\n')[0];
    expect(first({ today: { done: 4, of: 4, skipped: 0, left: [] } })).toBe('Today: all 4 habits done.');
    expect(first({ today: { done: 1, of: 1, skipped: 2, left: [] } })).toBe('Today: all 1 habit done. 2 skipped today.');
    expect(first({ today: { done: 0, of: 0, skipped: 3, left: [] } })).toBe('Today: a rest day, every habit skipped.');
    expect(first({ today: { done: 0, of: 0, skipped: 0, left: [] } })).toBe('Today: no habits scheduled.');
    expect(habitStatus(habits({ recent: { days: 0, perfect: 0, notPerfect: [] } })).split('\n')[1]).toBe('The 6 days before today: nothing tracked.');
    expect(habitStatus(habits({ recent: { days: 1, perfect: 1, notPerfect: [] } })).split('\n')[1])
      .toBe('The one day tracked before today (last 6 days): it was a perfect day (every scheduled habit done).');
    expect(habitStatus(habits({ none: true }))).toBe('No habits set up yet.');
  });
});
