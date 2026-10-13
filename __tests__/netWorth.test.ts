import {
  EMPTY_NET_WORTH, MAX_ACCOUNTS, compactAmount, deleteAccount, parseNetWorth, saveAccount, withSnapshot, worthTotals, worthTrend,
  type NetWorth,
} from '../src/netWorth';
import type { Savings } from '../src/savings';

const today = '2026-10-13';
const jars: Savings = { jars: [
  { id: 'j1', goal: { name: 'Phone', emoji: '📱', target: 20000, createdAt: '2026-08-20' }, entries: [{ id: 'a', amount: 5800, date: '2026-09-01', kind: 'deposit' }] },
  { id: 'j2', goal: { name: 'Trip', emoji: '✈️', target: 9000, createdAt: '2026-09-01' }, entries: [{ id: 'b', amount: 200.5, date: '2026-09-03', kind: 'deposit' }] },
] };
const noJars: Savings = { jars: [] };

const mine: NetWorth = { history: [], accounts: [
  { id: 'cash', name: 'Wallet', kind: 'cash', balance: 1500, updatedAt: '2026-10-01' },
  { id: 'bank', name: 'Savings account', kind: 'bank', balance: 42000.25, updatedAt: '2026-10-10' },
  { id: 'card', name: 'Credit card', kind: 'debt', balance: 8000, updatedAt: '2026-10-05' },
] };

describe('worthTotals', () => {
  it('adds what the user has and takes off what they owe', () => {
    expect(worthTotals(mine, noJars)).toEqual({ have: 43500.25, owe: 8000, jars: 0, total: 35500.25 });
  });

  it('counts savings jars unless they are left out', () => {
    expect(worthTotals(mine, jars)).toEqual({ have: 43500.25, owe: 8000, jars: 6000.5, total: 41500.75 });
    expect(worthTotals({ ...mine, countJars: false }, jars)).toMatchObject({ jars: 0, total: 35500.25 });
  });

  it('can be below zero', () => {
    expect(worthTotals({ ...mine, accounts: [mine.accounts[2]] }, noJars).total).toBe(-8000);
  });
});

describe('accounts', () => {
  it('adds one dated today, and keeps the date unless the balance changes', () => {
    const added = saveAccount(EMPTY_NET_WORTH, 'g', { name: '  GCash ', kind: 'wallet', balance: 320.456 }, today);
    expect(added.accounts).toEqual([{ id: 'g', name: 'GCash', kind: 'wallet', balance: 320.46, updatedAt: today }]);

    const renamed = saveAccount(mine, 'cash', { name: 'Cash', kind: 'cash', balance: 1500 }, today);
    expect(renamed.accounts[0]).toMatchObject({ name: 'Cash', updatedAt: '2026-10-01' });
    const topped = saveAccount(mine, 'cash', { name: 'Wallet', kind: 'cash', balance: 900 }, today);
    expect(topped.accounts[0]).toMatchObject({ balance: 900, updatedAt: today });
    expect(topped.accounts).toHaveLength(3);
  });

  it('never goes below zero, stops at the limit, and can be removed', () => {
    expect(saveAccount(EMPTY_NET_WORTH, 'x', { name: 'X', kind: 'cash', balance: -5 }, today).accounts[0].balance).toBe(0);
    const full: NetWorth = { history: [], accounts: Array.from({ length: MAX_ACCOUNTS }, (_, i) => ({ id: `a${i}`, name: 'A', kind: 'cash' as const, balance: 1, updatedAt: today })) };
    expect(saveAccount(full, 'new', { name: 'B', kind: 'cash', balance: 1 }, today)).toBe(full);
    expect(deleteAccount(mine, 'card').accounts.map(a => a.id)).toEqual(['cash', 'bank']);
  });
});

describe('the trend', () => {
  it('keeps each month’s last total, and nothing while there are no accounts', () => {
    const sep = withSnapshot(mine, 30000, '2026-09-20');
    const oct = withSnapshot(withSnapshot(sep, 35000, '2026-10-02'), 35500.25, today);
    expect(oct.history).toEqual([{ month: '2026-09', total: 30000 }, { month: '2026-10', total: 35500.25 }]);
    expect(withSnapshot(oct, 35500.25, today)).toBe(oct);
    expect(withSnapshot(EMPTY_NET_WORTH, 0, today)).toBe(EMPTY_NET_WORTH);
  });

  it('charts the last months and compares with the month kept before', () => {
    const n = { ...mine, history: [
      { month: '2026-03', total: 1 }, { month: '2026-04', total: 2 }, { month: '2026-05', total: 3 }, { month: '2026-06', total: 4 },
      { month: '2026-07', total: 5 }, { month: '2026-08', total: 30000 }, { month: '2026-10', total: 35500.25 },
    ] };
    const t = worthTrend(n, today);
    expect(t.points.map(p => p.month)).toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-10']);
    // September has no total (the app wasn't opened), so October compares with August.
    expect(t.change).toEqual({ amount: 5500.25, since: '2026-08' });
    expect(worthTrend({ ...mine, history: [{ month: '2026-10', total: 5 }] }, today).change).toBeNull();
  });

  it('writes amounts short', () => {
    expect([0, 950, 1000, 27821, 125000, 999600, 1250000, -8000].map(compactAmount))
      .toEqual(['0', '950', '1k', '27.8k', '125k', '1M', '1.3M', '−8k']);
  });
});

describe('parseNetWorth', () => {
  it('reads what was stored and drops anything misshapen', () => {
    const stored = { ...mine, history: [{ month: '2026-09', total: 30000 }], countJars: false };
    expect(parseNetWorth(JSON.parse(JSON.stringify(stored)))).toEqual(stored);
    expect(parseNetWorth({ accounts: [mine.accounts[0], { id: 'x', name: 'Bad', kind: 'yacht', balance: 1, updatedAt: today }, null], history: [{ month: 'October', total: 1 }] }))
      .toEqual({ accounts: [mine.accounts[0]], history: [] });
    expect(parseNetWorth(null)).toEqual(EMPTY_NET_WORTH);
    expect(parseNetWorth('nope')).toEqual(EMPTY_NET_WORTH);
  });
});
