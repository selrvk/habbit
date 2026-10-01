import { jarTotal, leftoverOffer } from '../src/savings';

// 2026-10-01 is a Thursday; last week ran Mon 2026-09-21 to Sun 2026-09-27.
const base = { amount: 3500, todayKey: '2026-10-01', topUps: [], bills: [] };

describe('leftoverOffer', () => {
  const lastWeek = [
    { date: '2026-09-22', total: 1000 },
    { date: '2026-09-27', total: 500, entries: [{ id: 'a', amount: 500, time: '9:00 AM' }] },
  ];

  it('offers what was left of last week', () => {
    expect(leftoverOffer({ ...base, period: 'weekly', dailyTotals: lastWeek }))
      .toEqual({ periodStart: '2026-09-21', amount: 2000, label: 'last week' });
  });

  it('counts top-ups and bills set aside that week', () => {
    const r = leftoverOffer({
      ...base, period: 'weekly', dailyTotals: lastWeek,
      topUps: [{ id: 't', amount: 300, date: '2026-09-23' }],
      bills: [{ id: 'b', name: 'Gym', amount: 800, repeat: 'weekly', day: 1, inBudget: true, remind: false, startDate: '2026-09-01' }],
    });
    expect(r?.amount).toBe(2000 + 300 - 800);
  });

  it('does not offer twice, for daily budgets, or for a period with nothing logged', () => {
    expect(leftoverOffer({ ...base, period: 'weekly', dailyTotals: lastWeek, lastOffered: '2026-09-21' })).toBeNull();
    expect(leftoverOffer({ ...base, period: 'daily', dailyTotals: lastWeek })).toBeNull();
    expect(leftoverOffer({ ...base, period: 'weekly', dailyTotals: [] })).toBeNull();
  });

  it('does not offer an overspent period', () => {
    expect(leftoverOffer({ ...base, period: 'weekly', dailyTotals: [{ date: '2026-09-22', total: 4000 }] })).toBeNull();
  });

  it('uses last month for monthly budgets', () => {
    const r = leftoverOffer({ ...base, amount: 15000, period: 'monthly', dailyTotals: [{ date: '2026-09-10', total: 12000 }] });
    expect(r).toEqual({ periodStart: '2026-09-01', amount: 3000, label: 'last month' });
  });
});

describe('jarTotal', () => {
  it('adds deposits and takes out withdrawals', () => {
    expect(jarTotal({ goal: null, entries: [
      { id: '1', amount: 1000.1, date: '2026-09-01', kind: 'deposit' },
      { id: '2', amount: 340.2, date: '2026-09-28', kind: 'leftover' },
      { id: '3', amount: -200, date: '2026-09-30', kind: 'withdraw' },
    ] })).toBe(1140.3);
  });
});
