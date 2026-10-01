import { rolloverFinance, rolloverHabits, streakContinues, onlyRestDaysBetween } from '../src/dayRollover';
import { reminderTimesFor } from '../src/notifications';
import type { Commission, Stats } from '../src/types';

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {},
  TriggerType: {}, RepeatFrequency: {}, AndroidImportance: {},
}));

// 2026-09-28 is a Monday.
const MON = '2026-09-28', TUE = '2026-09-29', SAT = '2026-10-03', SUN = '2026-10-04';

const habit = (over: Partial<Commission> = {}): Commission => ({
  id: 'h1', label: 'Read', completed: false, days: [], reminderTime: null,
  timesPerDay: 1, completionCount: 0, reminderTimes: [], reminderSplit: null, ...over,
});
const stats = (over: Partial<Stats> = {}): Stats =>
  ({ currentStreak: 0, bestStreak: 0, totalCompleted: 0, lastFullDate: '', ...over });

describe('rolloverHabits', () => {
  it('does not add to the streak or totalCompleted (they are counted live)', () => {
    const r = rolloverHabits({
      date: MON,
      commissions: [habit({ completed: true })],
      stats: stats({ currentStreak: 3, bestStreak: 3, totalCompleted: 10, lastFullDate: MON }),
      history: [],
    }, TUE);
    expect(r.stats).toEqual(stats({ currentStreak: 3, bestStreak: 3, totalCompleted: 10, lastFullDate: MON }));
    expect(r.commissions[0].completed).toBe(false);
    expect(r.history).toEqual([{ date: MON, completed: true, completedIds: ['h1'], scheduledIds: ['h1'] }]);
  });

  it('breaks the streak when a scheduled day was missed', () => {
    const r = rolloverHabits({
      date: TUE, commissions: [habit()],
      stats: stats({ currentStreak: 3, lastFullDate: MON }), history: [],
    }, '2026-09-30');
    expect(r.stats.currentStreak).toBe(0);
    expect(r.history[0]).toMatchObject({ date: TUE, completed: false });
  });

  it('keeps the streak across rest days', () => {
    const weekdays = habit({ days: [1, 2, 3, 4, 5] });
    const r = rolloverHabits({
      date: SAT, commissions: [weekdays],
      stats: stats({ currentStreak: 5, lastFullDate: '2026-10-02' }), history: [],
    }, SUN);
    expect(r.stats.currentStreak).toBe(5);
    expect(r.history).toEqual([]); // no record for a rest day
  });

  it('replaces a record written earlier in the day with the final state', () => {
    const r = rolloverHabits({
      date: MON, commissions: [habit({ completed: false })], stats: stats(),
      history: [{ date: MON, completed: true, completedIds: ['h1'], scheduledIds: ['h1'] }],
    }, TUE);
    expect(r.history).toEqual([{ date: MON, completed: false, completedIds: [], scheduledIds: ['h1'] }]);
  });

  it('records skipped habits, counts the day as done if the rest were, and clears skips', () => {
    const r = rolloverHabits({
      date: MON,
      commissions: [habit({ completed: true }), habit({ id: 'h2', skipped: true })],
      stats: stats(), history: [],
    }, TUE);
    expect(r.history).toEqual([{ date: MON, completed: true, completedIds: ['h1'], scheduledIds: ['h1', 'h2'], skippedIds: ['h2'] }]);
    expect(r.commissions.map(c => c.skipped)).toEqual([false, false]);
  });

  it('keeps the streak across a day where everything was skipped', () => {
    const r = rolloverHabits({
      date: TUE, commissions: [habit({ skipped: true })],
      stats: stats({ currentStreak: 3, lastFullDate: MON }), history: [],
    }, '2026-09-30');
    expect(r.stats.currentStreak).toBe(3);
    expect(r.history[0]).toMatchObject({ date: TUE, completed: false, skippedIds: ['h1'] });
  });

  it('still breaks the streak when only some habits were skipped and the rest missed', () => {
    const r = rolloverHabits({
      date: TUE, commissions: [habit({ skipped: true }), habit({ id: 'h2' })],
      stats: stats({ currentStreak: 3, lastFullDate: MON }), history: [],
    }, '2026-09-30');
    expect(r.stats.currentStreak).toBe(0);
  });

  it('is a no-op on the same day', () => {
    const input = { date: MON, commissions: [habit({ completed: true })], stats: stats(), history: [] };
    expect(rolloverHabits(input, MON).changed).toBe(false);
  });
});

describe('streakContinues', () => {
  const weekdays = [habit({ days: [1, 2, 3, 4, 5] })];
  it('continues from yesterday', () =>
    expect(streakContinues(stats({ currentStreak: 2, lastFullDate: MON }), TUE, weekdays)).toBe(true));
  it('continues from Friday to Monday over a weekend off', () =>
    expect(streakContinues(stats({ currentStreak: 2, lastFullDate: '2026-10-02' }), '2026-10-05', weekdays)).toBe(true));
  it('restarts after a missed scheduled day', () =>
    expect(streakContinues(stats({ currentStreak: 2, lastFullDate: MON }), '2026-09-30', weekdays)).toBe(false));
  it('restarts with no previous full day', () =>
    expect(streakContinues(stats(), TUE, weekdays)).toBe(false));
  it('continues over skipped days, however many', () => {
    const sickWeek = ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']
      .map(date => ({ date, completed: false, completedIds: [], scheduledIds: ['h1'], skippedIds: ['h1'] }));
    expect(streakContinues(stats({ currentStreak: 2, lastFullDate: MON }), '2026-10-09', weekdays, sickWeek)).toBe(true);
  });
  it('handles long gaps', () =>
    expect(onlyRestDaysBetween(MON, '2026-12-01', weekdays)).toBe(false));
});

describe('rolloverFinance', () => {
  it('moves the previous day into dailyTotals', () => {
    const r = rolloverFinance({ spentToday: 120, date: MON, history: [] }, [], TUE);
    expect(r.finance).toEqual({ spentToday: 0, date: TUE, history: [] });
    expect(r.dailyTotals).toEqual([{ date: MON, total: 120, entries: [] }]);
  });
});

describe('reminderTimesFor', () => {
  it('computes split-evenly times from reminderSplit', () => {
    const c = habit({
      timesPerDay: 3,
      reminderSplit: { startHour: 8, startMinute: 0, endHour: 20, endMinute: 0 },
    });
    expect(reminderTimesFor(c)).toEqual([{ hour: 8, minute: 0 }, { hour: 14, minute: 0 }, { hour: 20, minute: 0 }]);
  });
  it('returns nothing for a single habit without a time', () =>
    expect(reminderTimesFor(habit({ reminderTimes: [{ hour: 9, minute: 0 }] }))).toEqual([]));
});
