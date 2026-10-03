// src/achievements.ts
//
// Achievements: milestones in habits, money and Bonbon. Most are worked out from the app's
// data, so history from before they existed counts too; two are events (chatting with
// Bonbon, opening a weekly recap). Once earned, an achievement is kept, even if the data
// that earned it changes later (a habit deleted, a bill removed).

import type { Commission, CompletionRecord, DailyTotal, SpendingEntry, Stats } from './types';
import { addDaysToKey, isRestRecord, isScheduledForDay, parseDateKey } from './helpers';
import { computeBudget, periodEnd, periodStart, type BudgetPeriod, type TopUp } from './budget';
import { allJarEntries, fullestJar, type Savings } from './savings';
import type { Bill } from './bills';
import { withToday } from './monthSummary';
import { liveRecord } from './weekSummary';

export type AchievementGroup = 'habits' | 'money' | 'bonbon';

export type AchievementData = {
  todayKey: string;
  stats: Stats;
  history: CompletionRecord[];
  commissions: Commission[];
  dailyTotals: DailyTotal[];
  todayHistory: SpendingEntry[];
  spentToday: number;
  topUps: TopUp[];
  bills: Bill[];
  savings: Savings;
  budgetPeriod: BudgetPeriod;
  budgetAmount: number;
};

export type Progress = { value: number; target: number };

export type Achievement = {
  id: string;
  emoji: string;
  title: string;
  group: AchievementGroup;
  description: string | ((d: AchievementData) => string);
  /** How far along; earned once value reaches target. Events (no progress) are earned by the app. */
  progress?: (d: AchievementData) => Progress;
  /** Progress as text, when "3/7" isn't right. */
  progressLabel?: (p: Progress) => string;
};

/**
 * Achievement id → the day it was earned, or EARNED_BEFORE for ones earned by history from
 * before achievements existed (the day isn't known).
 */
export type Earned = Record<string, string>;
export const EARNED_BEFORE = 'before';

/** For sorting newest first: earlier than any day. */
export const earnedSortKey = (when: string) => (when === EARNED_BEFORE ? '' : when);

// ── Helpers ──────────────────────────────────────────────────────────────────

const count = (value: number, target: number): Progress => ({ value: Math.min(value, target), target });
const yes   = (done: boolean): Progress => ({ value: done ? 1 : 0, target: 1 });

/** Every day's records, today as it stands now. */
const records = (d: AchievementData) =>
  [...d.history.filter(r => r.date !== d.todayKey), liveRecord(d.commissions, d.todayKey)].sort((a, b) => a.date.localeCompare(b.date));

/** Spending the user logged (bills logged automatically aside), today included. */
const loggedEntries = (d: AchievementData) =>
  withToday(d.dailyTotals, d.todayKey, d.spentToday, d.todayHistory)
    .flatMap(day => (day.entries ?? []).filter(e => !e.billId).map(e => ({ ...e, date: day.date })));

/** The longest run of consecutive days in a sorted list of day keys. */
const longestRun = (days: string[]) => {
  let best = 0, run = 0, prev = '';
  for (const day of days) {
    run = prev && addDaysToKey(prev, 1) === day ? run + 1 : 1;
    best = Math.max(best, run); prev = day;
  }
  return best;
};

/** A finished Monday-to-Sunday week where every day with Habbits on was perfect (3 or more of them). */
const hadPerfectWeek = (d: AchievementData) => {
  const byDate = new Map(d.history.map(r => [r.date, r]));
  const weeks  = new Set(d.history.map(r => periodStart('weekly', r.date)));
  for (const monday of weeks) {
    if (addDaysToKey(monday, 6) >= d.todayKey) continue;
    let perfect = 0, ok = true;
    for (let i = 0; i < 7 && ok; i++) {
      const day = addDaysToKey(monday, i);
      const r   = byDate.get(day);
      if (r) { if (isRestRecord(r)) continue; if (r.completed) perfect++; else ok = false; continue; }
      // No record: the app wasn't opened, so it only counts if nothing was on that day.
      if (d.commissions.some(c => isScheduledForDay(c, parseDateKey(day).getDay()))) ok = false;
    }
    if (ok && perfect >= 3) return true;
  }
  return false;
};

