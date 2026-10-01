// Date keys must follow the user's local calendar, not UTC. In the Philippines (UTC+8),
// UTC-based keys were a day behind between midnight and 8 AM.
declare const process: { env: Record<string, string | undefined> };
process.env.TZ = 'Asia/Manila';

import { getTodayKey, getLast7DayKeys } from '../src/helpers';

describe('local date keys', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // 1:00 AM on Oct 1 in Manila = Sep 30, 17:00 UTC.
    jest.setSystemTime(new Date('2026-09-30T17:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('today is the local date', () => {
    expect(getTodayKey()).toBe('2026-10-01');
  });

  it('the last 7 days end on the local today', () => {
    expect(getLast7DayKeys()).toEqual([
      '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01',
    ]);
  });
});
