import { ACHIEVEMENTS, achievementById, newlyEarned, progressText, type AchievementData } from '../src/achievements';
import { EMPTY_SAVINGS } from '../src/savings';
import type { Commission, CompletionRecord, Stats } from '../src/types';

// 2026-09-21 is a Monday. "Today" is Thursday 2026-10-01.
const day = (n: number) => (n <= 30 ? `2026-09-${String(n).padStart(2, '0')}` : `2026-10-${String(n - 30).padStart(2, '0')}`);
const TODAY = day(31);

const habit = (id: string, over: Partial<Commission> = {}): Commission => ({
  id, label: id, completed: false, days: [], reminderTime: null,
  timesPerDay: 1, completionCount: 0, reminderTimes: [], reminderSplit: null, ...over,
});
const rec = (date: string, scheduled: string[], done: string[]): CompletionRecord => ({
  date, scheduledIds: scheduled, completedIds: done, completed: scheduled.length > 0 && scheduled.every(id => done.includes(id)),
});
const stats = (over: Partial<Stats> = {}): Stats => ({ currentStreak: 0, bestStreak: 0, totalCompleted: 0, lastFullDate: '', ...over });

const data = (over: Partial<AchievementData> = {}): AchievementData => ({
  todayKey: TODAY, stats: stats(), history: [], commissions: [habit('Read')],
  dailyTotals: [], todayHistory: [], spentToday: 0, topUps: [], bills: [], savings: EMPTY_SAVINGS,
  budgetPeriod: 'weekly', budgetAmount: 1000, ...over,
});
const progress = (id: string, d: AchievementData) => achievementById(id)!.progress!(d);

describe('achievements', () => {
  it('have unique ids', () => {
    expect(new Set(ACHIEVEMENTS.map(a => a.id)).size).toBe(ACHIEVEMENTS.length);
  });

  it('awards nothing to a new user', () => {
    expect(newlyEarned(data(), {})).toEqual([]);
  });

  it('counts streaks and check-offs, skipping ones already earned', () => {
    const d = data({ stats: stats({ bestStreak: 8, totalCompleted: 120 }) });
    expect(newlyEarned(d, { 'first-hop': day(1) })).toEqual(['streak-3', 'streak-7', 'done-100']);
    expect(progressText(achievementById('streak-30')!, progress('streak-30', d))).toBe('8/30');
  });

  it("counts today's perfect day", () => {
    expect(newlyEarned(data({ commissions: [habit('Read', { completed: true })] }), {})).toContain('perfect-day');
  });

  it('finds a perfect week, allowing rest days but not missed ones', () => {
    const commissions = [habit('Gym', { days: [1, 2, 3, 4, 5] })]; // weekdays only
    const week = [21, 22, 23, 24, 25].map(n => rec(day(n), ['Gym'], ['Gym']));
    expect(progress('perfect-week', data({ commissions, history: week })).value).toBe(1);
    const missed = week.map((r, i) => (i === 2 ? rec(r.date, ['Gym'], []) : r));
    expect(progress('perfect-week', data({ commissions, history: missed })).value).toBe(0);
    // A weekday the app never saw counts as missed.
    expect(progress('perfect-week', data({ commissions, history: week.filter((_, i) => i !== 1) })).value).toBe(0);
    // This week isn't finished yet.
    expect(progress('perfect-week', data({ commissions, history: [28, 29, 30].map(n => rec(day(n), ['Gym'], ['Gym'])) })).value).toBe(0);
  });

  it('finds a comeback', () => {
    expect(progress('comeback', data({ history: [rec(day(22), ['Read'], []), rec(day(23), ['Read'], ['Read'])] })).value).toBe(1);
    expect(progress('comeback', data({ history: [rec(day(22), ['Read'], []), rec(day(24), ['Read'], ['Read'])] })).value).toBe(0);
  });

  it('finds a met weekly goal, today included', () => {
    const swim = habit('Swim', { perWeek: 2, completed: true });
    expect(progress('weekly-goal', data({ commissions: [swim], history: [rec(day(30), [], ['Swim'])] })).value).toBe(1);
    expect(progress('weekly-goal', data({ commissions: [swim], history: [rec(day(27), [], ['Swim'])] })).value).toBe(0);
  });

  it('tracks logging: first expense, days in a row and categories (bills aside)', () => {
    const entry = (id: string, category?: string, billId?: string) => ({ id, amount: 10, time: '', ...(category ? { category } : {}), ...(billId ? { billId } : {}) });
    const dailyTotals = [24, 25, 26, 27, 28, 29, 30].map(n => ({ date: day(n), total: 10, entries: [entry(`e${n}`, n % 2 ? 'food' : undefined)] }));
    const d = data({ dailyTotals, spentToday: 10, todayHistory: [entry('rent', 'bills', 'b1')] });
    expect(progress('first-spend', d).value).toBe(1);
    expect(progress('logged-7', d)).toEqual({ value: 7, target: 7 });
    expect(progress('sorted-25', d).value).toBe(3); // the 25th, 27th and 29th
  });

  it('ends a week under a weekly budget, but not the week still going', () => {
    const dailyTotals = [{ date: day(22), total: 300, entries: [] }, { date: day(29), total: 100, entries: [] }];
    expect(progress('under-budget', data({ dailyTotals })).value).toBe(1);
    expect(progress('under-budget', data({ dailyTotals: [{ date: day(22), total: 1300, entries: [] }] })).value).toBe(0);
    expect(progress('under-budget', data({ dailyTotals: [{ date: day(29), total: 100, entries: [] }] })).value).toBe(0);
  });

  it('needs a week of days under a daily budget', () => {
    const under = [21, 22, 23].map(n => ({ date: day(n), total: 50, entries: [] }));
    expect(progress('under-budget', data({ dailyTotals: under, budgetPeriod: 'daily', budgetAmount: 100 })).value).toBe(1);
    expect(progress('under-budget', data({ dailyTotals: under.slice(0, 2), budgetPeriod: 'daily', budgetAmount: 100 })).value).toBe(0);
    expect(progress('under-budget', data({ dailyTotals: [...under, { date: day(24), total: 150, entries: [] }], budgetPeriod: 'daily', budgetAmount: 100 })).value).toBe(0);
  });

  it('follows the savings jar', () => {
    const savings = { jars: [{ id: 'jar-1', goal: { name: 'Phone', emoji: '📱', target: 1000, createdAt: day(1) }, entries: [{ id: 'j', amount: 600, date: day(2), kind: 'deposit' as const }] }] };
    const d = data({ savings });
    expect(newlyEarned(d, {})).toEqual(expect.arrayContaining(['saver', 'jar-half']));
    expect(newlyEarned(d, {})).not.toContain('jar-full');
    expect(progressText(achievementById('jar-full')!, progress('jar-full', d))).toBe('60% full');
  });

  it("leaves events to the app", () => {
    expect(achievementById('hello-bonbon')!.progress).toBeUndefined();
  });
});
