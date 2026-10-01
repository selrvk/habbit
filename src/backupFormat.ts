// src/backupFormat.ts
//
// The backup format: everything needed to rebuild the app on a new install. Used for the
// automatic iCloud backup and for exported backup files. Pure functions only; reading and
// writing storage happens in utils/cloudBackup.ts.

import {
  STORAGE_COACH_MESSAGES, STORAGE_COMMISSIONS, STORAGE_COMPLETION_HISTORY, STORAGE_FINANCE,
  STORAGE_FINANCE_HISTORY, STORAGE_SETTINGS, STORAGE_STATS, STORAGE_TOPUPS, STORAGE_BILLS,
} from './storage';
import type { DailyTotal, FinanceData } from './types';
import type { TopUp } from './budget';
import { categoryOf } from './categories';

export const BACKUP_VERSION = 1;

/** Section name in the file → AsyncStorage key. */
export const BACKUP_SECTIONS = {
  settings:      STORAGE_SETTINGS,
  habits:        STORAGE_COMMISSIONS,
  stats:         STORAGE_STATS,
  completions:   STORAGE_COMPLETION_HISTORY,
  today:         STORAGE_FINANCE,
  spending:      STORAGE_FINANCE_HISTORY,
  topUps:        STORAGE_TOPUPS,
  bills:         STORAGE_BILLS,
  coachMessages: STORAGE_COACH_MESSAGES,
} as const;

export type BackupSection = keyof typeof BACKUP_SECTIONS;

export type BackupFile = {
  app: 'habbit';
  version: number;
  /** ISO timestamp. Also identifies the backup (see cloudBackup's "handled" marker). */
  createdAt: string;
  data: Partial<Record<BackupSection, unknown>>;
};

export type BackupSummary = { createdAt: string; habits: number; spendingDays: number };

export class BackupError extends Error {}

const isObject = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);

// Just enough shape checking that a restored backup can't crash the app on load.
const VALIDATORS: Record<BackupSection, (v: any) => boolean> = {
  settings:      v => isObject(v),
  habits:        v => isObject(v) && Array.isArray(v.items) && typeof v.date === 'string',
  stats:         v => isObject(v) && typeof v.currentStreak === 'number',
  completions:   v => Array.isArray(v),
  today:         v => isObject(v) && typeof v.spentToday === 'number' && typeof v.date === 'string',
  spending:      v => isObject(v) && Array.isArray(v.dailyTotals),
  topUps:        v => Array.isArray(v),
  bills:         v => Array.isArray(v),
  coachMessages: v => Array.isArray(v),
};

const SECTION_NAMES = Object.keys(BACKUP_SECTIONS) as BackupSection[];

/** Builds a backup from raw AsyncStorage values (as returned by getMany). */
export const createBackup = (stored: Record<string, string | null>, now = new Date()): BackupFile => {
  const data: BackupFile['data'] = {};
  for (const section of SECTION_NAMES) {
    const raw = stored[BACKUP_SECTIONS[section]];
    if (!raw) continue;
    try { data[section] = JSON.parse(raw); } catch {}
  }
  return { app: 'habbit', version: BACKUP_VERSION, createdAt: now.toISOString(), data };
};

/** Parses and checks a backup file's text. Throws BackupError with a user-facing message. */
export const parseBackup = (text: string): BackupFile => {
  let raw: any;
  try { raw = JSON.parse(text); } catch { raw = null; }
  if (!isObject(raw) || raw.app !== 'habbit' || !isObject(raw.data)) {
    throw new BackupError('This file isn’t a Habbit backup.');
  }
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION) {
    throw new BackupError('This backup is from a newer version of Habbit. Update the app and try again.');
  }
  const data: BackupFile['data'] = {};
  for (const section of SECTION_NAMES) {
    const value = raw.data[section];
    if (value === undefined || value === null) continue;
    if (!VALIDATORS[section](value)) throw new BackupError('This backup is damaged and can’t be restored.');
    data[section] = value;
  }
  return { app: 'habbit', version: raw.version, createdAt: String(raw.createdAt ?? ''), data };
};

