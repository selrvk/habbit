import { liveRecord, recapWeek, weekLabel, weekSummary, weekTip, weekTrend, type WeekData } from '../src/weekSummary';
import { EMPTY_SAVINGS } from '../src/savings';
import type { Commission, CompletionRecord } from '../src/types';

// 2026-09-21 is a Monday; the week runs to Sunday 2026-09-27.
const day = (n: number) => `2026-09-${String(n).padStart(2, '0')}`;
const MON = day(21), SUN = day(27);

const habit = (id: string, over: Partial<Commission> = {}): Commission => ({
  id, label: id, completed: false, days: [], reminderTime: null,
  timesPerDay: 1, completionCount: 0, reminderTimes: [], reminderSplit: null, ...over,
});
const rec = (date: string, scheduled: string[], done: string[], skipped: string[] = []): CompletionRecord => ({
  date, scheduledIds: scheduled, completedIds: done, ...(skipped.length ? { skippedIds: skipped } : {}),
  completed: scheduled.filter(id => !skipped.includes(id)).every(id => done.includes(id)) && scheduled.length > skipped.length,
});

const data = (over: Partial<WeekData> = {}): WeekData => ({
  todayKey: day(29), commissions: [habit('Read'), habit('Gym')], history: [],
  dailyTotals: [], todayHistory: [], spentToday: 0, topUps: [], bills: [], savings: EMPTY_SAVINGS, focusLog: [],
  budgetPeriod: 'weekly', budgetAmount: 3500, ...over,
});

describe('weekLabel / recapWeek', () => {
  it('labels weeks across months', () => {
    expect(weekLabel(MON)).toBe('Sep 21 – 27');
    expect(weekLabel(day(28))).toBe('Sep 28 – Oct 4');
  });
  it('opens this week on Sunday and last week otherwise', () => {
    expect(recapWeek(SUN)).toBe(MON);
    expect(recapWeek(day(29))).toBe(MON);
  });
});

describe('weekSummary habits', () => {
  // Read every day; Gym missed Sat and Sun; Wednesday skipped Gym.
  const history = [21, 22, 23, 24, 25, 26, 27].map(n =>
    n === 23 ? rec(day(n), ['Read', 'Gym'], ['Read'], ['Gym'])
    : n >= 26 ? rec(day(n), ['Read', 'Gym'], ['Read'])
    : rec(day(n), ['Read', 'Gym'], ['Read', 'Gym']));

  it('counts perfect days, the best habit, the one that slipped and a weekend dip', () => {
    const s = weekSummary(MON, data({ history }));
    expect(s).toMatchObject({ start: MON, end: SUN, inProgress: false });
    expect(s.habits.perfectDays).toBe(5); // Wednesday counts: Gym was skipped
    expect(s.habits.trackedDays).toBe(7);
    expect(s.habits.done).toBe(7 + 4);
    expect(s.habits.best).toMatchObject({ label: 'Read', done: 7, of: 7 });
    expect(s.habits.slipped).toMatchObject({ label: 'Gym', missed: 2, of: 6 });
    expect(s.habits.weekendDip).toEqual({ weekday: 1, weekend: 0.5 });
  });

  it("doesn't hold today against the week while it's going", () => {
    const commissions = [habit('Read', { completed: true }), habit('Gym')];
    const s = weekSummary(MON, data({ todayKey: SUN, commissions, history: history.filter(r => r.date < SUN) }));
    expect(s).toMatchObject({ end: SUN, inProgress: true });
    expect(s.habits.trackedDays).toBe(6); // Sunday isn't finished
    expect(s.habits.slipped).toMatchObject({ label: 'Gym', missed: 1 }); // only Saturday so far
  });

  it('counts "N× a week" habits and leaves out deleted ones', () => {
    const weekly = habit('Swim', { perWeek: 3 });
    const s = weekSummary(MON, data({
      commissions: [habit('Read'), weekly],
      history: [rec(day(21), ['Read', 'Gone'], ['Read', 'Swim']), rec(day(22), ['Read'], ['Read', 'Swim'])],
    }));
    expect(s.habits.weekly).toEqual([{ label: 'Swim', done: 2, target: 3 }]);
    expect(s.habits.slipped).toBeNull(); // "Gone" was deleted
  });
});

