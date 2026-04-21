// src/utils/buildCoachContext.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  STORAGE_COMMISSIONS, STORAGE_FINANCE, STORAGE_FINANCE_HISTORY,
  STORAGE_COMPLETION_HISTORY, STORAGE_STATS, STORAGE_SETTINGS,
} from '../storage';
import type {
  CommissionsData, FinanceData, DailyTotal, CompletionRecord, Stats, Settings,
} from '../types';
import { isScheduledForDay } from '../helpers';

export interface WeeklySnapshotDay {
  date: string;
  dayName: string;
  habitsCompleted: number;
  habitsScheduled: number;
  habitLabelsCompleted: string[];
  spent: number;
}

// A single spending entry surfaced to the coach
export interface SpendingEntryContext {
  date: string;       // YYYY-MM-DD
  amount: number;
  note?: string;
  time?: string;      // HH:MM if available
}

export interface CoachContext {
  userName: string;
  streak: number;
  bestStreak: number;
  currency: string;
  dailyBudget: number;
  habits: {
    total: number;
    completedToday: number;
    daysFullyCompletedLast7: number;
    missedDaysLast7: number;
    habitsMostMissed: string[];
  };
  finance: {
    spentToday: number;
    totalSpentLast7Days: number;
    dailyAverageSpend: number;
    busiestSpendingDay: string | null;
    budgetUsedTodayPct: number;
  };
  weeklySnapshot: WeeklySnapshotDay[];
  // NEW: individual entries with notes for the last 7 days
  recentSpendingEntries: SpendingEntryContext[];
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getLast7DateStrings(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });
}

export async function buildCoachContext(
  name: string,
  streak: number,
): Promise<CoachContext> {
  const last7 = getLast7DateStrings();

  const [
    commissionsRaw, financeRaw, financeHistoryRaw,
    completionHistoryRaw, statsRaw, settingsRaw,
  ] = await Promise.all([
    AsyncStorage.getItem(STORAGE_COMMISSIONS),
    AsyncStorage.getItem(STORAGE_FINANCE),
    AsyncStorage.getItem(STORAGE_FINANCE_HISTORY),
    AsyncStorage.getItem(STORAGE_COMPLETION_HISTORY),
    AsyncStorage.getItem(STORAGE_STATS),
    AsyncStorage.getItem(STORAGE_SETTINGS),
  ]);

  const commissionsData: CommissionsData | null = commissionsRaw ? JSON.parse(commissionsRaw) : null;
  const financeData: FinanceData | null         = financeRaw ? JSON.parse(financeRaw) : null;
  const financeHistory: DailyTotal[]            = financeHistoryRaw ? (JSON.parse(financeHistoryRaw).dailyTotals ?? []) : [];
  const completionHistory: CompletionRecord[]   = completionHistoryRaw ? JSON.parse(completionHistoryRaw) : [];
  const stats: Stats | null                     = statsRaw ? JSON.parse(statsRaw) : null;
  const settings: Settings | null               = settingsRaw ? JSON.parse(settingsRaw) : null;

  const habits      = commissionsData?.items ?? [];
  const totalHabits = habits.length;

  const habitLabelById: Record<string, string> = {};
  habits.forEach(h => { habitLabelById[h.id] = h.label; });

  const todayDow = new Date().getDay();
  const completedToday = habits.filter(h => h.completed).length;
  const habitsMostMissed = habits
    .filter(h => !h.completed && isScheduledForDay(h, todayDow))
    .map(h => h.label)
    .slice(0, 3);

  const last7Set = new Set(last7);
  const recentRecords           = completionHistory.filter(r => last7Set.has(r.date));
  const daysFullyCompletedLast7 = recentRecords.filter(r => r.completed).length;
  const missedDaysLast7         = 7 - daysFullyCompletedLast7;

  const spentToday  = financeData?.spentToday ?? 0;
  const dailyBudget = settings?.allocatedPerDay ?? 0;
  const currency    = settings?.currency ?? 'USD';

  const recentFinance  = financeHistory.filter(d => last7Set.has(d.date));
  const todayStr       = last7[last7.length - 1];
  const todayInHistory = recentFinance.find(d => d.date === todayStr);
  const allLast7Spending = todayInHistory
    ? recentFinance
    : [...recentFinance, { date: todayStr, total: spentToday, entries: financeData?.history ?? [] }];

  const totalSpentLast7Days = allLast7Spending.reduce((s, d) => s + d.total, 0);
  const dailyAverageSpend   = allLast7Spending.length > 0 ? totalSpentLast7Days / allLast7Spending.length : 0;
  const busiestDay          = [...allLast7Spending].sort((a, b) => b.total - a.total)[0];
  const budgetUsedTodayPct  = dailyBudget > 0 ? Math.round((spentToday / dailyBudget) * 100) : 0;

  // ── Collect individual spending entries for the last 7 days ───────────────
  const recentSpendingEntries: SpendingEntryContext[] = [];

  // Today's entries come from financeData.history (always fresh)
  if (financeData?.history) {
    for (const entry of financeData.history) {
      recentSpendingEntries.push({
        date: todayStr,
        amount: entry.amount,
        note: entry.note,
        time: entry.time,
      });
    }
  }

  // Past days' entries come from financeHistory[].entries
  for (const day of financeHistory) {
    if (!last7Set.has(day.date) || day.date === todayStr) continue;
    if (!day.entries) continue;
    for (const entry of day.entries) {
      recentSpendingEntries.push({
        date: day.date,
        amount: entry.amount,
        note: entry.note,
        time: entry.time,
      });
    }
  }

  // Sort chronologically (oldest first)
  recentSpendingEntries.sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    return dateCmp !== 0 ? dateCmp : (a.time ?? '').localeCompare(b.time ?? '');
  });

  // ── Weekly snapshot ────────────────────────────────────────────────────────
  const weeklySnapshot: WeeklySnapshotDay[] = last7.map(date => {
    const record  = completionHistory.find(r => r.date === date);
    const finance = allLast7Spending.find(d => d.date === date);
    const dow     = new Date(date + 'T00:00:00').getDay();

    const completedIds: string[] = record?.completedIds ?? [];
    const scheduledIds: string[] = record?.scheduledIds ?? [];
    const habitLabelsCompleted   = completedIds
      .map(id => habitLabelById[id])
      .filter(Boolean);

    return {
      date,
      dayName: DAY_NAMES[dow],
      habitsCompleted: completedIds.length,
      habitsScheduled: scheduledIds.length,
      habitLabelsCompleted,
      spent: finance?.total ?? (date === todayStr ? spentToday : 0),
    };
  });

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
    weeklySnapshot,
    recentSpendingEntries,
  };
}