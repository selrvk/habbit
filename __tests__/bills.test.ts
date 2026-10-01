import { billScheduleLabel, dueDatesBetween, logDueBills, nextDueDate, upcomingDueDate, type Bill } from '../src/bills';
import { computeBudget } from '../src/budget';

// 2026-10-01 is a Thursday.
const bill = (over: Partial<Bill> = {}): Bill => ({
  id: 'rent', name: 'Rent', amount: 8000, repeat: 'monthly', day: 1,
  inBudget: true, remind: true, startDate: '2026-09-01', ...over,
});

describe('due dates', () => {
  it('uses the last day of short months', () => {
    expect(dueDatesBetween(bill({ day: 31 }), '2026-09-01', '2026-11-30')).toEqual(['2026-09-30', '2026-10-31', '2026-11-30']);
  });
  it('repeats weekly on a weekday, never before the bill started', () => {
    expect(dueDatesBetween(bill({ repeat: 'weekly', day: 1, startDate: '2026-09-29' }), '2026-09-21', '2026-10-13'))
      .toEqual(['2026-10-05', '2026-10-12']);
  });
  it('finds the next due date', () => {
    expect(nextDueDate(bill({ day: 15 }), '2026-10-01')).toBe('2026-10-15');
    expect(nextDueDate(bill(), '2026-10-01')).toBe('2026-10-01');
  });
  it('describes the schedule', () => {
    expect(billScheduleLabel({ repeat: 'monthly', day: 22 })).toBe('Monthly on the 22nd');
    expect(billScheduleLabel({ repeat: 'monthly', day: 11 })).toBe('Monthly on the 11th');
    expect(billScheduleLabel({ repeat: 'weekly', day: 1 })).toBe('Weekly on Monday');
  });
});

describe('logDueBills', () => {
  const today = { spentToday: 50, date: '2026-10-01', history: [{ id: 'x', amount: 50, time: '9:00 AM' }] };

  it('logs today’s bill into today and earlier missed ones into their day, once', () => {
    const spotify = bill({ id: 'sp', name: 'Spotify', amount: 149, day: 28, lastLogged: '2026-08-28' });
    const r = logDueBills([bill({ lastLogged: '2026-09-01' }), spotify], today, [{ date: '2026-09-28', total: 20 }], '2026-10-01');
    expect(r.finance.spentToday).toBe(8050);
    expect(r.finance.history.map(e => e.id)).toEqual(['x', 'bill-rent-2026-10-01']);
    expect(r.finance.history[1]).toMatchObject({ category: 'bills', billId: 'rent', note: 'Rent' });
    expect(r.dailyTotals).toEqual([{ date: '2026-09-28', total: 169, entries: [expect.objectContaining({ id: 'bill-sp-2026-09-28' })] }]);
    expect(r.bills.map(b => b.lastLogged)).toEqual(['2026-10-01', '2026-09-28']);

    const again = logDueBills(r.bills, r.finance, r.dailyTotals, '2026-10-01');
    expect(again.changed).toBe(false);
  });
});

describe('computeBudget with bills', () => {
  const base = { amount: 20000, todayKey: '2026-10-01', topUps: [] };

  it('sets monthly bills aside up front and does not count their entries again', () => {
    const rent = bill();
    const todayHistory = [{ id: 'bill-rent-2026-10-01', amount: 8000, time: '', billId: 'rent' }, { id: 'a', amount: 100, time: '9:00 AM' }];
    const b = computeBudget({ ...base, period: 'monthly', spentToday: 8100, todayHistory, dailyTotals: [], bills: [rent] });
    expect(b.billsSetAside).toBe(8000);
    expect(b.dailyAllowance).toBeCloseTo((20000 - 8000) / 31);
    expect(b.spentToday).toBe(100);
    expect(b.periodLeft).toBe(20000 - 8000 - 100);
  });

  it('skips bills that are switched off, and daily budgets only track bills', () => {
    const off = computeBudget({ ...base, period: 'monthly', spentToday: 0, dailyTotals: [], bills: [bill({ inBudget: false })] });
    expect(off.billsSetAside).toBe(0);
    const daily = computeBudget({ ...base, amount: 500, period: 'daily', spentToday: 8000,
      todayHistory: [{ id: 'b', amount: 8000, time: '', billId: 'rent' }], dailyTotals: [], bills: [bill()] });
    expect(daily).toMatchObject({ billsSetAside: 0, spentToday: 0, leftToday: 500 });
  });
});

describe('upcomingDueDate', () => {
  it('moves past today once today’s payment is logged', () => {
    expect(upcomingDueDate(bill(), '2026-10-01')).toBe('2026-10-01');
    expect(upcomingDueDate(bill({ lastLogged: '2026-10-01' }), '2026-10-01')).toBe('2026-11-01');
  });
});