/** A perfect day straight after a day with Habbits missed. */
const hadComeback = (d: AchievementData) => {
  const list = d.history.filter(r => !isRestRecord(r));
  return list.some((r, i) => i > 0 && r.completed && !list[i - 1].completed && list[i - 1].date === addDaysToKey(r.date, -1));
};

/** An "N× a week" habit done N times in one week. */
const metWeeklyGoal = (d: AchievementData) => {
  const all = records(d);
  return d.commissions.some(c => {
    if (!c.perWeek) return false;
    const byWeek = new Map<string, number>();
    for (const r of all) if (r.completedIds.includes(c.id)) {
      const week = periodStart('weekly', r.date);
      byWeek.set(week, (byWeek.get(week) ?? 0) + 1);
    }
    return [...byWeek.values()].some(n => n >= c.perWeek!);
  });
};

/**
 * A finished budget period under budget, measured with the budget as it's set now: a week
 * (weekly budgets), a month (monthly), or for daily budgets a week where every day with
 * spending (3 or more) stayed under that day's allowance.
 */
const endedUnderBudget = (d: AchievementData) => {
  const allDays = withToday(d.dailyTotals, d.todayKey, d.spentToday, d.todayHistory);
  const spent   = allDays.filter(x => x.total > 0);
  if (spent.length === 0) return false;
  const budgetAt = (dayKey: string) => {
    const day = allDays.find(x => x.date === dayKey);
    return computeBudget({
      period: d.budgetPeriod, amount: d.budgetAmount, todayKey: dayKey, spentToday: day?.total ?? 0, todayHistory: day?.entries ?? [],
      dailyTotals: allDays.filter(x => x.date !== dayKey), topUps: d.topUps, bills: d.bills,
    });
  };
  const unit    = d.budgetPeriod === 'monthly' ? 'monthly' : 'weekly';
  const periods = [...new Set(spent.map(x => periodStart(unit, x.date)))];
  return periods.some(start => {
    const end = periodEnd(unit, start);
    if (end >= d.todayKey) return false;
    if (d.budgetPeriod !== 'daily') return budgetAt(end).periodLeft >= 0;
    const days = spent.filter(x => x.date >= start && x.date <= end);
    return days.length >= 3 && days.every(x => budgetAt(x.date).leftToday >= 0);
  });
};

// ── The list ─────────────────────────────────────────────────────────────────

