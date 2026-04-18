// src/utils/buildCoachContext.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  STORAGE_COMMISSIONS,
  STORAGE_FINANCE,
  STORAGE_FINANCE_HISTORY,
  STORAGE_COMPLETION_HISTORY,
  STORAGE_STATS,
  STORAGE_SETTINGS,
} from '../storage';
import type {
  CommissionsData,
  FinanceData,
  DailyTotal,
  CompletionRecord,
  Stats,
  Settings,
} from '../types';

export interface CoachContext {
  userName: string;
  streak: number;
  bestStreak: number;
  currency: string;
  dailyBudget: number;
  habits: {
    total: number;
    completedToday: number;
    daysFullyCompletedLast7: number;     // out of 7
    missedDaysLast7: number;
    habitsMostMissed: string[];          // labels of least-completed today
  };
  finance: {
    spentToday: number;
    totalSpentLast7Days: number;
    dailyAverageSpend: number;
    busiestSpendingDay: string | null;   // date string of highest spend day
    budgetUsedTodayPct: number;          // 0–100
  };
}

function getLast7DateStrings(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]); // 'YYYY-MM-DD'
  }
  return days;
}

export async function buildCoachContext(
  name: string,
  streak: number,
): Promise<CoachContext> {
  const last7 = getLast7DateStrings();

  // ── Fetch all keys in parallel ─────────────────────────────────────────────
  const [
    commissionsRaw,
    financeRaw,
    financeHistoryRaw,
    completionHistoryRaw,
    statsRaw,
    settingsRaw,
  ] = await Promise.all([
    AsyncStorage.getItem(STORAGE_COMMISSIONS),
    AsyncStorage.getItem(STORAGE_FINANCE),
    AsyncStorage.getItem(STORAGE_FINANCE_HISTORY),
    AsyncStorage.getItem(STORAGE_COMPLETION_HISTORY),
    AsyncStorage.getItem(STORAGE_STATS),
    AsyncStorage.getItem(STORAGE_SETTINGS),
  ]);

  // ── Parse ──────────────────────────────────────────────────────────────────
  const commissionsData: CommissionsData | null = commissionsRaw
    ? JSON.parse(commissionsRaw)
    : null;

  const financeData: FinanceData | null = financeRaw
    ? JSON.parse(financeRaw)
    : null;

  const financeHistory: DailyTotal[] = financeHistoryRaw
    ? (JSON.parse(financeHistoryRaw).dailyTotals ?? [])
    : [];
  
  const completionHistory: CompletionRecord[] = completionHistoryRaw
    ? JSON.parse(completionHistoryRaw)
    : [];

  const stats: Stats | null = statsRaw ? JSON.parse(statsRaw) : null;
  const settings: Settings | null = settingsRaw ? JSON.parse(settingsRaw) : null;

  // ── Habit calculations ─────────────────────────────────────────────────────
  const habits = commissionsData?.items ?? [];
  const totalHabits = habits.length;

  // How many are marked done today
  const completedToday = habits.filter(h => h.completed).length;

  // Habits the user hasn't finished today (for coaching nudges)
  const habitsMostMissed = habits
    .filter(h => !h.completed)
    .map(h => h.label)
    .slice(0, 3); // cap at 3 so the prompt stays short

  // Use CompletionRecord[] for last-7-days overview
  const last7Set = new Set(last7);
  const recentRecords = completionHistory.filter(r => last7Set.has(r.date));
  const daysFullyCompletedLast7 = recentRecords.filter(r => r.completed).length;
  const missedDaysLast7 = 7 - daysFullyCompletedLast7;

  // ── Finance calculations ───────────────────────────────────────────────────
  const spentToday = financeData?.spentToday ?? 0;
  const dailyBudget = settings?.allocatedPerDay ?? 0;
  const currency = settings?.currency ?? 'USD';

  // Filter finance history to last 7 days
  const recentHistory = financeHistory.filter(d => last7Set.has(d.date));

  // Include today's spend if it isn't in history yet
  const todayStr = new Date().toISOString().split('T')[0];
  const todayInHistory = recentHistory.find(d => d.date === todayStr);
  const allLast7Spending: DailyTotal[] = todayInHistory
    ? recentHistory
    : [...recentHistory, { date: todayStr, total: spentToday }];

  const totalSpentLast7Days = allLast7Spending.reduce(
    (sum, d) => sum + d.total,
    0,
  );

  const dailyAverageSpend =
    allLast7Spending.length > 0
      ? totalSpentLast7Days / allLast7Spending.length
      : 0;

  const busiestDay = allLast7Spending.sort((a, b) => b.total - a.total)[0];

  const budgetUsedTodayPct =
    dailyBudget > 0 ? Math.round((spentToday / dailyBudget) * 100) : 0;

  // ── Assemble ───────────────────────────────────────────────────────────────
  return {
    userName: name || settings?.name || 'there',
    streak,
    bestStreak: stats?.bestStreak ?? streak,
    currency,
    dailyBudget,
    habits: {
      total: totalHabits,
      completedToday,
      daysFullyCompletedLast7,
      missedDaysLast7,
      habitsMostMissed,
    },
    finance: {
      spentToday: Math.round(spentToday * 100) / 100,
      totalSpentLast7Days: Math.round(totalSpentLast7Days * 100) / 100,
      dailyAverageSpend: Math.round(dailyAverageSpend * 100) / 100,
      busiestSpendingDay: busiestDay?.date ?? null,
      budgetUsedTodayPct,
    },
  };
}