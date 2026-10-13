import notifee from '@notifee/react-native';
import { scheduleBillReminders, scheduleHabitNotifs } from '../src/notifications';
import type { Bill } from '../src/bills';
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

describe('scheduleBillReminders', () => {
  const bill = (over: Partial<Bill> = {}): Bill => ({
    id: 'rent', name: 'Rent', amount: 8000, repeat: 'monthly', day: 5, inBudget: true, remind: true, startDate: '2026-09-01', ...over,
  });
  const bodies = () => mock.createTriggerNotification.mock.calls.map(([n, t]) => ({ id: n.id, body: n.body, at: new Date(t.timestamp) }));

  it('reminds at 9 AM on the next two due days, replacing the old ones', async () => {
    mock.getTriggerNotificationIds.mockResolvedValueOnce(['bill-rent-0', 'hr-h1-daily-0']);
    await scheduleBillReminders([bill(), bill({ id: 'off', remind: false })], '₱');
    expect(mock.cancelTriggerNotifications).toHaveBeenCalledWith(['bill-rent-0']);
    expect(bodies()).toEqual([
      { id: 'bill-rent-0', body: 'Rent (₱8,000) is due today. Habbit logs it for you.', at: new Date(2026, 9, 5, 9, 0) },
      { id: 'bill-rent-1', body: 'Rent (₱8,000) is due today. Habbit logs it for you.', at: new Date(2026, 10, 5, 9, 0) },
    ]);
  });

  it('comes as far ahead as the bill asks, skipping a due date whose reminder time has passed', async () => {
    await scheduleBillReminders([bill({ remindBefore: 1 })], '₱');
    expect(bodies().map(b => [b.body, b.at])).toEqual([
      ['Rent (₱8,000) is due tomorrow.', new Date(2026, 9, 4, 9, 0)],
      ['Rent (₱8,000) is due tomorrow.', new Date(2026, 10, 4, 9, 0)],
    ]);
    jest.clearAllMocks();
    // Due on the 5th with a week's notice: October's reminder was due on Sep 28.
    await scheduleBillReminders([bill({ remindBefore: 7 })], '₱');
    expect(bodies().map(b => b.at)).toEqual([new Date(2026, 9, 29, 9, 0), new Date(2026, 10, 28, 9, 0)]);
    expect(bodies()[0].body).toBe('Rent (₱8,000) is due in a week, on Nov 5.');
  });

  it('plans one reminder for a yearly bill', async () => {
    await scheduleBillReminders([bill({ id: 'ins', name: 'Insurance', amount: 12000, repeat: 'yearly', day: 15, month: 2, remindBefore: 7 })], '₱');
    expect(bodies()).toEqual([{ id: 'bill-ins-0', body: 'Insurance (₱12,000) is due in a week, on Mar 15.', at: new Date(2027, 2, 8, 9, 0) }]);
  });
});
