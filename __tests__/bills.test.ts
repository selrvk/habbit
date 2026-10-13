import {
  billScheduleLabel, daysInMonth, defaultRemindBefore, dueDatesBetween, logDueBills, nextDueDate, remindChoices, reminderDate, reminderText,
  remindLabel, upcomingDueDate, type Bill,
} from '../src/bills';
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
    expect(billScheduleLabel({ repeat: 'yearly', day: 15, month: 2 })).toBe('Yearly on Mar 15');
  });
});

describe('yearly bills', () => {
  const insurance = (over: Partial<Bill> = {}) => bill({ id: 'ins', name: 'Insurance', amount: 12000, repeat: 'yearly', day: 15, month: 2, inBudget: false, ...over });

  it('are due once a year, on their month and day', () => {
    expect(dueDatesBetween(insurance({ startDate: '2026-01-01' }), '2026-01-01', '2028-12-31')).toEqual(['2026-03-15', '2027-03-15', '2028-03-15']);
    expect(nextDueDate(insurance(), '2026-10-13')).toBe('2027-03-15');
    expect(nextDueDate(insurance(), '2027-03-15')).toBe('2027-03-15');
    expect(upcomingDueDate(insurance({ lastLogged: '2027-03-15' }), '2027-03-15')).toBe('2028-03-15');
  });

  it('use Feb 28 when there is no Feb 29, and pick days the month has', () => {
    const leap = insurance({ day: 29, month: 1 });
    expect([nextDueDate(leap, '2026-10-13'), nextDueDate(leap, '2027-03-01')]).toEqual(['2027-02-28', '2028-02-29']);
    expect([daysInMonth(1), daysInMonth(3), daysInMonth(11)]).toEqual([29, 30, 31]);
  });

  it('are logged once when their day comes, and only count against the budget if asked', () => {
    const today = { spentToday: 0, date: '2027-03-15', history: [] };
    const r = logDueBills([insurance({ lastLogged: '2026-03-15' })], today, [], '2027-03-15');
    expect(r.finance.history.map(e => e.id)).toEqual(['bill-ins-2027-03-15']);
    expect(r.finance.spentToday).toBe(12000);
    expect(logDueBills(r.bills, r.finance, r.dailyTotals, '2027-03-16').changed).toBe(false);

    const base = { period: 'monthly' as const, amount: 20000, spentToday: 0, dailyTotals: [], topUps: [] };
    expect(computeBudget({ ...base, todayKey: '2027-03-01', bills: [insurance()] }).billsSetAside).toBe(0);
    expect(computeBudget({ ...base, todayKey: '2027-03-01', bills: [insurance({ inBudget: true })] }).billsSetAside).toBe(12000);
    expect(computeBudget({ ...base, todayKey: '2027-04-01', bills: [insurance({ inBudget: true })] }).billsSetAside).toBe(0);
  });
});

describe('reminders', () => {
  it('come on the day unless the bill asks for notice; a yearly one starts with a week', () => {
    expect(reminderDate(bill(), '2026-11-01')).toBe('2026-11-01');
    expect(reminderDate(bill({ remindBefore: 1 }), '2026-11-01')).toBe('2026-10-31');
    expect(reminderDate(bill({ remindBefore: 7 }), '2027-03-03')).toBe('2027-02-24');
    expect([defaultRemindBefore('monthly'), defaultRemindBefore('weekly'), defaultRemindBefore('yearly')]).toEqual([0, 0, 7]);
  });

  it('offer a week ahead except for weekly bills', () => {
    expect(remindChoices('monthly')).toEqual([0, 1, 3, 7]);
    expect(remindChoices('yearly')).toEqual([0, 1, 3, 7]);
    expect(remindChoices('weekly')).toEqual([0, 1, 3]);
    expect([0, 1, 3, 7].map(remindLabel)).toEqual(['On the day', 'The day before', '3 days before', 'A week before']);
  });

  it('say when the bill is due', () => {
    expect(reminderText(bill(), '₱8,000', '2026-11-01')).toBe('Rent (₱8,000) is due today. Habbit logs it for you.');
    expect(reminderText(bill({ remindBefore: 1 }), '₱8,000', '2026-11-01')).toBe('Rent (₱8,000) is due tomorrow.');
    expect(reminderText(bill({ remindBefore: 3 }), '₱8,000', '2026-11-01')).toBe('Rent (₱8,000) is due in 3 days, on Nov 1.');
    expect(reminderText(bill({ remindBefore: 7 }), '₱8,000', '2026-11-01')).toBe('Rent (₱8,000) is due in a week, on Nov 1.');
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
