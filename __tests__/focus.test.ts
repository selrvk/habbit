import {
  breakMinutesAfter, clock, durationLabel, focusMinutes, focusOverview, following, logFocus, nextBlock, onLongBreak, pause, progress, resume,
  sessionEndsAt, settle, startBlock, timeLeft, transitionText, upcomingTransitions,
} from '../src/focus';
import type { FocusSettings } from '../src/focus';
import type { Commission } from '../src/types';

const at = (day: string, hour: number, minute = 0) => new Date(`${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`).getTime();
const MIN = 60_000;

const study = (over: Partial<Commission> = {}): Commission & { focus: FocusSettings } => ({
  id: 'study', label: 'Study', completed: false, days: [], reminderTime: null, timesPerDay: 4, completionCount: 1,
  reminderTimes: [], reminderSplit: null, focus: { minutes: 25, breakMinutes: 5 }, ...over,
} as Commission & { focus: FocusSettings });

describe('focus rounds', () => {
  const start = at('2026-10-03', 9);

  it('start at the next round of the day’s count', () => {
    const s = startBlock(study(), start, 'a');
    expect(s).toMatchObject({ phase: 'focus', block: 2, blocks: 4, minutes: 25, endsAt: start + 25 * MIN });
    expect(startBlock(study({ timesPerDay: 1, completionCount: 0 }), start, 'b')).toMatchObject({ block: 1, blocks: 1 });
  });

  it('count down, and pause and resume where they left off', () => {
    const s = startBlock(study(), start, 'a');
    expect(timeLeft(s, start + 10 * MIN)).toBe(15 * MIN);
    expect(progress(s, start + 10 * MIN)).toBeCloseTo(0.4);
    const paused = pause(s, start + 10 * MIN);
    expect(timeLeft(paused, start + 60 * MIN)).toBe(15 * MIN);
    expect(resume(paused, start + 60 * MIN).endsAt).toBe(start + 75 * MIN);
  });

  it('count once they run out, then the break starts from when the round ended', () => {
    const s = startBlock(study(), start, 'a');
    const running = settle(s, start + 24 * MIN);
    expect(running.events).toEqual([]);
    expect(running.session).toBe(s); // nothing to settle: the same session comes back

    const done = settle(s, start + 27 * MIN);
    expect(done.events).toEqual([{ id: 'focus-a-2', kind: 'habit', date: '2026-10-03', habitId: 'study' }]);
    expect(done.logged).toEqual([{ date: '2026-10-03', habitId: 'study', minutes: 25 }]);
    expect(done.session).toMatchObject({ phase: 'break', block: 2, startedAt: start + 25 * MIN, endsAt: start + 30 * MIN });
    // Settling again has nothing more to count.
    expect(settle(done.session, start + 27 * MIN).events).toEqual([]);
  });

  it('move on by themselves: break, next round, break, to the end', () => {
    const s = startBlock(study(), start, 'a'); // rounds 2, 3 and 4 of 4: 25 + 5 + 25 + 5 + 25
    // 40 minutes in: round 2 is counted, its break is over and round 3 is 10 minutes old.
    const third = settle(s, start + 40 * MIN);
    expect(third.events.map(e => e.id)).toEqual(['focus-a-2']);
    expect(third.session).toMatchObject({ phase: 'focus', block: 3, startedAt: start + 30 * MIN, endsAt: start + 55 * MIN });
    // Carrying on from there, or all at once from the start: the same place.
    const later = settle(third.session, start + 70 * MIN);
    expect(later.session).toMatchObject({ phase: 'focus', block: 4, endsAt: start + 85 * MIN });
    expect(settle(s, start + 70 * MIN).session).toEqual(later.session);
    // The whole session ran with the app closed: three rounds counted, nothing left running.
    const all = settle(s, start + 3 * 60 * MIN);
    expect(all.session).toBeNull();
    expect(all.events.map(e => e.id)).toEqual(['focus-a-2', 'focus-a-3', 'focus-a-4']);
    expect(all.logged.reduce((sum, l) => sum + l.minutes, 0)).toBe(75);
  });

  it('end after the last round, and run rounds back to back with no break set', () => {
    expect(settle(startBlock(study({ completionCount: 3 }), start, 'a'), start + 30 * MIN).session).toBeNull();
    const noBreak = startBlock(study({ focus: { minutes: 25, breakMinutes: 0 } }), start, 'b');
    expect(following(noBreak)).toMatchObject({ phase: 'focus', block: 3, startedAt: start + 25 * MIN });
    expect(settle(noBreak, start + 30 * MIN).session).toMatchObject({ phase: 'focus', block: 3 });
  });

  it('take a longer break after every fourth round', () => {
    const long = study({ timesPerDay: 8, completionCount: 2, focus: { minutes: 25, breakMinutes: 5, longBreakMinutes: 20 } });
    const s = startBlock(long, start, 'a'); // round 3 of 8
    expect(breakMinutesAfter(s)).toBe(5);
    expect(breakMinutesAfter({ ...s, block: 4 })).toBe(20);
    expect(breakMinutesAfter({ ...s, block: 8 })).toBe(0);
    // Round 3, a 5-minute break, round 4, then the long break.
    const rest = settle(s, start + 56 * MIN).session!;
    expect(rest).toMatchObject({ phase: 'break', block: 4, startedAt: start + 55 * MIN, endsAt: start + 75 * MIN });
    expect(onLongBreak(rest)).toBe(true);
    expect(progress(rest, start + 65 * MIN)).toBeCloseTo(0.5);
    expect(onLongBreak(settle(s, start + 26 * MIN).session!)).toBe(false);
  });

  it('don’t count while paused', () => {
    const paused = pause(startBlock(study(), start, 'a'), start + MIN);
    expect(settle(paused, start + 90 * MIN).events).toEqual([]);
  });

  it('count on the day each ended when the app only sees them the next morning', () => {
    const late = startBlock(study({ completionCount: 2 }), at('2026-10-03', 23, 20), 'a'); // rounds 3 and 4
    const r = settle(late, at('2026-10-04', 8), '2026-10-04');
    expect(r.events.map(e => e.date)).toEqual(['2026-10-03', '2026-10-04']); // 23:45, then 00:15
    expect(r.session).toBeNull();
  });

  it('drop a paused round from an earlier day', () => {
    const paused = pause(startBlock(study(), at('2026-10-03', 22), 'a'), at('2026-10-03', 22, 5));
    expect(settle(paused, at('2026-10-04', 8), '2026-10-04')).toEqual({ session: null, events: [], logged: [] });
  });

  it('skip a break to the next round, unless there’s none to start', () => {
    const rest = settle(startBlock(study(), start, 'a'), start + 26 * MIN).session!;
    expect(nextBlock(rest, study({ completionCount: 2 }), start + 26 * MIN))
      .toMatchObject({ phase: 'focus', block: 3, startedAt: start + 26 * MIN, endsAt: start + 51 * MIN });
    expect(nextBlock(rest, study({ completed: true, completionCount: 4 }), start)).toBeNull();
    expect(nextBlock(rest, undefined, start)).toBeNull();
    expect(nextBlock({ ...rest, block: 4 }, study(), start)).toBeNull();
  });

  it('list the switches ahead, with what each notification says', () => {
    const s = startBlock(study({ completionCount: 2 }), start, 'a'); // rounds 3 and 4
    const ahead = upcomingTransitions(s, 10);
    expect(ahead.map(t => [t.kind, (t.at - start) / MIN])).toEqual([['round-done', 25], ['break-over', 30], ['all-done', 55]]);
    expect(ahead.map(t => transitionText('Study', t))).toEqual([
      { title: 'Round 3 of 4 done 🥕', body: 'Study: enjoy a 5-minute break.' },
      { title: 'Break’s over 🐰', body: 'Study: round 4 of 4 starts now.' },
      { title: 'All 4 rounds done 🎉', body: 'Study is done for today. Great focus!' },
    ]);
    expect(upcomingTransitions(s, 2)).toHaveLength(2);
    expect(upcomingTransitions(pause(s, start + MIN), 10)).toEqual([]);
    // No break: the round's own notification says the next one has started.
    const noBreak = startBlock(study({ completionCount: 2, focus: { minutes: 25, breakMinutes: 0 } }), start, 'b');
    expect(upcomingTransitions(noBreak, 10).map(t => transitionText('Study', t).body)).toEqual(['Study: round 4 starts now.', 'Study is done for today. Great focus!']);
    const once = startBlock(study({ timesPerDay: 1, completionCount: 0 }), start, 'c');
    expect(transitionText('Read', upcomingTransitions(once, 10)[0]).title).toBe('Focus round done 🥕');
  });

  it('know when the whole session ends', () => {
    const s = startBlock(study({ completionCount: 0 }), start, 'a'); // 4 × 25 with three 5-minute breaks
    expect(sessionEndsAt(s, start)).toBe(start + 115 * MIN);
    expect(sessionEndsAt(settle(s, start + 40 * MIN).session!, start + 40 * MIN)).toBe(start + 115 * MIN);
    // Paused 10 minutes in, looked at an hour later: the rest runs from then.
    expect(sessionEndsAt(pause(s, start + 10 * MIN), start + 70 * MIN)).toBe(start + 175 * MIN);
  });
});

