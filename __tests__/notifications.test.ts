import notifee from '@notifee/react-native';
import { scheduleHabitNotifs } from '../src/notifications';
import type { Commission } from '../src/types';

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    getTriggerNotificationIds: jest.fn(async () => ['hr-h1-daily-0', 'hr-h1-later-1-0', 'hr-h2-daily-0', 'hr-evening-0']),
    cancelTriggerNotifications: jest.fn(async () => {}),
    createTriggerNotification: jest.fn(async () => {}),
  },
  TriggerType: { TIMESTAMP: 0 },
  RepeatFrequency: { DAILY: 1, WEEKLY: 2 },
  AndroidImportance: {},
}));

const mock = notifee as unknown as Record<string, jest.Mock>;

const habit = (over: Partial<Commission> = {}): Commission => ({
  id: 'h1', label: 'Read', completed: false, days: [], reminderTime: { hour: 20, minute: 0 },
  timesPerDay: 1, completionCount: 0, reminderTimes: [], reminderSplit: null, ...over,
});

const created = () => mock.createTriggerNotification.mock.calls.map(([n, t]) => ({ id: n.id, at: new Date(t.timestamp), repeats: t.repeatFrequency }));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(new Date(2026, 9, 1, 9, 0)); // Thu Oct 1, 9:00 AM
});
afterEach(() => jest.useRealTimers());

describe('scheduleHabitNotifs', () => {
  it('cancels only this habit’s reminders before planning', async () => {
    await scheduleHabitNotifs(habit());
    expect(mock.cancelTriggerNotifications).toHaveBeenCalledWith(['hr-h1-daily-0', 'hr-h1-later-1-0']);
  });

  it('repeats daily while the habit is still to do today', async () => {
    await scheduleHabitNotifs(habit());
    expect(created()).toEqual([{ id: 'hr-h1-daily-0', at: new Date(2026, 9, 1, 20, 0), repeats: 1 }]);
  });

  it('stays quiet today once done or skipped, with one-off reminders from tomorrow', async () => {
    for (const quiet of [{ completed: true }, { skipped: true }]) {
      jest.clearAllMocks();
      await scheduleHabitNotifs(habit(quiet));
      const plan = created();
      expect(plan).toHaveLength(7);
      expect(plan.every(p => p.repeats === undefined)).toBe(true);
      expect(plan[0]).toEqual({ id: 'hr-h1-later-1-0', at: new Date(2026, 9, 2, 20, 0), repeats: undefined });
      expect(plan[6].at).toEqual(new Date(2026, 9, 8, 20, 0));
    }
  });

  it('stays quiet until Monday once a weekly habit has met its goal', async () => {
    await scheduleHabitNotifs(habit({ perWeek: 3 }), 'week');
    const plan = created();
    expect(plan[0].at).toEqual(new Date(2026, 9, 5, 20, 0)); // Mon Oct 5
    expect(plan).toHaveLength(7);
  });

  it('plans fewer quiet days for habits with many reminders, and only on scheduled days', async () => {
    await scheduleHabitNotifs(habit({ completed: true, timesPerDay: 8, reminderTime: null, reminderTimes: Array.from({ length: 8 }, (_, i) => ({ hour: 9 + i, minute: 0 })) }));
    expect(created()).toHaveLength(16); // 2 days × 8
    jest.clearAllMocks();
    await scheduleHabitNotifs(habit({ skipped: true, days: [1, 3, 5] })); // Mon/Wed/Fri
    expect(created().map(p => p.at.getDate())).toEqual([2, 5, 7]); // Fri 2, Mon 5, Wed 7
  });
});
