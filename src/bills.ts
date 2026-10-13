// src/bills.ts
//
// Recurring bills (rent, subscriptions, a yearly insurance). Each due date is logged as
// spending in the Bills category automatically, backdated to its day if the app wasn't
// opened then. Bills that count toward a weekly or monthly budget are set aside from it up
// front (computeBudget), so the daily allowance already allows for them and their entries
// aren't counted again.

import type { DailyTotal, FinanceData, SpendingEntry } from './types';
import { addDaysToKey, parseDateKey, toDateKey } from './helpers';
import { addEntryOnDay } from './dayRollover';

export type BillRepeat = 'monthly' | 'weekly' | 'yearly';

export type Bill = {
  id: string;
  name: string;
  amount: number;
  repeat: BillRepeat;
  /** Monthly and yearly: day of the month (1–31; short months use their last day). Weekly: 0 = Sunday. */
  day: number;
  /** Yearly: the month, 0 = January. */
  month?: number;
  /** Set aside from weekly/monthly budgets. Daily budgets only track bills. */
  inBudget: boolean;
  /** A reminder at 9 AM. */
  remind: boolean;
  /** How many days before the due day the reminder comes. Not set: on the day. */
  remindBefore?: number;
  /** The first day it can be due (the day it was added). */
  startDate: string;
  /** The last due date logged as spending. */
  lastLogged?: string;
};

// Weekly and monthly due dates are found by checking each day, so cap how far a scan goes.
// A yearly bill's are worked out a year at a time.
const MAX_SCAN_DAYS = 400;
const MAX_SCAN_YEARS = 50;

export const isDueOn = (bill: Bill, dayKey: string): boolean => {
  const d = parseDateKey(dayKey);
  if (bill.repeat === 'weekly') return d.getDay() === bill.day;
  if (bill.repeat === 'yearly' && d.getMonth() !== (bill.month ?? 0)) return false;
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return d.getDate() === Math.min(bill.day, lastDay);
};

/** A yearly bill's due date in one year. */
const yearlyDueIn = (bill: Bill, year: number): string => {
  const month = bill.month ?? 0;
  return toDateKey(new Date(year, month, Math.min(bill.day, new Date(year, month + 1, 0).getDate())));
};

/** Due dates from `fromKey` to `toKey` inclusive, never before the bill started. */
export const dueDatesBetween = (bill: Bill, fromKey: string, toKey: string): string[] => {
  const dates: string[] = [];
  let key = fromKey < bill.startDate ? bill.startDate : fromKey;
  if (bill.repeat === 'yearly') {
    const first = parseDateKey(key).getFullYear();
    for (let year = first; year <= parseDateKey(toKey).getFullYear() && year < first + MAX_SCAN_YEARS; year++) {
      const due = yearlyDueIn(bill, year);
      if (due >= key && due <= toKey) dates.push(due);
    }
    return dates;
  }
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
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Monthly on the 1st", "Weekly on Monday", "Yearly on Mar 15". */
export const billScheduleLabel = (bill: Pick<Bill, 'repeat' | 'day' | 'month'>) =>
  bill.repeat === 'yearly' ? `Yearly on ${MONTHS[bill.month ?? 0]} ${bill.day}`
    : bill.repeat === 'monthly' ? `Monthly on the ${ORDINAL(bill.day)}` : `Weekly on ${WEEKDAYS[bill.day]}`;

/** The days a month can have, for picking a yearly bill's day (February: 29, due on the 28th in other years). */
export const daysInMonth = (month: number): number => [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month] ?? 31;

// ── Reminders ────────────────────────────────────────────────────────────────

/** How far ahead a reminder can come, in days: on the day, the day before, 3 days, a week. */
const REMIND_BEFORE = [0, 1, 3, 7];

/** The choices for a bill. A weekly one is never reminded a week ahead: that's its last due day. */
export const remindChoices = (repeat: BillRepeat): number[] => REMIND_BEFORE.filter(d => repeat !== 'weekly' || d < 7);

/** A new bill's reminder: a week's notice for a yearly one, on the day for the rest. */
export const defaultRemindBefore = (repeat: BillRepeat): number => (repeat === 'yearly' ? 7 : 0);

export const remindLabel = (days: number): string =>
  days === 0 ? 'On the day' : days === 1 ? 'The day before' : days === 7 ? 'A week before' : `${days} days before`;

/** The day a due date's reminder comes. */
export const reminderDate = (bill: Pick<Bill, 'remindBefore'>, due: string): string => addDaysToKey(due, -(bill.remindBefore ?? 0));

/** What the reminder says: "Rent (₱8,000) is due tomorrow." `amount` comes formatted. */
export const reminderText = (bill: Pick<Bill, 'name' | 'remindBefore'>, amount: string, due: string): string => {
  const before = bill.remindBefore ?? 0;
  const d      = parseDateKey(due);
  const on     = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  const when   = before === 0 ? 'today. Habbit logs it for you' : before === 1 ? 'tomorrow' : before === 7 ? `in a week, on ${on}` : `in ${before} days, on ${on}`;
  return `${bill.name} (${amount}) is due ${when}.`;
};