describe('focus time', () => {
  it('adds up by day and habit', () => {
    let log = logFocus([], { date: '2026-10-01', habitId: 'study', minutes: 25 });
    log = logFocus(log, { date: '2026-10-01', habitId: 'study', minutes: 25 });
    log = logFocus(log, { date: '2026-10-02', habitId: 'read', minutes: 20 });
    expect(log).toHaveLength(2);
    expect(focusMinutes(log, '2026-10-01', '2026-10-02')).toBe(70);
    expect(focusMinutes(log, '2026-10-01', '2026-10-02', 'study')).toBe(50);
    expect(focusMinutes(log, '2026-10-02', '2026-10-02')).toBe(20);
  });

  it('formats', () => {
    expect(clock(25 * MIN)).toBe('25:00');
    expect(clock(61_500)).toBe('1:02');
    expect(clock(65 * MIN)).toBe('1:05:00');
    expect(durationLabel(45)).toBe('45 min');
    expect(durationLabel(80)).toBe('1h 20m');
    expect(durationLabel(120)).toBe('2h');
  });
});

describe('focusOverview', () => {
  const log = [
    { date: '2026-09-20', habitId: 'study', minutes: 50 },
    { date: '2026-09-27', habitId: 'study', minutes: 50 },
    { date: '2026-09-30', habitId: 'study', minutes: 75 },
    { date: '2026-09-30', habitId: 'gone', minutes: 25 },
    { date: '2026-10-03', habitId: 'read', minutes: 20 },
  ];
  const habits = [study(), { ...study({ id: 'read', label: 'Read' }), focus: undefined }];

  it('sums up today, the last 7 days and the 7 before', () => {
    expect(focusOverview(log, null, habits, '2026-10-03', at('2026-10-03', 9))).toEqual({
      at: at('2026-10-03', 9), running: null,
      todayMinutes: 20, weekMinutes: 170, prevWeekMinutes: 50, weekDays: 3,
      byHabit: [{ label: 'Study', minutes: 125 }, { label: 'Read', minutes: 20 }], // "gone" was deleted
      timed: [{ label: 'Study', rounds: 4, minutes: 25, breakMinutes: 5 }],
    });
  });

  it('describes the running timer', () => {
    const s = pause(startBlock(study(), at('2026-10-03', 9), 'a'), at('2026-10-03', 9, 10));
    expect(focusOverview([], s, habits, '2026-10-03', at('2026-10-03', 9, 30))?.running)
      .toEqual({ label: 'Study', phase: 'focus', block: 2, blocks: 4, minutesLeft: 15, paused: true });
  });

  it('is null when the timer has never been set up or used', () => {
    expect(focusOverview([], null, [{ ...study(), focus: undefined }], '2026-10-03', 0)).toBeNull();
  });
});
