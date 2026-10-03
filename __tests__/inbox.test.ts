import { applyCheckOffs, applySpending, catchUpDay, parseInbox, type InboxEvent } from '../src/inbox';
import { rolloverHabits } from '../src/dayRollover';
import type { Commission, Stats } from '../src/types';

// 2026-09-28 is a Monday.
const MON = '2026-09-28', TUE = '2026-09-29', WED = '2026-09-30';

const habit = (over: Partial<Commission> = {}): Commission => ({
  id: 'h1', label: 'Read', completed: false, days: [], reminderTime: null,
  timesPerDay: 1, completionCount: 0, reminderTimes: [], reminderSplit: null, ...over,
});
const stats = (over: Partial<Stats> = {}): Stats =>
  ({ currentStreak: 0, bestStreak: 0, totalCompleted: 0, lastFullDate: '', ...over });
const spend = (id: string, date: string, amount: number, over: Partial<InboxEvent> = {}): InboxEvent =>
  ({ id, kind: 'spend', date, time: '9:00 PM', amount, ...over } as InboxEvent);
const checkOff = (id: string, date: string, habitId = 'h1'): InboxEvent => ({ id, kind: 'habit', date, habitId });

describe('parseInbox', () => {
  it('keeps the focus timer’s pause and resume', () => {
    expect(parseInbox(JSON.stringify([
      { id: 'p', kind: 'focus', date: MON, action: 'pause', at: 1790990000000 },
      { id: 'q', kind: 'focus', date: MON, action: 'stop', at: 1790990000000 },
      { id: 'r', kind: 'focus', date: MON, action: 'resume' },
    ]))).toEqual([{ id: 'p', kind: 'focus', date: MON, action: 'pause', at: 1790990000000 }]);
  });

  it('keeps well-formed events and drops the rest', () => {
    const raw = JSON.stringify([
      { id: 'a', kind: 'spend', date: MON, time: '1:00 PM', amount: 150.456, category: 'food', note: '  Lunch ' },
      { id: 'b', kind: 'spend', date: MON, time: '', amount: -5 },
      { id: 'c', kind: 'spend', date: MON, time: '', amount: 20, category: 'nope' },
      { id: 'd', kind: 'habit', date: MON, habitId: 'h1' },
      { id: 'e', kind: 'habit', date: 'monday', habitId: 'h1' },
      { kind: 'habit', date: MON, habitId: 'h1' },
      null, 'x',
    ]);
    expect(parseInbox(raw)).toEqual([
      { id: 'a', kind: 'spend', date: MON, time: '1:00 PM', amount: 150.46, category: 'food', note: 'Lunch' },
      { id: 'c', kind: 'spend', date: MON, time: '', amount: 20 },
      { id: 'd', kind: 'habit', date: MON, habitId: 'h1' },
    ]);
  });

  it('treats a missing or broken queue as empty', () => {
    expect(parseInbox(null)).toEqual([]);
    expect(parseInbox('{oops')).toEqual([]);
    expect(parseInbox('{}')).toEqual([]);
  });
});

describe('applySpending', () => {
  it("adds today's to today and backdates earlier ones, once each", () => {
    const finance = { spentToday: 10, date: TUE, history: [{ id: 'x', amount: 10, time: '' }] };
    const events = [spend('a', TUE, 150, { category: 'food' }), spend('b', MON, 40), spend('a', TUE, 150)];
    const r = applySpending(finance, [{ date: MON, total: 5, entries: [] }], events);
    expect(r.changed).toBe(true);
    expect(r.finance.spentToday).toBe(160);
    expect(r.finance.history.map(e => e.id)).toEqual(['x', 'a']);
    expect(r.finance.history[1]).toEqual({ id: 'a', amount: 150, time: '9:00 PM', category: 'food' });
    expect(r.dailyTotals).toEqual([{ date: MON, total: 45, entries: [{ id: 'b', amount: 40, time: '9:00 PM' }] }]);
  });

  it('changes nothing without spending events', () => {
    const finance = { spentToday: 0, date: TUE, history: [] };
    const r = applySpending(finance, [], [checkOff('a', TUE)]);
    expect(r.changed).toBe(false);
    expect(r.finance).toBe(finance);
  });
});

