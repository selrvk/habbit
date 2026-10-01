// src/categories.ts
//
// Spending categories, and totals by category over a range of days.

import type { DailyTotal, SpendingEntry } from './types';

export type CategoryKey = 'food' | 'transport' | 'shopping' | 'fun' | 'bills' | 'health' | 'other';

export type Category = { key: CategoryKey; label: string; emoji: string; color: string };

export const CATEGORIES: Category[] = [
  { key: 'food',      label: 'Food',      emoji: '🍔', color: '#E8A87C' },
  { key: 'transport', label: 'Transport', emoji: '🚌', color: '#8FB8DE' },
  { key: 'shopping',  label: 'Shopping',  emoji: '🛍️', color: '#D4A5D4' },
  { key: 'fun',       label: 'Fun',       emoji: '🎉', color: '#F5C26B' },
  { key: 'bills',     label: 'Bills',     emoji: '🧾', color: '#C9A27E' },
  { key: 'health',    label: 'Health',    emoji: '💊', color: '#9DE087' },
  { key: 'other',     label: 'Other',     emoji: '📦', color: '#B8A99A' },
];

/** Entries logged before categories existed, or without picking one. */
export const UNCATEGORIZED: Omit<Category, 'key'> & { key: 'none' } =
  { key: 'none', label: 'No category', emoji: '•', color: 'rgba(232,213,192,0.3)' };

export const categoryOf = (key?: string): Category | undefined => CATEGORIES.find(c => c.key === key);

export type CategoryTotal = { key: CategoryKey | 'none'; total: number; share: number };

/**
 * Spending by category from `fromKey` to today (inclusive), biggest first. Days in the
 * history that only kept a total (very old data) count as uncategorized.
 */
export const spendingByCategory = (
  dailyTotals: DailyTotal[], todayHistory: SpendingEntry[], fromKey: string, todayKey: string,
): CategoryTotal[] => {
  const totals = new Map<CategoryKey | 'none', number>();
  const add = (key: CategoryKey | 'none', amount: number) => totals.set(key, (totals.get(key) ?? 0) + amount);
  const addEntries = (entries: SpendingEntry[]) => entries.forEach(e => add(categoryOf(e.category)?.key ?? 'none', e.amount));

  for (const day of dailyTotals) {
    if (day.date < fromKey || day.date >= todayKey) continue;
    if (day.entries && day.entries.length > 0) addEntries(day.entries);
    else if (day.total > 0) add('none', day.total);
  }
  addEntries(todayHistory);

  const sum = [...totals.values()].reduce((s, n) => s + n, 0);
  return [...totals.entries()]
    .filter(([, total]) => total > 0)
    .map(([key, total]) => ({ key, total, share: sum > 0 ? total / sum : 0 }))
    .sort((a, b) => b.total - a.total);
};
