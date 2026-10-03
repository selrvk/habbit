// src/inbox.ts
//
// Things done outside the app (Siri, Shortcuts, the quick action that checks off the next
// habit) are queued in the App Group by the native side (ios/HabbitIntents.swift) and
// applied here: at launch, on resume, or straight away if the app is running. Each event
// keeps the day it happened, so spending lands on that day and a check-off made late at
// night still counts for that night even if the app only sees it the next morning.

import type { Commission, CompletionRecord, DailyTotal, FinanceData, SpendingEntry, Stats } from './types';
import { isScheduledForDay, parseDateKey } from './helpers';
import { addEntryOnDay, rolloverFinance, rolloverHabits } from './dayRollover';
import { logDueBills, type Bill } from './bills';
import { categoryOf } from './categories';

export type InboxEvent =
  | { id: string; kind: 'spend'; date: string; time: string; amount: number; category?: string; note?: string }
  | { id: string; kind: 'habit'; date: string; habitId: string }
  /** The focus timer's Live Activity button, pressed at `at` (ms). Applied in App.tsx. */
  | { id: string; kind: 'focus'; date: string; action: 'pause' | 'resume'; at: number };

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_AMOUNT = 100_000_000;

/** The queue as JSON, keeping only well-formed events. */
export const parseInbox = (raw: string | null | undefined): InboxEvent[] => {
  let list: unknown;
  try { list = raw ? JSON.parse(raw) : []; } catch { return []; }
  if (!Array.isArray(list)) return [];
  return list.flatMap((e): InboxEvent[] => {
    if (!e || typeof e !== 'object' || typeof e.id !== 'string' || typeof e.date !== 'string' || !DAY_KEY.test(e.date)) return [];
    if (e.kind === 'spend') {
      const amount = Math.round(Number(e.amount) * 100) / 100;
      if (!(amount > 0 && amount < MAX_AMOUNT)) return [];
      const note = typeof e.note === 'string' ? e.note.trim().slice(0, 60) : '';
      return [{
        id: e.id, kind: 'spend', date: e.date, time: typeof e.time === 'string' ? e.time : '', amount,
        ...(categoryOf(e.category) ? { category: e.category } : {}),
        ...(note ? { note } : {}),
      }];
    }
    if (e.kind === 'habit' && typeof e.habitId === 'string') return [{ id: e.id, kind: 'habit', date: e.date, habitId: e.habitId }];
    if (e.kind === 'focus' && (e.action === 'pause' || e.action === 'resume') && Number.isFinite(e.at)) {
      return [{ id: e.id, kind: 'focus', date: e.date, action: e.action, at: Number(e.at) }];
    }
    return [];
  });
};

/** Logs each spending event on its own day. */
export const applySpending = (
  finance: FinanceData, dailyTotals: DailyTotal[], events: InboxEvent[],
): { finance: FinanceData; dailyTotals: DailyTotal[]; changed: boolean } => {
  let next = { finance, dailyTotals };
  for (const e of events) {
    if (e.kind !== 'spend') continue;
    const entry: SpendingEntry = {
      id: e.id, amount: e.amount, time: e.time,
      ...(e.note ? { note: e.note } : {}), ...(e.category ? { category: e.category } : {}),
    };
    next = addEntryOnDay(next.finance, next.dailyTotals, entry, e.date);
  }
  return { ...next, changed: next.finance !== finance || next.dailyTotals !== dailyTotals };
};

/**
 * Applies check-offs made on `dayKey` to that day's habits, one step each like a tap in the
 * app (a 3× a day habit needs three). Habits that aren't on that day, or are already done,
 * are left alone. `finished` counts habits that became done, for totalCompleted.
 */
export const applyCheckOffs = (
  commissions: Commission[], events: InboxEvent[], dayKey: string,
): { commissions: Commission[]; finished: number; changed: boolean } => {
  const dow = parseDateKey(dayKey).getDay();
  let finished = 0;
  let changed = false;
  let next = commissions;
  for (const e of events) {
    if (e.kind !== 'habit' || e.date !== dayKey) continue;
    next = next.map(c => {
      if (c.id !== e.habitId || c.completed || (!c.perWeek && !isScheduledForDay(c, dow))) return c;
      changed = true;
      const tpd = c.timesPerDay ?? 1;
      if (tpd === 1) { finished++; return { ...c, completed: true, skipped: false }; }
      const count = (c.completionCount ?? 0) + 1;
      if (count >= tpd) finished++;
      return { ...c, completionCount: count, completed: count >= tpd, skipped: false };
    });
  }
  return { commissions: next, finished, changed };
};

export type DayState = {
  habits: { date: string; commissions: Commission[]; stats: Stats; history: CompletionRecord[] };
  finance: FinanceData;
  dailyTotals: DailyTotal[];
  bills: Bill[];
};

/**
 * Brings stored state up to today, applying queued events in order: check-offs from the
 * day being closed, then the new day, then today's check-offs, bills due, and spending.
 */
export const catchUpDay = (prev: DayState, todayKey: string, events: InboxEvent[]) => {
  const early  = applyCheckOffs(prev.habits.commissions, events, prev.habits.date);
  const habits = rolloverHabits({ ...prev.habits, commissions: early.commissions }, todayKey);
  const late   = habits.changed
    ? applyCheckOffs(habits.commissions, events, todayKey)
    : { commissions: habits.commissions, finished: 0, changed: false };
  const finished = early.finished + late.finished;
  const stats    = finished > 0 ? { ...habits.stats, totalCompleted: habits.stats.totalCompleted + finished } : habits.stats;

  const rolled = rolloverFinance(prev.finance, prev.dailyTotals, todayKey);
  const due    = logDueBills(prev.bills, { ...rolled.finance, history: rolled.finance.history ?? [] }, rolled.dailyTotals, todayKey);
  const spend  = applySpending(due.finance, due.dailyTotals, events);

  return {
    newDay:         habits.changed,
    commissions:    late.commissions,
    habitsChanged:  habits.changed || early.changed || late.changed,
    stats,
    history:        habits.history,
    finance:        spend.finance,
    dailyTotals:    spend.dailyTotals,
    financeChanged: rolled.changed || due.changed || spend.changed,
    bills:          due.bills,
    billsChanged:   due.changed,
  };
};