describe('weekSummary money', () => {
  const dailyTotals = [
    { date: day(15), total: 400, entries: [] },
    { date: day(22), total: 700, entries: [{ id: 'a', amount: 600, time: '', note: 'Groceries', category: 'food' }, { id: 'b', amount: 100, time: '', category: 'fun' }] },
    { date: day(24), total: 1000, entries: [{ id: 'r', amount: 1000, time: '', category: 'bills', billId: 'rent' }] },
  ];
  const bills = [{ id: 'rent', name: 'Rent', amount: 1000, repeat: 'weekly' as const, day: 4, inBudget: true, remind: false, startDate: day(1) }];

  it('compares with last week and measures the weekly budget', () => {
    const s = weekSummary(MON, data({ dailyTotals, bills }));
    expect(s.money.spent).toBe(1700);
    expect(s.money.prevSpent).toBe(400);
    expect(s.money.budget).toEqual({ kind: 'weekly', budget: 3500, left: 1800 });
    expect(s.money.topCategory?.key).toBe('food'); // rent left out
    expect(s.money.biggest).toMatchObject({ note: 'Groceries', date: day(22) }); // bills left out
  });

  it('counts days under a daily budget', () => {
    const s = weekSummary(MON, data({ dailyTotals, budgetPeriod: 'daily', budgetAmount: 500 }));
    expect(s.money.budget).toEqual({ kind: 'daily', days: 2, daysUnder: 1 }); // rent day doesn't count on daily budgets
  });

  it('picks the best day by habits, then the least spent', () => {
    const history = [rec(day(21), ['Read'], ['Read']), rec(day(22), ['Read'], ['Read']), rec(day(23), ['Read'], [])];
    const s = weekSummary(MON, data({ history, dailyTotals }));
    expect(s.bestDay).toMatchObject({ date: day(21), done: 1, of: 1, spent: 0 });
  });
});

describe('weekSummary focus', () => {
  const focusLog = [
    { date: day(15), habitId: 'Read', minutes: 50 },
    { date: day(22), habitId: 'Read', minutes: 50 },
    { date: day(22), habitId: 'Gym', minutes: 25 },
    { date: day(24), habitId: 'Read', minutes: 25 },
    { date: day(25), habitId: 'Gone', minutes: 20 },
    { date: day(28), habitId: 'Read', minutes: 25 },
  ];

  it('adds up the week, by habit, against the week before', () => {
    const s = weekSummary(MON, data({ focusLog }));
    expect(s.focus).toEqual({
      minutes: 120, prevMinutes: 50, days: 3,
      habits: [{ id: 'Read', label: 'Read', minutes: 75 }, { id: 'Gym', label: 'Gym', minutes: 25 }], // "Gone" was deleted
    });
  });

  it('compares the same days of last week while the week is going', () => {
    const s = weekSummary(MON, data({ todayKey: day(22), focusLog: [...focusLog, { date: day(16), habitId: 'Read', minutes: 30 }] }));
    expect(s.focus).toMatchObject({ minutes: 75, prevMinutes: 50 }); // Sep 16 is after the same point of last week
  });

  it('is null for a week with no focus time', () => {
    expect(weekSummary(day(7), data({ focusLog })).focus).toBeNull();
  });

  it('counts toward the trend', () => {
    expect(weekTrend(MON, data({ focusLog }), 2).map(w => w.focusMinutes)).toEqual([50, 120]);
  });
});

describe('weekTip', () => {
  const commissions = [habit('Read'), habit('Gym', { reminderTime: { hour: 7, minute: 0 } as any })];
  it('says something for a quiet week', () => {
    expect(weekTip(weekSummary(MON, data()), commissions)).toMatch(/quiet week/);
  });
  it('points at the habit that slipped', () => {
    const history = [21, 22, 23, 24, 25].map(n => rec(day(n), ['Read', 'Gym'], n % 2 ? ['Read'] : ['Read', 'Gym']));
    expect(weekTip(weekSummary(MON, data({ commissions, history })), commissions)).toBe('Gym slipped 3 times. Try moving its reminder to a time that suits you better.');
  });
  it('notices more focus time', () => {
    const history = [rec(day(21), ['Read', 'Gym'], ['Read', 'Gym']), rec(day(22), ['Read', 'Gym'], ['Read'])];
    const focusLog = [{ date: day(15), habitId: 'Read', minutes: 50 }, { date: day(22), habitId: 'Read', minutes: 100 }];
    expect(weekTip(weekSummary(MON, data({ history, focusLog })), commissions)).toBe('You focused 100% longer than last week. Keep those blocks coming 🥕');
  });
  it('celebrates a perfect week', () => {
    const history = [21, 22, 23].map(n => rec(day(n), ['Read'], ['Read']));
    expect(weekTip(weekSummary(MON, data({ history })), commissions)).toMatch(/perfect week/);
  });
});

describe('weekTrend', () => {
  it('gives the last weeks oldest first', () => {
    const t = weekTrend(MON, data({ dailyTotals: [{ date: day(15), total: 400 }], history: [rec(day(21), ['Read'], ['Read'])] }), 3);
    expect(t.map(w => w.start)).toEqual([day(7), day(14), MON]);
    expect(t[1].spent).toBe(400);
    expect(t[2]).toMatchObject({ perfectDays: 1, trackedDays: 1 });
  });
});

describe('liveRecord', () => {
  it('records today like the rollover will', () => {
    const r = liveRecord([habit('Read', { completed: true }), habit('Gym', { skipped: true }), habit('Swim', { perWeek: 2, completed: true })], MON);
    expect(r).toEqual({ date: MON, completed: true, completedIds: ['Read', 'Swim'], scheduledIds: ['Read', 'Gym'], skippedIds: ['Gym'] });
  });
});
