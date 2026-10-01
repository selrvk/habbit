import { habitCreatedKey, habitDays, habitStats, skipAllowance } from '../src/habitStats';
import type { Commission, CompletionRecord } from '../src/types';

// 2026-10-01 is a Thursday.
const TODAY = '2026-10-01';
const created = (key: string) => `${new Date(key + 'T09:00:00').getTime()}abcd`;

const habit = (over: Partial<Commission> = {}): Commission => ({
  id: created('2026-09-24'), label: 'Read', completed: false, days: [],
  reminderTime: null, timesPerDay: 1, completionCount: 0, reminderTimes: [], reminderSplit: null,
  ...over,
});

/** Records where `id` was scheduled on each day, done on the days listed in `done`. */
const records = (id: string, scheduled: string[], done: string[]): CompletionRecord[] =>
  scheduled.map(date => ({ date, completed: done.includes(date), scheduledIds: [id], completedIds: done.includes(date) ? [id] : [] }));

const week = ['2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30'];

describe('habitStats', () => {
  it('counts the run of done days, with today pending not breaking it', () => {
    const h = habit();
    const s = habitStats(h, records(h.id, week, ['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30']), TODAY);
    expect(s).toMatchObject({ current: 4, best: 4, done: 4, missed: 3 });
    expect(s.rate).toBeCloseTo(4 / 7);
  });

  it('adds today once it is done', () => {
    const h = habit({ completed: true });
    expect(habitStats(h, records(h.id, week, week), TODAY)).toMatchObject({ current: 8, best: 8, done: 8, missed: 0, rate: 1 });
  });

  it('keeps the best streak after a miss', () => {
    const h = habit();
    const s = habitStats(h, records(h.id, week, ['2026-09-24', '2026-09-25', '2026-09-26', '2026-09-29', '2026-09-30']), TODAY);
    expect(s).toMatchObject({ current: 2, best: 3 });
  });

  it('skips days the habit is not scheduled', () => {
    // Mon/Wed/Fri habit, done on every scheduled day; other days have no record at all.
    const h = habit({ days: [1, 3, 5] });
    const s = habitStats(h, records(h.id, ['2026-09-25', '2026-09-28', '2026-09-30'], ['2026-09-25', '2026-09-28', '2026-09-30']), TODAY);
    expect(s).toMatchObject({ current: 3, best: 3, missed: 0 });
  });

  it('treats a scheduled day with no record (app not opened) as missed', () => {
    const h = habit();
    const s = habitStats(h, records(h.id, ['2026-09-24', '2026-09-25', '2026-09-30'], ['2026-09-24', '2026-09-25', '2026-09-30']), TODAY);
    expect(s).toMatchObject({ current: 1, best: 2, missed: 4 });
  });

  it('uses the schedule a record kept, not the current one', () => {
    // Was daily; now weekends only. Past weekdays still count from their records.
    const h = habit({ days: [0, 6] });
    const s = habitStats(h, records(h.id, week, week), TODAY);
    expect(s).toMatchObject({ current: 7, missed: 0 });
    expect(habitDays(h, records(h.id, week, week), TODAY).at(-1)).toEqual({ date: TODAY, state: 'rest' });
  });

  it('treats skipped days as neutral', () => {
    const h = habit({ skipped: true });
    const history = records(h.id, week, week.filter(d => d !== '2026-09-28'));
    history[4].skippedIds = [h.id]; // 2026-09-28 skipped, every other day done
    const s = habitStats(h, history, TODAY);
    expect(s).toMatchObject({ current: 6, best: 6, done: 6, missed: 0, rate: 1 });
    expect(habitDays(h, history, TODAY).map(d => d.state).slice(-4)).toEqual(['skipped', 'done', 'done', 'skipped']);
  });

  it('starts at creation, but not before the oldest record', () => {
    const h = habit({ id: created('2026-09-29') });
    expect(habitStats(h, records('other', week, week), TODAY).since).toBe('2026-09-29');
    const old = habit({ id: created('2026-01-01') });
    expect(habitStats(old, records(old.id, week, week), TODAY).since).toBe('2026-09-24');
  });

  it('has no rate for a habit created today', () => {
    const h = habit({ id: created(TODAY) });
    expect(habitStats(h, [], TODAY)).toMatchObject({ current: 0, best: 0, rate: null, since: TODAY });
  });
});

