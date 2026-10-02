import {
  categoryOf, parseCustomCategories, pickableCategories, setCustomCategories, spendingByCategory, CATEGORIES, type CustomCategory,
} from '../src/categories';
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

describe('custom categories', () => {
  const coffee: CustomCategory = { key: 'c-coffee', label: 'Coffee', emoji: '☕', color: '#E8A87C' };
  const pets: CustomCategory   = { key: 'c-pets', label: 'Pets', emoji: '🐶', color: '#9DE087', archived: true };

  afterEach(() => setCustomCategories([]));

  it('are found by key once set, archived ones too, so old expenses keep their name', () => {
    expect(categoryOf('c-coffee')).toBeUndefined();
    setCustomCategories([coffee, pets]);
    expect(categoryOf('c-coffee')?.label).toBe('Coffee');
    expect(categoryOf('c-pets')?.label).toBe('Pets');
    expect(categoryOf('food')?.label).toBe('Food');
  });

  it('are offered after the built-in ones, archived ones aside', () => {
    expect(pickableCategories([coffee, pets]).map(c => c.key)).toEqual([...CATEGORIES.map(c => c.key), 'c-coffee']);
  });

  it('count in spending by category', () => {
    setCustomCategories([coffee]);
    expect(spendingByCategory([], [entry(40, 'c-coffee'), entry(10, 'food')], TODAY, TODAY))
      .toEqual([{ key: 'c-coffee', total: 40, share: 0.8 }, { key: 'food', total: 10, share: 0.2 }]);
  });

  it('keep only well-formed ones when loaded or restored', () => {
    expect(parseCustomCategories('nope')).toEqual([]);
    expect(parseCustomCategories([
      coffee,
      { ...coffee, label: 'Again' },                       // same key twice
      { key: 'food', label: 'Food 2', emoji: '🍔', color: '#fff' }, // not a custom key
      { key: 'c-x', label: '  ', emoji: '❓', color: '#fff' },       // no name
      { ...pets, extra: 1 },
    ])).toEqual([coffee, pets]);
  });
});
