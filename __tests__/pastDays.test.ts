import { rolloverHabits } from '../src/dayRollover';
import { changeEntry, dayName, entryOn, recentDays, removeEntry, setYesterday, yesterdayState, type Books } from '../src/pastDays';
import type { Commission, CompletionRecord, Stats } from '../src/types';

// 2026-09-28 is a Monday.
const SUN = '2026-09-27', MON = '2026-09-28', TUE = '2026-09-29', WED = '2026-09-30';

const habit = (id: string, over: Partial<Commission> = {}): Commission => ({
  id, label: id, completed: false, days: [], reminderTime: null,
  timesPerDay: 1, completionCount: 0, reminderTimes: [], reminderSplit: null, ...over,
});
const habits = [habit('h1'), habit('h2')];

/**
 * Monday both done (a 4-day streak, credited live), Tuesday h2 missed. The day rolls over
 * into Wednesday the way the app does it.
 */
const wednesday = () => {
  const history: CompletionRecord[] = [{ date: MON, completed: true, completedIds: ['h1', 'h2'], scheduledIds: ['h1', 'h2'] }];
  const tuesday: Stats = { currentStreak: 4, bestStreak: 4, totalCompleted: 20, lastFullDate: MON };
  return rolloverHabits({
    date: TUE, commissions: habits.map(h => ({ ...h, completed: h.id === 'h1' })), stats: tuesday, history,
  }, WED);
};

describe('ticking off yesterday', () => {
  it('keeps where the streak stood before yesterday when the day rolls over', () => {
    const r = wednesday();
    expect(r.stats).toMatchObject({ currentStreak: 0, bestStreak: 4, lastFullDate: MON });
    expect(r.stats.yesterday).toEqual({ date: TUE, base: { currentStreak: 4, bestStreak: 4, lastFullDate: MON } });
  });

  it('brings the streak back when yesterday is finished, and takes it away again when undone', () => {
    const r = wednesday();
    const fixed = setYesterday({ habitId: 'h2', done: true, commissions: habits, history: r.history, stats: r.stats, todayKey: WED });
    expect(fixed.stats).toMatchObject({ currentStreak: 5, bestStreak: 5, lastFullDate: TUE, totalCompleted: 21 });
    expect(fixed.history.find(h => h.date === TUE)).toMatchObject({ completed: true, completedIds: ['h1', 'h2'] });

    const undone = setYesterday({ habitId: 'h2', done: false, commissions: habits, history: fixed.history, stats: fixed.stats, todayKey: WED });
    expect(undone.stats).toMatchObject({ currentStreak: 0, bestStreak: 4, lastFullDate: MON, totalCompleted: 20 });
  });

  it('carries on through today when today already counted', () => {
    const r = wednesday();
    // Wednesday finished first: the streak started again at 1.
    const today: Stats = { ...r.stats, currentStreak: 1, lastFullDate: WED, beforeToday: { currentStreak: 0, bestStreak: 4, lastFullDate: MON } };
    const history = [...r.history, { date: WED, completed: true, completedIds: ['h1', 'h2'], scheduledIds: ['h1', 'h2'] }];
    const fixed = setYesterday({ habitId: 'h2', done: true, commissions: habits, history, stats: today, todayKey: WED });
    expect(fixed.stats).toMatchObject({ currentStreak: 6, bestStreak: 6, lastFullDate: WED, beforeToday: { currentStreak: 5, bestStreak: 5, lastFullDate: TUE } });

    const undone = setYesterday({ habitId: 'h2', done: false, commissions: habits, history: fixed.history, stats: fixed.stats, todayKey: WED });
    expect(undone.stats).toMatchObject({ currentStreak: 1, bestStreak: 4, lastFullDate: WED });
  });

  it('makes yesterday’s record when the app wasn’t opened, and counts it once everything is done', () => {
    const history: CompletionRecord[] = [{ date: MON, completed: true, completedIds: ['h1', 'h2'], scheduledIds: ['h1', 'h2'] }];
    const r = rolloverHabits({ date: MON, commissions: habits, stats: { currentStreak: 4, bestStreak: 4, totalCompleted: 20, lastFullDate: MON }, history }, WED);
    expect(r.stats.yesterday).toEqual({ date: TUE, base: { currentStreak: 4, bestStreak: 4, lastFullDate: MON } });

    const one = setYesterday({ habitId: 'h1', done: true, commissions: habits, history: r.history, stats: r.stats, todayKey: WED });
    expect(one.history.find(h => h.date === TUE)).toEqual({ date: TUE, completed: false, completedIds: ['h1'], scheduledIds: ['h1', 'h2'] });
    expect(one.stats.currentStreak).toBe(0);
    const both = setYesterday({ habitId: 'h2', done: true, commissions: habits, history: one.history, stats: one.stats, todayKey: WED });
    expect(both.stats).toMatchObject({ currentStreak: 5, lastFullDate: TUE, totalCompleted: 22 });
  });

  it('adds an "N× a week" day without touching the day streak, and tidies up an empty day', () => {
    const weekly = habit('w', { perWeek: 3 });
    const stats: Stats = { currentStreak: 2, bestStreak: 2, totalCompleted: 5, lastFullDate: MON };
    const r = setYesterday({ habitId: 'w', done: true, commissions: [weekly], history: [], stats, todayKey: WED });
    expect(r.history).toEqual([{ date: TUE, completed: false, completedIds: ['w'], scheduledIds: [] }]);
    expect(r.stats).toEqual({ ...stats, totalCompleted: 6 });
    expect(setYesterday({ habitId: 'w', done: false, commissions: [weekly], history: r.history, stats: r.stats, todayKey: WED }).history).toEqual([]);
  });

  it('is offered for a missed or skipped day, or an "N× a week" Habbit, not for a rest day or a new one', () => {
    const history: CompletionRecord[] = [
      { date: MON, completed: true, completedIds: ['h1'], scheduledIds: ['h1'] },
      { date: TUE, completed: false, completedIds: [], scheduledIds: ['h1'], skippedIds: ['h1'] },
    ];
    expect(yesterdayState(habit('h1'), history, WED)).toBe('not-done');
    expect(yesterdayState(habit('h1'), [...history.slice(0, 1), { ...history[1], completedIds: ['h1'] }], WED)).toBe('done');
    expect(yesterdayState(habit('h1', { days: [1] }), [history[0]], WED)).toBeNull();          // Mondays only
    // Real ids start with when the Habbit was made (Sunday here).
    expect(yesterdayState(habit(`${new Date(2026, 8, 27, 9).getTime()}wkly`, { perWeek: 3 }), history, WED)).toBe('not-done');
    const madeToday = habit(`${new Date(2026, 8, 30, 9).getTime()}abcd`);
    expect(yesterdayState(madeToday, history, WED)).toBeNull();
  });
});