describe('habitCreatedKey', () => {
  it('reads the local creation day from the id', () => {
    expect(habitCreatedKey(created('2026-09-24'))).toBe('2026-09-24');
    expect(habitCreatedKey('custom-id')).toBeNull();
  });
});

describe('skipAllowance', () => {
  // TODAY is Thursday 2026-10-01; the week started Monday 2026-09-28.
  const skippedOn = (id: string, dates: string[]): CompletionRecord[] =>
    dates.map(date => ({ date, completed: false, scheduledIds: [id], completedIds: [], skippedIds: [id] }));

  it('allows 2 a week for daily habits, counting this week only', () => {
    const h = habit();
    expect(skipAllowance(h, skippedOn(h.id, ['2026-09-27', '2026-09-29']), TODAY)).toEqual({ limit: 2, used: 1, left: 1 });
  });

  it('counts today once skipped, and gives it back when un-skipped', () => {
    const h = habit({ skipped: true });
    expect(skipAllowance(h, skippedOn(h.id, ['2026-09-29']), TODAY)).toEqual({ limit: 2, used: 2, left: 0 });
    expect(skipAllowance({ ...h, skipped: false }, skippedOn(h.id, ['2026-09-29']), TODAY).left).toBe(1);
  });

  it('allows 1 a week for habits on 3 days or fewer', () => {
    expect(skipAllowance(habit({ days: [1, 3, 5] }), [], TODAY).limit).toBe(1);
    expect(skipAllowance(habit({ days: [1, 2, 3, 4, 5] }), [], TODAY).limit).toBe(2);
  });
});

describe('weekly habits (N× a week)', () => {
  // Weeks run Monday to Sunday. TODAY is Thursday 2026-10-01 (week of Sep 28).
  const gym = (over: Partial<Commission> = {}) => habit({ id: created('2026-09-07'), perWeek: 3, ...over }); // a Monday
  const doneOn = (id: string, dates: string[]): CompletionRecord[] =>
    dates.map(date => ({ date, completed: false, scheduledIds: [], completedIds: [id] }));

  it('counts weeks that met the goal, with the current week still open', () => {
    const h = gym();
    const history = doneOn(h.id, [
      '2026-09-07', '2026-09-09', '2026-09-11',               // week 1: 3 ✓
      '2026-09-14', '2026-09-20',                             // week 2: 2 ✗
      '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-26', // week 3: 4 ✓
      '2026-09-29',                                           // this week: 1 so far
    ]);
    const s = habitStats(h, history, TODAY);
    expect(s).toMatchObject({ unit: 'week', current: 1, best: 1, done: 2, missed: 1, sessions: 10, thisWeek: 1, weekDone: false });
  });

  it('counts this week once the goal is met, today included', () => {
    const h = gym({ completed: true });
    const s = habitStats(h, doneOn(h.id, ['2026-09-21', '2026-09-23', '2026-09-25', '2026-09-28', '2026-09-30']), TODAY);
    expect(s).toMatchObject({ current: 2, thisWeek: 3, weekDone: true });
  });

  it('never marks a day missed, and has no skips', () => {
    const h = gym();
    expect(habitDays(h, [], TODAY).every(d => d.state === 'rest' || d.state === 'pending')).toBe(true);
    expect(skipAllowance(h, [], TODAY).limit).toBe(0);
  });

  it('does not hold a part first week against the habit', () => {
    const h = gym({ id: created('2026-09-24') }); // a Thursday, done once that week
    expect(habitStats(h, doneOn(h.id, ['2026-09-26']), TODAY)).toMatchObject({ current: 0, missed: 0, rate: null });
  });
});
