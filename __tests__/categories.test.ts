import { spendingByCategory } from '../src/categories';
import type { DailyTotal, SpendingEntry } from '../src/types';

const TODAY = '2026-10-01';
const entry = (amount: number, category?: string): SpendingEntry => ({ id: String(amount), amount, time: '9:00 AM', ...(category ? { category } : {}) });

describe('spendingByCategory', () => {
  const history: DailyTotal[] = [
    { date: '2026-09-27', total: 999, entries: [entry(999, 'fun')] },          // before the range
    { date: '2026-09-28', total: 300 },                                        // old day: total only
    { date: '2026-09-29', total: 250, entries: [entry(200, 'food'), entry(50, 'transport')] },
    { date: '2026-09-30', total: 100, entries: [entry(100, 'food')] },
  ];

  it('totals each category from the start of the range through today, biggest first', () => {
    const result = spendingByCategory(history, [entry(150, 'food'), entry(20)], '2026-09-28', TODAY);
    expect(result.map(r => [r.key, r.total])).toEqual([
      ['food', 450], ['none', 320], ['transport', 50],
    ]);
    expect(result.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1);
    expect(result[0].share).toBeCloseTo(450 / 820);
  });

  it('treats unknown category keys as uncategorized', () => {
    expect(spendingByCategory([], [entry(10, 'mystery')], TODAY, TODAY)).toEqual([{ key: 'none', total: 10, share: 1 }]);
  });

  it('is empty when nothing was spent', () => {
    expect(spendingByCategory([], [], TODAY, TODAY)).toEqual([]);
  });
});
