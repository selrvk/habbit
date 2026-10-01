// src/helpers.ts

import type { AvatarKey, Commission, DailyTotal, ChartDay, CompletionRecord, ReminderTime } from './types';
import { AVATARIMAGES, DAY_LABELS, CAL_DAY_LABELS } from './constants';

export const avatarImage = (key: string) =>
  AVATARIMAGES[key as AvatarKey] ?? AVATARIMAGES.avatar_bunny;

/** Local-time 'YYYY-MM-DD' key. */
export const toDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const parseDateKey = (key: string) => new Date(key + 'T00:00:00');
export const addDaysToKey = (key: string, n: number) => {
  const d = parseDateKey(key); d.setDate(d.getDate()+n);
  return toDateKey(d);
};
export const getTodayKey = () => toDateKey(new Date());
export const getYesterdayKey = () => addDaysToKey(getTodayKey(), -1);
export const getFormattedDate = () => {
  const d = new Date();
  const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return { dayName: days[d.getDay()], month: months[d.getMonth()], date: d.getDate(), year: d.getFullYear(), dow: d.getDay() };
};
export const formatTime = () => {
  const d = new Date(); const h = d.getHours(); const m = d.getMinutes();
  return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;
};
export const formatTime12 = (hour: number, minute: number) => {
  const h = hour===0?12:hour>12?hour-12:hour;
  return `${h}:${String(minute).padStart(2,'0')} ${hour<12?'AM':'PM'}`;
};
export const generateId = () => Date.now().toString()+Math.random().toString(36).slice(2,6);
export const applyNumpadKey = (current: string, key: string): string => {
  if (key==='⌫') return current.slice(0,-1);
  if (key==='.') { if (current.includes('.')) return current; return (current===''?'0':current)+'.'; }
  if (current.includes('.')) { const dec=current.split('.')[1]; if (dec&&dec.length>=2) return current; }
  if (current==='0'&&key!=='.') return key;
  return current+key;
};
export const getLast7Days = (dailyTotals: DailyTotal[], spentToday: number): ChartDay[] => {
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return Array.from({length:7},(_,i)=>{
    const d=new Date(); d.setDate(d.getDate()-(6-i));
    const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return {date:key,dayName:dayNames[d.getDay()],total:i===6?spentToday:(dailyTotals.find(t=>t.date===key)?.total??0),isToday:i===6};
  });
};
/** Fixed-day habits on that weekday. "N× a week" habits are never scheduled on a day. */
export const isScheduledForDay = (c: Commission, dow: number) =>
  c.perWeek ? false : !c.days||c.days.length===0?true:c.days.includes(dow);
/** Scheduled today and not skipped: the habits today's progress and streak are judged on. */
export const countsToday = (c: Commission, dow: number) => isScheduledForDay(c, dow) && !c.skipped;
/** Every habit scheduled that day was skipped. */
export const allSkipped = (r: CompletionRecord) =>
  r.scheduledIds.length > 0 && r.scheduledIds.every(id => r.skippedIds?.includes(id));
/** A rest day: nothing was scheduled (only weekly habits, if anything) or all of it skipped. */
export const isRestRecord = (r: CompletionRecord) =>
  r.scheduledIds.every(id => r.skippedIds?.includes(id));
/** "Every day", "Weekdays", "M W F", or "3× a week". */
export const scheduleLabel = (c: Commission) => (c.perWeek ? `${c.perWeek}× a week` : daysLabel(c.days ?? []));
/** Short reminder description, e.g. "8:00 PM", "6:00 AM – 8:00 PM", "3 times". */
export const reminderSummary = (c: Commission): string | null => {
  if ((c.timesPerDay ?? 1) === 1) return c.reminderTime ? formatTime12(c.reminderTime.hour, c.reminderTime.minute) : null;
  if (c.reminderSplit) {
    const r = c.reminderSplit;
    return `${formatTime12(r.startHour, r.startMinute)} – ${formatTime12(r.endHour, r.endMinute)}`;
  }
  return c.reminderTimes?.length ? `${c.reminderTimes.length} times` : null;
};

export const daysLabel = (days: number[]): string => {
  if (!days||days.length===0) return 'Every day';
  if (days.length===7) return 'Every day';
  if (JSON.stringify([...days].sort())===JSON.stringify([1,2,3,4,5])) return 'Weekdays';
  if (JSON.stringify([...days].sort())===JSON.stringify([0,6])) return 'Weekends';
  return days.map(d=>DAY_LABELS[d]).join(' ');
};
export const buildCalendarGrid = (records: CompletionRecord[], todayKey: string, weeks=6) => {
  const today=new Date();
  const sunday=new Date(today); sunday.setDate(today.getDate()-today.getDay());
  type CellState='done'|'missed'|'skipped'|'today'|'future'|'empty';
  const recordMap=new Map<string,CellState>(records.map(r=>[r.date,r.completed?'done':allSkipped(r)?'skipped':isRestRecord(r)?'empty':'missed']));
  const cols: {date:string;state:CellState}[][]=[];
  for (let w=-(weeks-1);w<=0;w++) {
    const col: {date:string;state:CellState}[]=[];
    for (let dow=0;dow<7;dow++) {
      const d=new Date(sunday); d.setDate(sunday.getDate()+w*7+dow);
      const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (d>today)               col.push({date:key,state:'future'});
      else if (key===todayKey)   col.push({date:key,state:'today'});
      else if (recordMap.has(key)) col.push({date:key,state:recordMap.get(key)!});
      else                         col.push({date:key,state:'empty'});
    }
    cols.push(col);
  }
  return cols;
};

/** Migrate stored commissions to the latest shape, filling in any missing fields. */
export const migrateCommissions = (items: any[]): Commission[] =>
  items.map(c => ({
    ...c,
    days:            c.days            ?? [],
    reminderTime:    c.reminderTime    ?? null,
    timesPerDay:     c.timesPerDay     ?? 1,
    completionCount: c.completionCount ?? 0,
    reminderTimes:   c.reminderTimes   ?? [],
    reminderSplit:   c.reminderSplit   ?? null,
  }));

/**
 * Distribute `count` reminder times evenly between a start and end time.
 * Returns an array of { hour, minute } objects.
 */
export const computeSplitTimes = (
  startH: number, startM: number,
  endH: number,   endM: number,
  count: number,
): ReminderTime[] => {
  if (count <= 0) return [];
  if (count === 1) return [{ hour: startH, minute: startM }];
  const startMins = startH * 60 + startM;
  const endMins   = endH   * 60 + endM;
  if (endMins <= startMins) return [{ hour: startH, minute: startM }];
  const step = (endMins - startMins) / (count - 1);
  return Array.from({ length: count }, (_, i) => {
    // Round to 5 minutes so reminders land on friendly times (9:45, not 9:43)
    const total = Math.min(Math.round((startMins + step * i) / 5) * 5, endMins);
    return { hour: Math.floor(total / 60) % 24, minute: total % 60 };
  });
};

export const defaultStats = () => ({currentStreak:0,bestStreak:0,totalCompleted:0,lastFullDate:''});

export const currencyStr = (currency: string, amount: string) =>
  currency === '__carrot__' ? `🥕 ${amount}` : `${currency}${amount}`;

export const getLast7DayKeys = (): string[] =>
  Array.from({ length: 7 }, (_, i) => addDaysToKey(getTodayKey(), i - 6));

export const getDayName = (dateKey: string): string => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[new Date(dateKey + 'T00:00:00').getDay()];
};