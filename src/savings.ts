// src/savings.ts
//
// Savings jars: each one a goal and a ledger of money put in or taken out. Free users get
// one jar, Pro up to MAX_JARS. Jars track money the user has actually set aside, so they
// never touch the budget, and leftovers are offered rather than moved automatically.

import type { DailyTotal } from './types';
import { addDaysToKey } from './helpers';
import { computeBudget, periodStart, type BudgetPeriod, type TopUp } from './budget';
import type { Bill } from './bills';

export type SavingsGoal = { name: string; emoji: string; target: number; createdAt: string };

export type JarEntry = {
  id: string;
  /** Positive puts money in, negative takes it out. */
  amount: number;
  date: string;
  kind: 'leftover' | 'deposit' | 'withdraw';
  note?: string;
};

export type SavingsJar = { id: string; goal: SavingsGoal; entries: JarEntry[] };

export type Savings = {
  jars: SavingsJar[];
  /** Start of the last budget period whose leftover was offered (taken or skipped). */
  lastOffered?: string;
};

export const EMPTY_SAVINGS: Savings = { jars: [] };

/** Jars at once with Pro. Free users get one; jars made with Pro stay if it ends. */
export const MAX_JARS = 6;

export const jarTotal = (jar: { entries: JarEntry[] }): number =>
  Math.round(jar.entries.reduce((sum, e) => sum + e.amount, 0) * 100) / 100;

/** Every jar's entries together, for totals over a period. */
export const allJarEntries = (s: Savings): JarEntry[] => s.jars.flatMap(j => j.entries);

/** The fullest jar's share of its goal (0 with no jars), for the jar achievements. */
export const fullestJar = (s: Savings): number =>
  Math.max(0, ...s.jars.map(j => (j.goal.target > 0 ? jarTotal(j) / j.goal.target : 0)));

/**
 * Savings as stored or restored. Before there could be several jars it was one goal and its
 * entries, { goal, entries }; that becomes the first jar.
 */
export const parseSavings = (raw: unknown): Savings => {
  if (typeof raw !== 'object' || raw === null) return EMPTY_SAVINGS;
  const r = raw as { jars?: unknown; goal?: SavingsGoal | null; entries?: JarEntry[]; lastOffered?: unknown };
  const lastOffered = typeof r.lastOffered === 'string' ? { lastOffered: r.lastOffered } : {};
  if (Array.isArray(r.jars)) {
    const jars = r.jars.filter((j): j is SavingsJar =>
      typeof j === 'object' && j !== null && typeof j.id === 'string'
      && typeof j.goal?.name === 'string' && typeof j.goal?.target === 'number' && Array.isArray(j.entries));
    return { jars, ...lastOffered };
  }
  const jars = r.goal && typeof r.goal.name === 'string'
    ? [{ id: 'jar-1', goal: r.goal, entries: Array.isArray(r.entries) ? r.entries : [] }]
    : [];
  return { jars, ...lastOffered };
};

/**
 * Savings to store. The first jar is also written the old way ({ goal, entries }), so a
 * backup made now still restores on an older version of the app (as that one jar).
 */
export const storedSavings = (s: Savings) => ({
  ...s, goal: s.jars[0]?.goal ?? null, entries: s.jars[0]?.entries ?? [],
});

export type LeftoverOffer = { periodStart: string; amount: number; label: 'last week' | 'last month' };

/**
 * What was left of the previous weekly/monthly budget, if it's worth offering: not offered
 * before, more than a token amount, and spending was logged that period (so a period before
 * the user started tracking isn't counted as "all saved"). Daily budgets get no offers: a
 * day without entries can't be told apart from a day the app wasn't used.
 */
export const leftoverOffer = ({ period, amount, todayKey, dailyTotals, topUps, bills, lastOffered }: {
  period: BudgetPeriod; amount: number; todayKey: string;
  dailyTotals: DailyTotal[]; topUps: TopUp[]; bills: Bill[]; lastOffered?: string;
}): LeftoverOffer | null => {
  if (period === 'daily') return null;
  const prevEnd   = addDaysToKey(periodStart(period, todayKey), -1);
  const prevStart = periodStart(period, prevEnd);
  if (lastOffered && lastOffered >= prevStart) return null;

  const days = dailyTotals.filter(d => d.date >= prevStart && d.date <= prevEnd);
  if (!days.some(d => d.total > 0)) return null;

  const last = days.find(d => d.date === prevEnd);
  const left = computeBudget({
    period, amount, todayKey: prevEnd, spentToday: last?.total ?? 0, todayHistory: last?.entries ?? [],
    dailyTotals, topUps, bills,
  }).periodLeft;
  if (left < 1) return null;
  return { periodStart: prevStart, amount: Math.round(left * 100) / 100, label: period === 'weekly' ? 'last week' : 'last month' };
};
