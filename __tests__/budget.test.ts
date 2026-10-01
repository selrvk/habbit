import { computeBudget, periodStart, periodEnd } from '../src/budget';

// 2026-10-01 is a Thursday.
const THU = '2026-10-01';

describe('periods', () => {
  it('weeks run Monday to Sunday', () => {
    expect(periodStart('weekly', THU)).toBe('2026-09-28');
    expect(periodEnd('weekly', THU)).toBe('2026-10-04');
    expect(periodStart('weekly', '2026-10-04')).toBe('2026-09-28'); // Sunday
    expect(periodStart('weekly', '2026-09-28')).toBe('2026-09-28'); // Monday
  });
  it('months run 1st to last day', () => {
    expect(periodStart('monthly', '2026-02-14')).toBe('2026-02-01');
    expect(periodEnd('monthly', '2026-02-14')).toBe('2026-02-28');
    expect(periodEnd('monthly', '2028-02-14')).toBe('2028-02-29');
  });
});

describe('computeBudget', () => {
  it('daily: allowance is the daily amount plus today\'s top-ups', () => {
    const b = computeBudget({
      period: 'daily', amount: 500, todayKey: THU, spentToday: 120,
      dailyTotals: [{ date: '2026-09-30', total: 900 }],
      topUps: [{ id: 'a', amount: 100, date: THU }, { id: 'b', amount: 50, date: '2026-09-30' }],
    });
    expect(b.dailyAllowance).toBe(600);
    expect(b.leftToday).toBe(480);
  });

  it('weekly: spreads what is left over the remaining days', () => {
    // ₱7,000/week. Mon–Wed spent 1,000 each → 4,000 left over Thu–Sun (4 days) → 1,000/day.
    const b = computeBudget({
      period: 'weekly', amount: 7000, todayKey: THU, spentToday: 250,
      dailyTotals: [
        { date: '2026-09-27', total: 5000 }, // previous week, ignored
        { date: '2026-09-28', total: 1000 },
        { date: '2026-09-29', total: 1000 },
        { date: '2026-09-30', total: 1000 },
      ],
      topUps: [],
    });
    expect(b.daysLeft).toBe(4);
    expect(b.dailyAllowance).toBe(1000);
    expect(b.leftToday).toBe(750);
    expect(b.periodLeft).toBe(7000 - 3250);
  });

  it('weekly: overspending shrinks later days, top-ups grow them', () => {
    const base = { period: 'weekly' as const, amount: 7000, todayKey: THU, spentToday: 0 };
    const over = computeBudget({ ...base, dailyTotals: [{ date: '2026-09-28', total: 5000 }], topUps: [] });
    expect(over.dailyAllowance).toBe(500);
    const topped = computeBudget({ ...base, dailyTotals: [{ date: '2026-09-28', total: 5000 }], topUps: [{ id: 'x', amount: 2000, date: '2026-09-29' }] });
    expect(topped.dailyAllowance).toBe(1000);
    expect(topped.periodBudget).toBe(9000);
  });

  it('never gives a negative allowance', () => {
    const b = computeBudget({
      period: 'weekly', amount: 1000, todayKey: THU, spentToday: 50,
      dailyTotals: [{ date: '2026-09-28', total: 3000 }], topUps: [],
    });
    expect(b.dailyAllowance).toBe(0);
    expect(b.leftToday).toBe(-50);
    expect(b.periodLeft).toBe(-2050);
  });
});