/** What restoring a backup writes to AsyncStorage. Sections missing from it are cleared. */
export const backupToStorage = (file: BackupFile): { set: Record<string, string>; remove: string[] } => {
  const set: Record<string, string> = {};
  const remove: string[] = [];
  for (const section of SECTION_NAMES) {
    const value = file.data[section];
    if (value === undefined) remove.push(BACKUP_SECTIONS[section]);
    else set[BACKUP_SECTIONS[section]] = JSON.stringify(value);
  }
  return { set, remove };
};

export const summarizeBackup = (file: BackupFile): BackupSummary => {
  const habits   = (file.data.habits as { items?: unknown[] } | undefined)?.items?.length ?? 0;
  const days     = (file.data.spending as { dailyTotals?: unknown[] } | undefined)?.dailyTotals?.length ?? 0;
  const today    = file.data.today as FinanceData | undefined;
  return { createdAt: file.createdAt, habits, spendingDays: days + (today && today.spentToday > 0 ? 1 : 0) };
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "5 habbits · 41 days of spending" */
export const describeBackupContents = ({ habits, spendingDays }: { habits: number; spendingDays: number }) =>
  `${plural(habits, 'habbit')} · ${plural(spendingDays, 'day')} of spending`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "just now", "12 min ago", "today at 3:05 PM", "yesterday at 9:40 AM", "Sep 30", "Dec 2, 2025" */
export const describeBackupTime = (iso: string, now = new Date()): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'at an unknown time';
  const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins} min ago`;

  const h    = d.getHours();
  const time = `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const daysAgo = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (daysAgo === 0) return `today at ${time}`;
  if (daysAgo === 1) return `yesterday at ${time}`;
  const date = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear() === now.getFullYear() ? date : `${date}, ${d.getFullYear()}`;
};

// ── Spending CSV ────────────────────────────────────────────────────────────

/** "3:45 PM" → minutes since midnight, for sorting. Unknown times sort first. */
const timeToMinutes = (t?: string): number => {
  const m = t?.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return -1;
  return ((Number(m[1]) % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0)) * 60 + Number(m[2]);
};

const csvField = (v: string | number): string => {
  let s = String(v);
  // Stop spreadsheets from treating a note like "=SUM(...)" as a formula.
  if (/^[=+\-@]/.test(s) && typeof v === 'string') s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** All spending and added money, oldest first. */
export const spendingCsv = ({ dailyTotals, today, topUps }: {
  dailyTotals: DailyTotal[]; today: FinanceData | null; topUps: TopUp[];
}): string => {
  type Row = { date: string; time: string; type: 'Spent' | 'Added money'; category: string; amount: number; note: string };
  const rows: Row[] = [];
  const days = today ? [...dailyTotals.filter(d => d.date !== today.date), { date: today.date, total: today.spentToday, entries: today.history }] : dailyTotals;
  for (const day of days) {
    if (day.entries && day.entries.length > 0) {
      for (const e of day.entries) rows.push({ date: day.date, time: e.time ?? '', type: 'Spent', category: categoryOf(e.category)?.label ?? '', amount: e.amount, note: e.note ?? '' });
    } else if (day.total > 0) {
      // Very old history only kept the day's total.
      rows.push({ date: day.date, time: '', type: 'Spent', category: '', amount: day.total, note: '(day total)' });
    }
  }
  for (const t of topUps) rows.push({ date: t.date, time: t.time ?? '', type: 'Added money', category: '', amount: t.amount, note: t.note ?? '' });

  rows.sort((a, b) => a.date.localeCompare(b.date) || timeToMinutes(a.time) - timeToMinutes(b.time));
  const lines = rows.map(r => [r.date, r.time, r.type, r.category, r.amount, r.note].map(csvField).join(','));
  return ['Date,Time,Type,Category,Amount,Note', ...lines].join('\n') + '\n';
};
