import { fullestJar, jarTotal, leftoverOffer, parseSavings, storedSavings, type SavingsJar } from '../src/savings';

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
    expect(jarTotal({ entries: [
      { id: '1', amount: 1000.1, date: '2026-09-01', kind: 'deposit' },
      { id: '2', amount: 340.2, date: '2026-09-28', kind: 'leftover' },
      { id: '3', amount: -200, date: '2026-09-30', kind: 'withdraw' },
    ] })).toBe(1140.3);
  });
});

describe('several jars', () => {
  const goal = (name: string, target: number) => ({ name, emoji: '🎯', target, createdAt: '2026-09-01' });
  const phone: SavingsJar = { id: 'jar-1', goal: goal('Phone', 1000), entries: [{ id: 'a', amount: 600, date: '2026-09-02', kind: 'deposit' }] };
  const trip: SavingsJar  = { id: 'jar-2', goal: goal('Trip', 5000), entries: [{ id: 'b', amount: 500, date: '2026-09-03', kind: 'deposit' }] };

  it('turns the old single jar into the first jar', () => {
    expect(parseSavings({ goal: phone.goal, entries: phone.entries, lastOffered: '2026-09-21' }))
      .toEqual({ jars: [phone], lastOffered: '2026-09-21' });
    expect(parseSavings({ goal: null, entries: [] })).toEqual({ jars: [] });
    expect(parseSavings(null)).toEqual({ jars: [] });
  });

  it('reads jars when they are there, skipping broken ones', () => {
    expect(parseSavings({ jars: [phone, { id: 'x' }, trip], goal: phone.goal, entries: phone.entries })).toEqual({ jars: [phone, trip] });
  });

  it('stores the first jar the old way too, so older versions can restore it', () => {
    const stored = storedSavings({ jars: [phone, trip] });
    expect(stored).toMatchObject({ jars: [phone, trip], goal: phone.goal, entries: phone.entries });
    expect(parseSavings(JSON.parse(JSON.stringify(stored)))).toEqual({ jars: [phone, trip] });
  });

  it('finds the fullest jar', () => {
    expect(fullestJar({ jars: [phone, trip] })).toBe(0.6);
    expect(fullestJar({ jars: [] })).toBe(0);
  });
});
