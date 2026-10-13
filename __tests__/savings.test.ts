import { fullestJar, jarTotal, leftoverMode, leftoverNudgeDay, leftoverOffer, parseSavings, storedSavings, type SavingsJar } from '../src/savings';

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

  it('does not offer twice, or for a period with nothing logged', () => {
    expect(leftoverOffer({ ...base, period: 'weekly', dailyTotals: lastWeek, lastOffered: '2026-09-21' })).toBeNull();
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

describe('leftoverOffer for a daily budget', () => {
  // Today is Thu 2026-10-01, with 300 a day.
  const daily = { ...base, amount: 300, period: 'daily' as const };
  const spent = (date: string, total: number) => ({ date, total, entries: [{ id: date, amount: total, time: '9:00 AM' }] });

  it('offers what was left yesterday', () => {
    expect(leftoverOffer({ ...daily, dailyTotals: [spent('2026-09-30', 260)] }))
      .toEqual({ periodStart: '2026-09-30', amount: 40, label: 'yesterday' });
  });

  it('adds up the days not offered yet, each on its own: a day that went over takes nothing off', () => {
    const days = [spent('2026-09-28', 250), spent('2026-09-29', 350), spent('2026-09-30', 260)];
    expect(leftoverOffer({ ...daily, dailyTotals: days })).toEqual({ periodStart: '2026-09-30', amount: 90, label: 'from 2 days' });
    expect(leftoverOffer({ ...daily, dailyTotals: days, lastOffered: '2026-09-29' })).toMatchObject({ amount: 40, label: 'yesterday' });
    expect(leftoverOffer({ ...daily, dailyTotals: days, lastOffered: '2026-09-30' })).toBeNull();
  });

  it('names the day when it was not yesterday, and lets go of days over a week old', () => {
    // Fri Sep 25 was logged, then the app wasn't opened until Thursday.
    expect(leftoverOffer({ ...daily, dailyTotals: [spent('2026-09-25', 260)] }))
      .toEqual({ periodStart: '2026-09-30', amount: 40, label: 'on Friday' });
    expect(leftoverOffer({ ...daily, dailyTotals: [spent('2026-09-23', 260)] })).toBeNull();
  });

  it('skips days with nothing logged but a bill, and counts money added that day', () => {
    const billOnly = { date: '2026-09-30', total: 800, entries: [{ id: 'bill-g-2026-09-30', amount: 800, time: '', billId: 'g' }] };
    expect(leftoverOffer({ ...daily, dailyTotals: [billOnly] })).toBeNull();
    expect(leftoverOffer({ ...daily, dailyTotals: [{ date: '2026-09-30', total: 0 }] })).toBeNull();
    // A bill logged that day isn't spending, and a top-up raises what there was to spend.
    const mixed = { date: '2026-09-30', total: 1060, entries: [...billOnly.entries, { id: 'a', amount: 260, time: '9:00 AM' }] };
    expect(leftoverOffer({ ...daily, dailyTotals: [mixed], topUps: [{ id: 't', amount: 100, date: '2026-09-30' }] })?.amount).toBe(140);
  });
});

describe('how leftovers are handled', () => {
  const jarA: SavingsJar = { id: 'a', goal: { name: 'Trip', emoji: '✈️', target: 5000, createdAt: '2026-09-01' }, entries: [] };

  it('asks unless set otherwise, and only goes into a jar by itself while that jar exists', () => {
    expect(leftoverMode({ jars: [jarA] })).toBe('ask');
    expect(leftoverMode({ jars: [jarA], leftover: { mode: 'off' } })).toBe('off');
    expect(leftoverMode({ jars: [jarA], leftover: { mode: 'auto', jarId: 'a' } })).toBe('auto');
    expect(leftoverMode({ jars: [jarA], leftover: { mode: 'auto', jarId: 'gone' } })).toBe('ask');
  });

  it('is kept when savings are stored and read back', () => {
    const s = { jars: [jarA], lastOffered: '2026-09-21', leftover: { mode: 'auto' as const, jarId: 'a' } };
    expect(parseSavings(JSON.parse(JSON.stringify(storedSavings(s))))).toEqual(s);
    expect(parseSavings({ jars: [jarA], leftover: { mode: 'off' } })).toEqual({ jars: [jarA], leftover: { mode: 'off' } });
    expect(parseSavings({ jars: [jarA], leftover: { mode: 'nonsense' } })).toEqual({ jars: [jarA] });
  });

  it('nudges on the first day of the next week or month, when there is a jar to ask about and money left', () => {
    const on = { todayKey: '2026-10-01', periodLeft: 340, spentThisPeriod: true, savings: { jars: [jarA] } };
    expect(leftoverNudgeDay({ ...on, period: 'weekly' })).toBe('2026-10-05');
    expect(leftoverNudgeDay({ ...on, period: 'monthly' })).toBe('2026-11-01');
    expect(leftoverNudgeDay({ ...on, period: 'daily' })).toBeNull();
    expect(leftoverNudgeDay({ ...on, period: 'weekly', periodLeft: 0.5 })).toBeNull();
    expect(leftoverNudgeDay({ ...on, period: 'weekly', spentThisPeriod: false })).toBeNull();
    expect(leftoverNudgeDay({ ...on, period: 'weekly', savings: { jars: [] } })).toBeNull();
    expect(leftoverNudgeDay({ ...on, period: 'weekly', savings: { jars: [jarA], leftover: { mode: 'off' } } })).toBeNull();
    expect(leftoverNudgeDay({ ...on, period: 'weekly', savings: { jars: [jarA], leftover: { mode: 'auto', jarId: 'a' } } })).toBeNull();
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
