import { habitCreatedKey, habitDays, habitStats } from '../src/habitStats';
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