export const ACHIEVEMENTS: Achievement[] = [
  // Habits
  { id: 'first-hop',    group: 'habits', emoji: '🐣', title: 'First Hop',        description: 'Check off your first Habbit',                progress: d => count(d.stats.totalCompleted, 1) },
  { id: 'perfect-day',  group: 'habits', emoji: '✨', title: 'Perfect Day',      description: 'Finish every Habbit in a day',               progress: d => yes(records(d).some(r => r.completed)) },
  { id: 'streak-3',     group: 'habits', emoji: '🔥', title: 'On a Roll',        description: 'Reach a 3-day streak',                       progress: d => count(d.stats.bestStreak, 3) },
  { id: 'streak-7',     group: 'habits', emoji: '⚡', title: 'Week Warrior',     description: 'Reach a 7-day streak',                       progress: d => count(d.stats.bestStreak, 7) },
  { id: 'streak-30',    group: 'habits', emoji: '🏆', title: 'Unstoppable',      description: 'Reach a 30-day streak',                      progress: d => count(d.stats.bestStreak, 30) },
  { id: 'streak-100',   group: 'habits', emoji: '👑', title: 'Legend',           description: 'Reach a 100-day streak',                     progress: d => count(d.stats.bestStreak, 100) },
  { id: 'perfect-week', group: 'habits', emoji: '🌟', title: 'Perfect Week',     description: 'Every Habbit, every day, Monday to Sunday',  progress: d => yes(hadPerfectWeek(d)) },
  { id: 'comeback',     group: 'habits', emoji: '🌱', title: 'Comeback',         description: 'Have a perfect day right after missing one', progress: d => yes(hadComeback(d)) },
  { id: 'weekly-goal',  group: 'habits', emoji: '🎯', title: 'Goal Getter',      description: 'Hit an “N× a week” goal',                    progress: d => yes(metWeeklyGoal(d)) },
  { id: 'done-100',     group: 'habits', emoji: '🥕', title: 'Carrot Collector', description: 'Check off 100 Habbits',                      progress: d => count(d.stats.totalCompleted, 100) },
  { id: 'done-500',     group: 'habits', emoji: '🧺', title: 'Big Harvest',      description: 'Check off 500 Habbits',                      progress: d => count(d.stats.totalCompleted, 500) },
  // Money
  { id: 'first-spend',  group: 'money',  emoji: '🪙', title: 'Penny Tracker',    description: 'Log your first expense',                     progress: d => count(loggedEntries(d).length, 1) },
  { id: 'logged-7',     group: 'money',  emoji: '📒', title: 'Bookkeeper',       description: 'Log spending 7 days in a row',               progress: d => count(longestRun([...new Set(loggedEntries(d).map(e => e.date))].sort()), 7) },
  { id: 'sorted-25',    group: 'money',  emoji: '🗂️', title: 'Neat Nibbler',     description: 'Give 25 expenses a category',                progress: d => count(loggedEntries(d).filter(e => e.category).length, 25) },
  { id: 'under-budget', group: 'money',  emoji: '💚', title: 'Budget Boss',
    description: d => (d.budgetPeriod === 'monthly' ? 'End a month under budget' : d.budgetPeriod === 'weekly' ? 'End a week under budget' : 'Stay under your daily budget for a whole week'),
    progress: d => yes(endedUnderBudget(d)) },
  { id: 'bills',        group: 'money',  emoji: '🧾', title: 'Bill Wrangler',    description: 'Set up a recurring bill',                    progress: d => count(d.bills.length, 1) },
  { id: 'saver',        group: 'money',  emoji: '🫙', title: 'Saver',            description: 'Put money in a savings jar',              progress: d => yes(allJarEntries(d.savings).some(e => e.amount > 0)) },
  { id: 'jar-half',     group: 'money',  emoji: '🐷', title: 'Halfway There',    description: 'Fill a savings jar halfway',
    progressLabel: p => `${p.value}% full`,
    progress: d => count(Math.floor(fullestJar(d.savings) * 100), 50) },
  { id: 'jar-full',     group: 'money',  emoji: '🎉', title: 'Goal!',            description: 'Reach a savings goal',
    progressLabel: p => `${p.value}% full`,
    progress: d => count(Math.floor(fullestJar(d.savings) * 100), 100) },
  // Bonbon (events)
  { id: 'hello-bonbon', group: 'bonbon', emoji: '🐰', title: 'Hi, Bonbon!',      description: 'Chat with Bonbon' },
  { id: 'look-back',    group: 'bonbon', emoji: '🪞', title: 'Look Back',        description: 'Open a weekly recap' },
];

export const achievementById = (id: string) => ACHIEVEMENTS.find(a => a.id === id);

export const describe = (a: Achievement, d: AchievementData) => (typeof a.description === 'string' ? a.description : a.description(d));

/** "3/7", "32% full"; null for yes-or-no achievements. */
export const progressText = (a: Achievement, p: Progress) =>
  a.progressLabel ? a.progressLabel(p) : p.target > 1 ? `${p.value}/${p.target}` : null;

/** Data-based achievements reached now that aren't earned yet. */
export const newlyEarned = (d: AchievementData, earned: Earned): string[] =>
  ACHIEVEMENTS.filter(a => a.progress && !earned[a.id]).filter(a => {
    const p = a.progress!(d);
    return p.value >= p.target;
  }).map(a => a.id);
