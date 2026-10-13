// src/savings.ts
//
// Savings jars: each one a goal and a ledger of money put in or taken out. Free users get
// one jar, Pro up to MAX_JARS. Jars track money the user has actually set aside, so they
// never touch the budget. What's left of a budget when it ends is offered to a jar, quietly
// (in the jar's card); it only goes in by itself if the user asks for that.

import type { DailyTotal } from './types';
import { addDaysToKey, parseDateKey } from './helpers';
import { computeBudget, periodEnd, periodStart, type BudgetPeriod, type TopUp } from './budget';
import { billSpending, type Bill } from './bills';

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

/** What happens to a budget's leftover: offered, put in a jar by itself, or left alone. */
export type LeftoverMode = 'ask' | 'auto' | 'off';

export type Savings = {
  jars: SavingsJar[];
  /** Start of the last budget period whose leftover was offered (taken or skipped). For a daily budget, the day. */
  lastOffered?: string;
  /** Not set: ask. `jarId` is the jar leftovers go into by themselves. */
  leftover?: { mode: LeftoverMode; jarId?: string };
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
  const r = raw as { jars?: unknown; goal?: SavingsGoal | null; entries?: JarEntry[]; lastOffered?: unknown; leftover?: { mode?: unknown; jarId?: unknown } };
  const mode = r.leftover?.mode;
  const leftover: Savings['leftover'] = mode === 'auto' && typeof r.leftover?.jarId === 'string' ? { mode, jarId: r.leftover.jarId }
    : mode === 'off' ? { mode } : undefined;
  const rest = {
    ...(typeof r.lastOffered === 'string' ? { lastOffered: r.lastOffered } : {}),
    ...(leftover ? { leftover } : {}),
  };
  if (Array.isArray(r.jars)) {
    const jars = r.jars.filter((j): j is SavingsJar =>
      typeof j === 'object' && j !== null && typeof j.id === 'string'
      && typeof j.goal?.name === 'string' && typeof j.goal?.target === 'number' && Array.isArray(j.entries));
    return { jars, ...rest };
  }
  const jars = r.goal && typeof r.goal.name === 'string'
    ? [{ id: 'jar-1', goal: r.goal, entries: Array.isArray(r.entries) ? r.entries : [] }]
    : [];
  return { jars, ...rest };
};

/**
 * Savings to store. The first jar is also written the old way ({ goal, entries }), so a
 * backup made now still restores on an older version of the app (as that one jar).
 */
export const storedSavings = (s: Savings) => ({
  ...s, goal: s.jars[0]?.goal ?? null, entries: s.jars[0]?.entries ?? [],
});

/** How leftovers are handled now. By themselves only while the jar they go to is still there. */
export const leftoverMode = (s: Savings): LeftoverMode =>
  s.leftover?.mode === 'off' ? 'off' : s.leftover?.mode === 'auto' && s.jars.some(j => j.id === s.leftover?.jarId) ? 'auto' : 'ask';

/** `label` finishes "left over …": "last week", "yesterday", "on Friday", "from 3 days". */
export type LeftoverOffer = { periodStart: string; amount: number; label: string };

/** A daily budget's leftovers wait this many days to be offered, for a weekend away from the app. */
const DAILY_LOOKBACK = 7;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * A daily budget's leftover: what was left on each day of the last week not yet offered,
 * added up. Only days with spending logged count, since a day with none can't be told from
 * a day the app wasn't used. Each day stands alone, as it does in the budget: a day that
 * went over isn't taken off the others.
 */
const dailyLeftover = ({ amount, todayKey, dailyTotals, topUps, bills, lastOffered }: {
  amount: number; todayKey: string; dailyTotals: DailyTotal[]; topUps: TopUp[]; bills: Bill[]; lastOffered?: string;
}): LeftoverOffer | null => {
  const yesterday = addDaysToKey(todayKey, -1);
  const from      = addDaysToKey(todayKey, -DAILY_LOOKBACK);
  const days = dailyTotals
    .filter(d => d.date >= from && d.date <= yesterday && (!lastOffered || d.date > lastOffered))
    .filter(d => d.total - billSpending(d.entries) > 0)
    .map(d => ({
      date: d.date,
      left: computeBudget({ period: 'daily', amount, todayKey: d.date, spentToday: d.total, todayHistory: d.entries ?? [], dailyTotals, topUps, bills }).periodLeft,
    }))
    .filter(d => d.left > 0);
  const left = Math.round(days.reduce((s, d) => s + d.left, 0) * 100) / 100;
  if (left < 1) return null;
  const label = days.length > 1 ? `from ${days.length} days`
    : days[0].date === yesterday ? 'yesterday' : `on ${WEEKDAYS[parseDateKey(days[0].date).getDay()]}`;
  return { periodStart: yesterday, amount: left, label };
};

/**
 * What was left of the budget that just ended, if it's worth offering: not offered before,
 * more than a token amount, and spending was logged that period (so a period before the
 * user started tracking isn't counted as "all saved"). Weekly and monthly budgets offer the
 * last week or month; a daily one offers its last few days (dailyLeftover).
 */
export const leftoverOffer = ({ period, amount, todayKey, dailyTotals, topUps, bills, lastOffered }: {
  period: BudgetPeriod; amount: number; todayKey: string;
  dailyTotals: DailyTotal[]; topUps: TopUp[]; bills: Bill[]; lastOffered?: string;
}): LeftoverOffer | null => {
  if (period === 'daily') return dailyLeftover({ amount, todayKey, dailyTotals, topUps, bills, lastOffered });
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

/**
 * The day to nudge about this week's or month's leftover: the first day of the next one,
 * while there's a jar to ask about, leftovers are offered, something was spent this period
 * and money is left so far. A daily budget never nudges: that would be a notification a day.
 */
export const leftoverNudgeDay = ({ period, todayKey, periodLeft, spentThisPeriod, savings }: {
  period: BudgetPeriod; todayKey: string; periodLeft: number; spentThisPeriod: boolean; savings: Savings;
}): string | null =>
  period === 'daily' || savings.jars.length === 0 || leftoverMode(savings) !== 'ask' || !spentThisPeriod || periodLeft < 1
    ? null : addDaysToKey(periodEnd(period, todayKey), 1);