describe('spending on earlier days', () => {
  const books: Books = {
    finance: { date: WED, spentToday: 300, history: [
      { id: 'a', amount: 100, time: '9:00 AM', note: 'Coffee', category: 'food' },
      { id: 'b', amount: 200, time: '12:30 PM' },
    ] },
    dailyTotals: [
      { date: SUN, total: 80, entries: [{ id: 'bill', amount: 80, time: '', note: 'Phone', category: 'bills', billId: 'p' }] },
      { date: TUE, total: 150, entries: [{ id: 'c', amount: 150, time: '7:00 PM', note: 'Dinner' }] },
    ],
  };

  it('changes an entry where it is, keeping its time and place', () => {
    const today = changeEntry(books, 'a', WED, { amount: 120.5, note: ' Latte ', category: 'fun' });
    expect(today.finance.spentToday).toBe(320.5);
    expect(today.finance.history.map(e => e.id)).toEqual(['a', 'b']);
    expect(today.finance.history[0]).toEqual({ id: 'a', amount: 120.5, time: '9:00 AM', note: 'Latte', category: 'fun' });

    const past = changeEntry(books, 'c', TUE, { amount: 90 });
    expect(past.dailyTotals.find(d => d.date === TUE)).toEqual({ date: TUE, total: 90, entries: [{ id: 'c', amount: 90, time: '7:00 PM' }] });
  });

  it('moves an entry between days, and drops a past day left empty', () => {
    const back = changeEntry(books, 'b', WED, { amount: 200 }, TUE);
    expect(back.finance).toMatchObject({ spentToday: 100, history: [expect.objectContaining({ id: 'a' })] });
    expect(back.dailyTotals.find(d => d.date === TUE)).toMatchObject({ total: 350, entries: [{ id: 'c' }, { id: 'b' }] });

    const forward = changeEntry(books, 'c', TUE, { amount: 150, note: 'Dinner' }, WED);
    expect(forward.dailyTotals.map(d => d.date)).toEqual([SUN]);
    expect(forward.finance.spentToday).toBe(450);
    expect(entryOn(forward, 'c', WED)).toMatchObject({ amount: 150, note: 'Dinner' });

    const monday = changeEntry(books, 'a', WED, { amount: 100 }, MON);
    expect(monday.dailyTotals.map(d => d.date)).toEqual([SUN, MON, TUE]);
  });

  it('keeps a bill’s payment on its day, and ignores an amount of nothing', () => {
    const bill = changeEntry(books, 'bill', SUN, { amount: 95, category: 'bills' }, WED);
    expect(bill.finance).toBe(books.finance);
    expect(bill.dailyTotals[0]).toMatchObject({ date: SUN, total: 95, entries: [{ id: 'bill', amount: 95, billId: 'p' }] });
    expect(changeEntry(books, 'a', WED, { amount: 0 })).toBe(books);
    expect(changeEntry(books, 'nope', WED, { amount: 5 })).toBe(books);
  });

  it('removes an entry from today or an earlier day', () => {
    expect(removeEntry(books, 'b', WED).finance).toMatchObject({ spentToday: 100, history: [{ id: 'a' }] });
    expect(removeEntry(books, 'c', TUE).dailyTotals.map(d => d.date)).toEqual([SUN]);
    expect(removeEntry(books, 'c', WED)).toBe(books);
  });

  it('names the days it can go on', () => {
    expect(recentDays(WED).map(d => d.label)).toEqual(['Today', 'Yesterday', 'Monday', 'Sunday', 'Saturday', 'Friday', 'Thursday']);
    expect(recentDays(WED)[2].key).toBe(MON);
    expect(dayName('2026-09-20', WED)).toBe('Sep 20');
  });
});
