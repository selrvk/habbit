// src/categories.ts
//
// Spending categories: the built-in ones, and ones the user makes (Pro). Also totals by
// category over a range of days.

import type { DailyTotal, SpendingEntry } from './types';
import type { IconName } from './icons';

/** The built-in categories. Siri and Shortcuts offer these (ios/HabbitIntents.swift). */
export type CategoryKey = 'food' | 'transport' | 'shopping' | 'fun' | 'bills' | 'health' | 'other';

/** A built-in key, or a custom one ("c-…"). Built-in ones also have a clay icon (src/icons.ts). */
export type Category = { key: string; label: string; emoji: string; color: string; icon?: IconName };

export const CATEGORIES: (Category & { key: CategoryKey })[] = [
  { key: 'food',      label: 'Food',      emoji: '🍔', icon: 'burger',        color: '#E8A87C' },
  { key: 'transport', label: 'Transport', emoji: '🚌', icon: 'bus',           color: '#8FB8DE' },
  { key: 'shopping',  label: 'Shopping',  emoji: '🛍️', icon: 'shopping-bags', color: '#D4A5D4' },
  { key: 'fun',       label: 'Fun',       emoji: '🎉', icon: 'party-popper',  color: '#F5C26B' },
  { key: 'bills',     label: 'Bills',     emoji: '🧾', icon: 'receipt',       color: '#C9A27E' },
  { key: 'health',    label: 'Health',    emoji: '💊', icon: 'pill',          color: '#9DE087' },
  { key: 'other',     label: 'Other',     emoji: '📦', icon: 'box',           color: '#B8A99A' },
];

/** Entries logged before categories existed, or without picking one. */
export const UNCATEGORIZED: Omit<Category, 'key'> & { key: 'none' } =
  { key: 'none', label: 'No category', emoji: '•', color: 'rgba(232,213,192,0.3)' };

// ── Custom categories ─────────────────────────────────────────────────────────

/**
 * One the user made. Removing it archives it: it's no longer offered, but expenses already
 * in it keep its name and emoji.
 */
export type CustomCategory = Category & { archived?: boolean };

/** Custom categories at once (archived ones aside), so the picker stays four rows. */
export const MAX_CUSTOM_CATEGORIES = 8;

export const CATEGORY_EMOJIS = [
  '☕', '🍺', '🍿', '🛒', '🍰', '🐶', '🐱', '👶',
  '🎁', '🎮', '🎬', '🎵', '📚', '🎓', '✈️', '🏖️',
  '🏠', '🚗', '⛽', '📱', '💻', '👕', '💄', '💇',
  '🏋️', '⚽', '🌱', '💝', '⛪', '💼', '🔧', '💸',
];

export const CATEGORY_COLORS = ['#E8A87C', '#F5C26B', '#9DE087', '#7FD1C1', '#8FB8DE', '#A99BE0', '#D4A5D4', '#F09090'];

let custom: CustomCategory[] = [];

/** Set by the app when its custom categories load or change, so categoryOf knows them. */
export const setCustomCategories = (list: CustomCategory[]) => { custom = list; };

/** What can be picked for an expense: the built-in ones, then the user's own. */
export const pickableCategories = (list: CustomCategory[] = custom): Category[] =>
  [...CATEGORIES, ...list.filter(c => !c.archived)];

export const categoryOf = (key?: string): Category | undefined =>
  key === undefined ? undefined : CATEGORIES.find(c => c.key === key) ?? custom.find(c => c.key === key);

export const newCategoryKey = (): string => `c-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Custom categories as stored or restored, keeping only well-formed ones. */
export const parseCustomCategories = (raw: unknown): CustomCategory[] => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.filter((c): c is CustomCategory => {
    const ok = typeof c === 'object' && c !== null
      && typeof c.key === 'string' && c.key.startsWith('c-') && !seen.has(c.key)
      && typeof c.label === 'string' && c.label.trim() !== ''
      && typeof c.emoji === 'string' && typeof c.color === 'string';
    if (ok) seen.add(c.key);
    return ok;
  }).map(c => ({ key: c.key, label: c.label, emoji: c.emoji, color: c.color, ...(c.archived ? { archived: true } : {}) }));
};

export type CategoryTotal = { key: string; total: number; share: number };

/**
 * Spending by category from `fromKey` to today (inclusive), biggest first. Days in the
 * history that only kept a total (very old data) count as uncategorized.
 */
export const spendingByCategory = (
  dailyTotals: DailyTotal[], todayHistory: SpendingEntry[], fromKey: string, todayKey: string,
): CategoryTotal[] => {
  const totals = new Map<string, number>();
  const add = (key: string, amount: number) => totals.set(key, (totals.get(key) ?? 0) + amount);
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
