import { firstMonth, monthStart, monthSummary } from '../src/monthSummary';
import type { DailyTotal } from '../src/types';

const e = (id: string, amount: number, category?: string, billId?: string) =>
  ({ id, amount, time: '9:00 AM', ...(category ? { category } : {}), ...(billId ? { billId } : {}) });

const august: DailyTotal[] = [
  { date: '2026-08-03', total: 900, entries: [e('a1', 900, 'food')] },
  { date: '2026-08-20', total: 2000, entries: [e('a2', 2000, 'shopping')] },
];
const september: DailyTotal[] = [
  { date: '2026-09-01', total: 8000, entries: [e('rent', 8000, 'bills', 'b1')] },
  { date: '2026-09-02', total: 1500, entries: [e('s1', 1200, 'food'), e('s2', 300, 'transport')] },
  { date: '2026-09-12', total: 2300, entries: [e('s3', 2300, 'fun')] },
];

const base = {
  todayKey: '2026-10-05', dailyTotals: [...august, ...september], todayHistory: [], spentToday: 0,
  topUps: [{ id: 't', amount: 1000, date: '2026-09-15' }], bills: [],
  savings: { jars: [{ id: 'jar-1', goal: { name: 'Trip', emoji: '✈️', target: 9000, createdAt: '2026-09-01' }, entries: [{ id: 'j', amount: 1500, date: '2026-09-28', kind: 'leftover' as const }] }] },
  history: [
    { date: '2026-09-02', completed: true, completedIds: ['h'], scheduledIds: ['h'] },
    { date: '2026-09-03', completed: false, completedIds: [], scheduledIds: ['h'] },
    { date: '2026-09-06', completed: false, completedIds: [], scheduledIds: ['h'], skippedIds: ['h'] }, // rest
  ],
  budgetPeriod: 'monthly' as const, budgetAmount: 15000,
};

describe('monthSummary (finished month)', () => {
  const s = monthSummary({ ...base, month: '2026-09-17' });

  it('totals the month against the whole month before', () => {
    expect(s).toMatchObject({ label: 'September 2026', inProgress: false, end: '2026-09-30', spent: 11800, prevSpent: 2900, prevName: 'August' });
    expect(s.avgPerDay).toBeCloseTo(11800 / 30);
  });

  it('keeps bills out of biggest spends and the busiest day', () => {
    expect(s.billsPaid).toBe(8000);
    expect(s.topExpenses.map(x => x.id)).toEqual(['s3', 's1', 's2']);
    expect(s.busiestDay).toEqual({ date: '2026-09-12', total: 2300 });
  });

  it('compares each category with last month', () => {
    expect(s.byCategory.map(c => [c.key, c.total, c.prev])).toEqual([
      ['bills', 8000, 0], ['fun', 2300, 0], ['food', 1200, 900], ['transport', 300, 0],
    ]);
  });

  it('reports money added and saved, the budget and perfect days', () => {
    expect(s).toMatchObject({ added: 1000, saved: 1500 });
    // Rent is set aside by its bill rather than counted from its entry.
    const rent = { id: 'b1', name: 'Rent', amount: 8000, repeat: 'monthly' as const, day: 1, inBudget: true, remind: false, startDate: '2026-08-01' };
    expect(monthSummary({ ...base, month: '2026-09-17', bills: [rent] }).budget).toEqual({ kind: 'monthly', budget: 16000, left: 16000 - 11800 });
    expect(s.habits).toEqual({ perfectDays: 1, trackedDays: 2 });
  });
});

describe('monthSummary (month in progress)', () => {
  it('compares with the same stretch of last month', () => {
    const s = monthSummary({ ...base, month: '2026-09-02', todayKey: '2026-09-05', dailyTotals: [...august, ...september.slice(0, 2)] });
    expect(s).toMatchObject({ inProgress: true, end: '2026-09-05', spent: 9500, prevSpent: 900 });
  });
});

describe('budget results for other periods', () => {
  it('counts weeks under budget for weekly budgets', () => {
    // Weeks ending Sun Sep 6 (rent + 1500 = 1500 counted) and Sun Sep 13 (2300).
    const s = monthSummary({ ...base, month: '2026-09-01', budgetPeriod: 'weekly', budgetAmount: 2000 });
    expect(s.budget).toEqual({ kind: 'weekly', weeks: 2, weeksUnder: 1 });
  });

  it('adds up daily allowances over days with spending for daily budgets', () => {
    const s = monthSummary({ ...base, month: '2026-09-01', budgetPeriod: 'daily', budgetAmount: 2000 });
    // 3 days × 2000; counted spending 0 (rent is only tracked) + 1500 + 2300.
    expect(s.budget).toEqual({ kind: 'daily', budget: 6000, left: 6000 - 3800 });
  });
});

describe('helpers', () => {
  it('finds month starts and the first month with data', () => {
    expect(monthStart('2026-09-17', -1)).toBe('2026-08-01');
    expect(monthStart('2026-01-31', -1)).toBe('2025-12-01');
    expect(firstMonth(august, [], '2026-10-05')).toBe('2026-08-01');
  });
});