describe('applyCheckOffs', () => {
  it('checks off a habit on its day, once', () => {
    const r = applyCheckOffs([habit({ skipped: true })], [checkOff('a', TUE), checkOff('b', TUE)], TUE);
    expect(r.commissions[0]).toMatchObject({ completed: true, skipped: false });
    expect(r.finished).toBe(1);
  });

  it('counts one step per check-off for multi-times habits', () => {
    const items = [habit({ timesPerDay: 3, completionCount: 1 })];
    const once = applyCheckOffs(items, [checkOff('a', TUE)], TUE);
    expect(once.commissions[0]).toMatchObject({ completionCount: 2, completed: false });
    expect(once.finished).toBe(0);
    const twice = applyCheckOffs(items, [checkOff('a', TUE), checkOff('b', TUE)], TUE);
    expect(twice.commissions[0]).toMatchObject({ completionCount: 3, completed: true });
    expect(twice.finished).toBe(1);
  });

  it('ignores other days, unscheduled habits and unknown ids', () => {
    const items = [habit({ days: [1] }), habit({ id: 'w', perWeek: 3 })]; // Mondays only; weekly
    const r = applyCheckOffs(items, [checkOff('a', MON), checkOff('b', TUE), checkOff('c', TUE, 'gone'), checkOff('d', TUE, 'w')], TUE);
    expect(r.commissions[0].completed).toBe(false);
    expect(r.commissions[1].completed).toBe(true); // weekly habits can be done any day
    expect(r.finished).toBe(1);
  });
});

describe('rolloverHabits', () => {
  it('credits a day finished without the app seeing it', () => {
    const r = rolloverHabits({
      date: TUE, commissions: [habit({ completed: true })],
      stats: stats({ currentStreak: 4, bestStreak: 4, lastFullDate: MON }), history: [],
    }, WED);
    expect(r.stats).toMatchObject({ currentStreak: 5, bestStreak: 5, lastFullDate: TUE });
  });
});

describe('catchUpDay', () => {
  const base = (over: Partial<Parameters<typeof catchUpDay>[0]> = {}) => ({
    habits: { date: TUE, commissions: [habit()], stats: stats({ currentStreak: 4, bestStreak: 4, lastFullDate: MON, totalCompleted: 9 }), history: [] },
    finance: { spentToday: 0, date: TUE, history: [] },
    dailyTotals: [],
    bills: [],
    ...over,
  });

  it("applies last night's check-off before the new day, keeping the streak", () => {
    const r = catchUpDay(base(), WED, [checkOff('a', TUE), spend('s', TUE, 80), spend('t', WED, 20)]);
    expect(r.newDay).toBe(true);
    expect(r.history).toEqual([{ date: TUE, completed: true, completedIds: ['h1'], scheduledIds: ['h1'] }]);
    expect(r.stats).toMatchObject({ currentStreak: 5, lastFullDate: TUE, totalCompleted: 10 });
    expect(r.commissions[0].completed).toBe(false); // a fresh day
    expect(r.dailyTotals).toEqual([{ date: TUE, total: 80, entries: [expect.objectContaining({ id: 's' })] }]);
    expect(r.finance).toMatchObject({ date: WED, spentToday: 20 });
  });

  it("applies today's check-off after the new day starts", () => {
    const r = catchUpDay(base(), WED, [checkOff('a', WED)]);
    expect(r.commissions[0].completed).toBe(true);
    expect(r.stats.currentStreak).toBe(0); // Tuesday was missed
    expect(r.stats.totalCompleted).toBe(10);
  });

  it('applies events on the same day without a rollover', () => {
    const r = catchUpDay(base(), TUE, [checkOff('a', TUE)]);
    expect(r.newDay).toBe(false);
    expect(r.habitsChanged).toBe(true);
    expect(r.financeChanged).toBe(false);
    expect(r.commissions[0].completed).toBe(true);
    expect(r.stats.currentStreak).toBe(4); // credited live by the app, not here
  });

  it('reports no changes when nothing happened', () => {
    const r = catchUpDay(base(), TUE, []);
    expect(r).toMatchObject({ newDay: false, habitsChanged: false, financeChanged: false, billsChanged: false });
  });
});
