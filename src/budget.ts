// src/budget.ts
//
// Budget math. A budget is an amount per period (day / week / month). For weekly and
// monthly budgets, the daily allowance adapts: what's left in the period is spread
// over the days that remain, so overspending one day shrinks the next day's allowance.
//
// Recurring bills: weekly/monthly budgets set aside every bill due in the period up front,
// and the bills' own spending entries aren't counted again. Daily budgets only track bills.

import type { DailyTotal, SpendingEntry } from './types';
import { addDaysToKey, parseDateKey, toDateKey } from './helpers';
import { billSpending, billsDueTotal, type Bill } from './bills';

export type BudgetPeriod = 'daily' | 'weekly' | 'monthly';

/** Money added to the budget mid-period ("I got paid", "found ₱200"). */
export type TopUp = { id: string; amount: number; date: string; time?: string; note?: string };

export const PERIOD_LABELS: Record<BudgetPeriod, { adjective: string; noun: string }> = {
  daily:   { adjective: 'Daily',   noun: 'day'   },
  weekly:  { adjective: 'Weekly',  noun: 'week'  },
  monthly: { adjective: 'Monthly', noun: 'month' },
};

/** First day of the period containing `dayKey`. Weeks start on Monday. */
export const periodStart = (period: BudgetPeriod, dayKey: string): string => {
  if (period === 'daily') return dayKey;
  const d = parseDateKey(dayKey);
  if (period === 'weekly') {
    const sinceMonday = (d.getDay() + 6) % 7;
    return addDaysToKey(dayKey, -sinceMonday);
  }
  return toDateKey(new Date(d.getFullYear(), d.getMonth(), 1));
};

/** Last day (inclusive) of the period containing `dayKey`. */
export const periodEnd = (period: BudgetPeriod, dayKey: string): string => {
  if (period === 'daily') return dayKey;
  if (period === 'weekly') return addDaysToKey(periodStart('weekly', dayKey), 6);
  const d = parseDateKey(dayKey);
  return toDateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
};

const daysBetweenInclusive = (from: string, to: string) =>
  Math.round((parseDateKey(to).getTime() - parseDateKey(from).getTime()) / 86_400_000) + 1;

export type BudgetState = {
  period: BudgetPeriod;
  /** Base amount for the period, plus any top-ups made during it. */
  periodBudget: number;
  topUpsThisPeriod: number;
  /** Bills due this period, set aside up front (weekly/monthly budgets only). */
  billsSetAside: number;
  /** Day-to-day spending this period plus the bills set aside. */
  periodSpent: number;
  periodLeft: number;
  /** Days remaining in the period, including today. */
  daysLeft: number;
  /** What the user can spend today. For daily budgets this is the daily amount (+ today's top-ups). */
  dailyAllowance: number;
  /** Today's spending that counts against the allowance (bills excluded). */
  spentToday: number;
  leftToday: number;
};

export const computeBudget = ({ period, amount, todayKey, spentToday, todayHistory = [], dailyTotals, topUps, bills = [] }: {
  period: BudgetPeriod;
  amount: number;
  todayKey: string;
  /** Everything spent today, bills included. */
  spentToday: number;
  todayHistory?: SpendingEntry[];
  dailyTotals: DailyTotal[];
  topUps: TopUp[];
  bills?: Bill[];
}): BudgetState => {
  const start = periodStart(period, todayKey);
  const end   = periodEnd(period, todayKey);

  const topUpsThisPeriod = topUps
    .filter(t => t.date >= start && t.date <= todayKey)
    .reduce((s, t) => s + t.amount, 0);
  // Bill entries never count here: they're set aside up front (or, on daily budgets, only tracked).
  const spentBeforeToday = dailyTotals
    .filter(d => d.date >= start && d.date < todayKey)
    .reduce((s, d) => s + d.total - billSpending(d.entries), 0);
  const countedToday  = spentToday - billSpending(todayHistory);
  const billsSetAside = period === 'daily' ? 0 : billsDueTotal(bills, start, end);

  const periodBudget = amount + topUpsThisPeriod;
  const periodSpent  = spentBeforeToday + countedToday + billsSetAside;
  const daysLeft     = daysBetweenInclusive(todayKey, end);

  // Today's allowance is fixed at the start of the day (it doesn't shrink as you spend today).
  const dailyAllowance = period === 'daily'
    ? periodBudget
    : Math.max(0, (periodBudget - billsSetAside - spentBeforeToday) / daysLeft);

  return {
    period,
    periodBudget,
    topUpsThisPeriod,
    billsSetAside,
    periodSpent,
    periodLeft: periodBudget - periodSpent,
    daysLeft,
    dailyAllowance,
    spentToday: countedToday,
    leftToday: dailyAllowance - countedToday,
  };
};
