import { widgetPayload, widgetWeek } from '../src/widgetPayload';
import type { Commission, CompletionRecord } from '../src/types';

// 2026-10-01 is a Thursday; the week runs Monday 2026-09-28 to Sunday 2026-10-04.
const TODAY = '2026-10-01';

const habit = (id: string, over: Partial<Commission> = {}): Commission => ({
  id, label: id, completed: false, days: [], reminderTime: null,
  timesPerDay: 1, completionCount: 0, reminderTimes: [], reminderSplit: null, ...over,
});

const payload = (over: Partial<Parameters<typeof widgetPayload>[0]['budget']> = {}, commissions: Commission[] = []) => widgetPayload({
  todayKey: TODAY, name: 'Sam', avatar: 'avatar_bunny', currency: '₱', streak: 3, commissions, history: [], thisWeek: () => 0,
  budget: { period: 'weekly', amount: 700, spentToday: 0, todayHistory: [], dailyTotals: [], topUps: [], bills: [], ...over },
});

describe('widgetPayload', () => {
  it("gives today's allowance and what's left of the week", () => {
    const p = payload({ spentToday: 50, todayHistory: [{ id: 'a', amount: 50, time: '' }], dailyTotals: [{ date: '2026-09-29', total: 100 }] });
    expect(p.allocatedPerDay).toBe(150); // (700 − 100) ÷ 4 days left
    expect(p.spentToday).toBe(50);
    expect(p.periodLeft).toBe(550);
  });

  it("works out the coming days' allowances, with today's spending counted and a new week starting over", () => {
    const p = payload({ spentToday: 150, todayHistory: [{ id: 'a', amount: 150, time: '' }] });
    expect(p.upcoming[0]).toEqual({ date: '2026-10-02', allowance: 183.33, periodLeft: 550 }); // Friday: 550 ÷ 3 days
    expect(p.upcoming[2]).toEqual({ date: '2026-10-04', allowance: 550, periodLeft: 550 });    // Sunday: all of it
    expect(p.upcoming[3]).toEqual({ date: '2026-10-05', allowance: 100, periodLeft: 700 }); // Monday: a fresh week
    expect(p.upcoming).toHaveLength(6);
  });

  it('keeps a daily budget the same each day', () => {
    const p = payload({ period: 'daily', amount: 500, spentToday: 600, todayHistory: [{ id: 'a', amount: 600, time: '' }] });
    expect(p.allocatedPerDay).toBe(500);
    expect(p.upcoming.every(u => u.allowance === 500)).toBe(true);
  });

  it("counts today's habits and lists every habit", () => {
    const p = payload({}, [habit('Read', { completed: true }), habit('Gym', { days: [1] }), habit('Swim', { perWeek: 2 }), habit('Water', { skipped: true })]);
    expect(p).toMatchObject({ completedCount: 1, totalCount: 1, upcomingHabbit: '' });
    expect(p.scheduledByDow).toEqual([2, 3, 2, 2, 2, 2, 2]);
    expect(p.habits.map(h => h.id)).toEqual(['Read', 'Gym', 'Swim', 'Water']);
  });
});

describe('widgetWeek', () => {
  const rec = (date: string, done: boolean, scheduled = ['Read']): CompletionRecord =>
    ({ date, scheduledIds: scheduled, completedIds: done ? scheduled : [], completed: done && scheduled.length > 0 });

  it('marks each day of the week, Monday to Sunday', () => {
    const commissions = [habit('Read', { days: [1, 2, 3, 4, 5] })]; // weekdays
    const history = [rec('2026-09-28', true), rec('2026-09-29', false)]; // Wednesday never opened
    const days = [{ date: '2026-09-28', total: 1200, entries: [{ id: 'r', amount: 1000, time: '', billId: 'rent' }, { id: 'a', amount: 200, time: '' }] }];
    expect(widgetWeek(TODAY, commissions, history, days)).toEqual([
      { date: '2026-09-28', state: 'done', spent: 200 },  // rent left out
      { date: '2026-09-29', state: 'missed', spent: 0 },
      { date: '2026-09-30', state: 'missed', spent: 0 },  // Habbits were on
      { date: '2026-10-01', state: 'today', spent: 0 },
      { date: '2026-10-02', state: 'future', spent: 0 },
      { date: '2026-10-03', state: 'future', spent: 0 },
      { date: '2026-10-04', state: 'future', spent: 0 },
    ]);
  });

  it('counts days with nothing on, or everything skipped, as rest', () => {
    const week = widgetWeek(TODAY, [habit('Gym', { days: [1] })], [{ date: '2026-09-28', scheduledIds: ['Gym'], completedIds: [], skippedIds: ['Gym'], completed: false }], []);
    expect(week.slice(0, 3).map(d => d.state)).toEqual(['rest', 'rest', 'rest']);
  });
});
