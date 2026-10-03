import {
  clock, durationLabel, focusMinutes, logFocus, nextBlock, pause, progress, resume, settle, startBlock, timeLeft,
  type FocusSession,
} from '../src/focus';
import type { Commission } from '../src/types';

const at = (day: string, hour: number, minute = 0) => new Date(`${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`).getTime();
const MIN = 60_000;

const study = (over: Partial<Commission> = {}): Commission & { focus: { minutes: number; breakMinutes: number } } => ({
  id: 'study', label: 'Study', completed: false, days: [], reminderTime: null, timesPerDay: 4, completionCount: 1,
  reminderTimes: [], reminderSplit: null, focus: { minutes: 25, breakMinutes: 5 }, ...over,
} as Commission & { focus: { minutes: number; breakMinutes: number } });

describe('focus blocks', () => {
  const start = at('2026-10-03', 9);

  it('start as the next of the day’s count', () => {
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

  it('count once they run out, then start the break from when the block ended', () => {
    const s = startBlock(study(), start, 'a');
    expect(settle(s, start + 24 * MIN).events).toEqual([]);

    const done = settle(s, start + 40 * MIN);
    expect(done.events).toEqual([{ id: 'focus-a', kind: 'habit', date: '2026-10-03', habitId: 'study' }]);
    expect(done.logged).toEqual({ date: '2026-10-03', habitId: 'study', minutes: 25 });
    expect(done.session).toMatchObject({ phase: 'break', block: 2, startedAt: start + 25 * MIN, endsAt: start + 30 * MIN });
    // Settling again has nothing more to count.
    expect(settle(done.session, start + 40 * MIN).events).toEqual([]);
  });

  it('end without a break after the day’s last block, or with no break set', () => {
    expect(settle(startBlock(study({ completionCount: 3 }), start, 'a'), start + 30 * MIN).session).toBeNull();
    expect(settle(startBlock(study({ focus: { minutes: 25, breakMinutes: 0 } }), start, 'b'), start + 30 * MIN).session).toBeNull();
  });

  it('don’t count while paused', () => {
    const paused = pause(startBlock(study(), start, 'a'), start + MIN);
    expect(settle(paused, start + 90 * MIN).events).toEqual([]);
  });

  it('count on the day they ended when the app only sees them the next morning', () => {
    const late = startBlock(study(), at('2026-10-03', 23, 50), 'a');
    const r = settle(late, at('2026-10-04', 8), '2026-10-04');
    expect(r.events[0].date).toBe('2026-10-04');
    const evening = startBlock(study(), at('2026-10-03', 22), 'b');
    const r2 = settle(evening, at('2026-10-04', 8), '2026-10-04');
    expect(r2.events[0].date).toBe('2026-10-03');
    expect(r2.session).toBeNull(); // last night's break is over
  });

  it('drop a paused block from an earlier day', () => {
    const paused = pause(startBlock(study(), at('2026-10-03', 22), 'a'), at('2026-10-03', 22, 5));
    expect(settle(paused, at('2026-10-04', 8), '2026-10-04')).toEqual({ session: null, events: [], logged: null });
  });

  it('carry on to the next block unless the habit is done', () => {
    const s = startBlock(study(), start, 'a');
    expect(nextBlock(s, study({ completionCount: 2 }), start, 'b')).toMatchObject({ block: 3, phase: 'focus' });
    expect(nextBlock(s, study({ completed: true, completionCount: 4 }), start, 'b')).toBeNull();
    expect(nextBlock(s, undefined, start, 'b')).toBeNull();
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
