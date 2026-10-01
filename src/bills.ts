// src/bills.ts
//
// Recurring bills (rent, subscriptions). Each due date is logged as spending in the Bills
// category automatically, backdated to its day if the app wasn't opened then. Bills that
// count toward a weekly or monthly budget are set aside from it up front (computeBudget),
// so the daily allowance already allows for them and their entries aren't counted again.

import type { DailyTotal, FinanceData, SpendingEntry } from './types';
import { addDaysToKey, parseDateKey } from './helpers';
import { addEntryOnDay } from './dayRollover';

export type BillRepeat = 'monthly' | 'weekly';

export type Bill = {
  id: string;
  name: string;
  amount: number;
  repeat: BillRepeat;
  /** Monthly: day of the month (1–31; short months use their last day). Weekly: 0 = Sunday. */
  day: number;
  /** Set aside from weekly/monthly budgets. Daily budgets only track bills. */
  inBudget: boolean;
  /** A reminder on the due day. */
  remind: boolean;
  /** The first day it can be due (the day it was added). */
  startDate: string;
  /** The last due date logged as spending. */
  lastLogged?: string;
};

// Due dates are found by checking each day, so cap how far a scan goes.
const MAX_SCAN_DAYS = 400;

export const isDueOn = (bill: Bill, dayKey: string): boolean => {
  const d = parseDateKey(dayKey);
  if (bill.repeat === 'weekly') return d.getDay() === bill.day;
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return d.getDate() === Math.min(bill.day, lastDay);
};

/** Due dates from `fromKey` to `toKey` inclusive, never before the bill started. */
export const dueDatesBetween = (bill: Bill, fromKey: string, toKey: string): string[] => {
  const dates: string[] = [];
  let key = fromKey < bill.startDate ? bill.startDate : fromKey;
  for (let i = 0; key <= toKey && i < MAX_SCAN_DAYS; i++, key = addDaysToKey(key, 1)) {
    if (isDueOn(bill, key)) dates.push(key);
  }
  return dates;
};

/** The first due date on or after `fromKey`. */
export const nextDueDate = (bill: Bill, fromKey: string): string | null =>
  dueDatesBetween(bill, fromKey, addDaysToKey(fromKey < bill.startDate ? bill.startDate : fromKey, 366))[0] ?? null;

/** The next due date that hasn't been logged yet: tomorrow onwards once today's is logged. */
export const upcomingDueDate = (bill: Bill, todayKey: string): string | null =>
  nextDueDate(bill, bill.lastLogged && bill.lastLogged >= todayKey ? addDaysToKey(todayKey, 1) : todayKey);

/** Total set aside for bills due between two dates (inclusive). */
export const billsDueTotal = (bills: Bill[], fromKey: string, toKey: string): number =>
  bills.filter(b => b.inBudget).reduce((s, b) => s + b.amount * dueDatesBetween(b, fromKey, toKey).length, 0);

/** The spending entry for one due date. Its id is stable, so a due date is never logged twice. */
export const billEntry = (bill: Bill, date: string): SpendingEntry => ({
  id: `bill-${bill.id}-${date}`, amount: bill.amount, time: '', note: bill.name, category: 'bills', billId: bill.id,
});

/** Bill entries that a weekly/monthly budget already set aside (or a daily one doesn't count). */
export const billSpending = (entries: SpendingEntry[] | undefined): number =>
  (entries ?? []).filter(e => e.billId).reduce((s, e) => s + e.amount, 0);

/**
 * Logs every due date since each bill was last logged, up to today: today's go into
 * today's spending, earlier ones into that day's history. `finance` must already be today's.
 */
export const logDueBills = (
  bills: Bill[], finance: FinanceData, dailyTotals: DailyTotal[], todayKey: string,
): { bills: Bill[]; finance: FinanceData; dailyTotals: DailyTotal[]; changed: boolean } => {
  let changed = false;
  let fin     = finance;
  let totals  = dailyTotals;

  const updated = bills.map(bill => {
    const from  = bill.lastLogged ? addDaysToKey(bill.lastLogged, 1) : bill.startDate;
    const dates = dueDatesBetween(bill, from, todayKey);
    if (dates.length === 0) return bill;
    changed = true;

    for (const date of dates) {
      ({ finance: fin, dailyTotals: totals } = addEntryOnDay(fin, totals, billEntry(bill, date), date));
    }
    return { ...bill, lastLogged: dates[dates.length - 1] };
  });

  return { bills: updated, finance: fin, dailyTotals: totals, changed };
};

const ORDINAL = (n: number) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${s}`;
};
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "Monthly on the 1st", "Weekly on Monday". */
export const billScheduleLabel = (bill: Pick<Bill, 'repeat' | 'day'>) =>
  bill.repeat === 'monthly' ? `Monthly on the ${ORDINAL(bill.day)}` : `Weekly on ${WEEKDAYS[bill.day]}`;
