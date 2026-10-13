// src/netWorth.ts
//
// Net worth: what the user has (cash, a bank account, an e-wallet) less what they owe, as
// balances they keep up by hand. Nothing here is tied to logging spending, so an expense
// stays as quick as it was. Savings jars count in unless the user says they're already in
// an account, and each month's last total is kept for the trend.

import type { IconName } from './icons';
import { jarTotal, type Savings } from './savings';

export type AccountKind = 'cash' | 'bank' | 'wallet' | 'invest' | 'other' | 'debt';

export type Account = {
  id: string;
  name: string;
  kind: AccountKind;
  /** What's in it. For a debt, what's owed, as a positive amount. */
  balance: number;
  /** The day the balance was last set. */
  updatedAt: string;
};

/** The total at the end of a month ("2026-10"), or so far for the month it is. */
export type WorthPoint = { month: string; total: number };

export type NetWorth = {
  accounts: Account[];
  history: WorthPoint[];
  /** Savings jars count toward the total unless this is false. */
  countJars?: boolean;
};

export const EMPTY_NET_WORTH: NetWorth = { accounts: [], history: [] };

/** Accounts at once. */
export const MAX_ACCOUNTS = 30;
/** Months of totals kept. */
const MAX_MONTHS = 36;

export const ACCOUNT_KINDS: { key: AccountKind; label: string; icon: IconName; suggestions: string[] }[] = [
  { key: 'cash',   label: 'Cash',        icon: 'coin',        suggestions: ['Wallet', 'Cash at home'] },
  { key: 'bank',   label: 'Bank',        icon: 'piggy-bank',  suggestions: ['Savings account', 'Payroll account'] },
  { key: 'wallet', label: 'E-wallet',    icon: 'money-bag',   suggestions: ['GCash', 'Maya', 'PayPal'] },
  { key: 'invest', label: 'Investments', icon: 'chart-up',    suggestions: ['Stocks', 'Mutual fund', 'Crypto'] },
  { key: 'other',  label: 'Other',       icon: 'box',         suggestions: ['Owed to me', 'Emergency fund'] },
  { key: 'debt',   label: 'Debt',        icon: 'money-wings', suggestions: ['Credit card', 'Loan', 'Owed to a friend'] },
];

export const kindOf = (kind: AccountKind) => ACCOUNT_KINDS.find(k => k.key === kind) ?? ACCOUNT_KINDS[4];

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Jars count unless switched off (when their money already sits in an account that's listed). */
export const countsJars = (n: NetWorth): boolean => n.countJars !== false;

export type WorthTotals = { have: number; owe: number; jars: number; total: number };

/** What the user has and owes. `have` leaves the jars out; `jars` is 0 when they don't count. */
export const worthTotals = (n: NetWorth, savings: Savings): WorthTotals => {
  const sum  = (debts: boolean) => round2(n.accounts.filter(a => (a.kind === 'debt') === debts).reduce((s, a) => s + a.balance, 0));
  const have = sum(false);
  const owe  = sum(true);
  const jars = countsJars(n) ? round2(savings.jars.reduce((s, j) => s + jarTotal(j), 0)) : 0;
  return { have, owe, jars, total: round2(have + jars - owe) };
};

// ── Accounts ─────────────────────────────────────────────────────────────────

export type AccountData = Pick<Account, 'name' | 'kind' | 'balance'>;

/** Adds an account (`id` is new) or changes one. A balance that changed is dated today. */
export const saveAccount = (n: NetWorth, id: string, data: AccountData, todayKey: string): NetWorth => {
  const clean = { name: data.name.trim(), kind: data.kind, balance: round2(Math.max(0, data.balance)) };
  const was   = n.accounts.find(a => a.id === id);
  if (!was) return n.accounts.length >= MAX_ACCOUNTS ? n : { ...n, accounts: [...n.accounts, { id, ...clean, updatedAt: todayKey }] };
  const next: Account = { ...was, ...clean, updatedAt: was.balance === clean.balance ? was.updatedAt : todayKey };
  return { ...n, accounts: n.accounts.map(a => (a.id === id ? next : a)) };
};

export const deleteAccount = (n: NetWorth, id: string): NetWorth => ({ ...n, accounts: n.accounts.filter(a => a.id !== id) });

// ── Trend ────────────────────────────────────────────────────────────────────

/** "2026-10" for a day in October. */
export const monthOf = (dayKey: string): string => dayKey.slice(0, 7);

/**
 * The history with this month's total set, so a month keeps the last total it saw. Nothing
 * is kept while there are no accounts (jars alone aren't a net worth). Returns the same
 * object when nothing changed.
 */
export const withSnapshot = (n: NetWorth, total: number, todayKey: string): NetWorth => {
  if (n.accounts.length === 0) return n;
  const month = monthOf(todayKey);
  if (n.history.some(p => p.month === month && p.total === total)) return n;
  const history = [...n.history.filter(p => p.month !== month), { month, total }]
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-MAX_MONTHS);
  return { ...n, history };
};

/**
 * The last `count` months to chart, and how this month compares with the one kept before
 * it (not always last month: a month the app wasn't opened has no total).
 */
export const worthTrend = (n: NetWorth, todayKey: string, count = 6): { points: WorthPoint[]; change: { amount: number; since: string } | null } => {
  const month  = monthOf(todayKey);
  const points = n.history.filter(p => p.month <= month).slice(-count);
  const now    = points.find(p => p.month === month);
  const before = points.filter(p => p.month < month).pop();
  return { points, change: now && before ? { amount: round2(now.total - before.total), since: before.month } : null };
};

/** "27.8k", "1.2M", "−950": an amount short enough to sit over a bar. */
export const compactAmount = (n: number): string => {
  const a     = Math.abs(n);
  const short = (x: number) => (x >= 100 ? String(Math.round(x)) : String(Math.round(x * 10) / 10));
  const text  = a >= 999_500 ? `${short(a / 1_000_000)}M` : a >= 1_000 ? `${short(a / 1_000)}k` : String(Math.round(a));
  return `${n < 0 ? '−' : ''}${text}`;
};

// ── Stored ───────────────────────────────────────────────────────────────────

const KINDS = ACCOUNT_KINDS.map(k => k.key) as string[];

/** Net worth as stored or restored, without anything that isn't shaped right. */
export const parseNetWorth = (raw: unknown): NetWorth => {
  if (typeof raw !== 'object' || raw === null) return EMPTY_NET_WORTH;
  const r = raw as { accounts?: unknown; history?: unknown; countJars?: unknown };
  const accounts = (Array.isArray(r.accounts) ? r.accounts : []).filter((a): a is Account =>
    typeof a === 'object' && a !== null && typeof a.id === 'string' && typeof a.name === 'string'
    && KINDS.includes(a.kind) && typeof a.balance === 'number' && isFinite(a.balance) && typeof a.updatedAt === 'string');
  const history = (Array.isArray(r.history) ? r.history : []).filter((p): p is WorthPoint =>
    typeof p === 'object' && p !== null && typeof p.month === 'string' && /^\d{4}-\d{2}$/.test(p.month)
    && typeof p.total === 'number' && isFinite(p.total));
  return { accounts, history, ...(r.countJars === false ? { countJars: false } : {}) };
};
