// src/savings.ts
//
// The savings jar: one goal, and a ledger of money put in or taken out. The jar tracks
// money the user has actually set aside, so it never touches the budget, and leftovers
// are offered rather than moved automatically.

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

export type Savings = {
  goal: SavingsGoal | null;
  entries: JarEntry[];
  /** Start of the last budget period whose leftover was offered (taken or skipped). */
  lastOffered?: string;
};

export const EMPTY_SAVINGS: Savings = { goal: null, entries: [] };

export const jarTotal = (s: Savings): number =>
  Math.round(s.entries.reduce((sum, e) => sum + e.amount, 0) * 100) / 100;

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
