import { focusStatus } from '../src/utils/coachPrompt';
import type { FocusOverview } from '../src/focus';

const overview = (over: Partial<FocusOverview> = {}): FocusOverview => ({
  at: new Date('2026-10-03T16:50:00').getTime(), running: null,
  todayMinutes: 50, weekMinutes: 175, prevWeekMinutes: 75, weekDays: 4,
  byHabit: [{ label: 'Study', minutes: 150 }, { label: 'Read', minutes: 25 }],
  timed: [{ label: 'Study', minutes: 25, breakMinutes: 5 }, { label: 'Read', minutes: 20, breakMinutes: 0 }],
  ...over,
});

describe('focusStatus', () => {
  it('gives the focus timer to Bonbon', () => {
    expect(focusStatus(overview()).split('\n')).toEqual([
      'Focused today: 50 min.',
      'Last 7 days: 2h 55m over 4 days (Study 2h 30m, Read 25 min); the 7 days before: 1h 15m, so up 133%.',
      'Habits with a focus timer: Study (25-min blocks, 5-min breaks), Read (20-min blocks).',
    ]);
  });

  it('says what is running', () => {
    const running = (r: Partial<NonNullable<FocusOverview['running']>>) => focusStatus(overview({
      running: { label: 'Study', phase: 'focus', block: 2, blocks: 4, minutesLeft: 12, paused: false, ...r },
    })).split('\n')[0];
    expect(running({})).toBe('Running as of 4:50 PM: Study, block 2 of 4 with 12 min left.');
    expect(running({ paused: true })).toBe('Running as of 4:50 PM: Study, block 2 of 4 paused with 12 min left.');
    expect(running({ blocks: 1, block: 1 })).toBe('Running as of 4:50 PM: Study, a block with 12 min left.');
    expect(running({ phase: 'break', minutesLeft: 3 })).toBe('Running as of 4:50 PM: Study, on a break after block 2 of 4, 3 min left.');
    expect(running({ phase: 'break', minutesLeft: 0 })).toBe('Running as of 4:50 PM: Study, on a break after block 2 of 4, ready for the next block.');
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
