// src/helpers.ts

import type { AvatarKey, Commission, DailyTotal, ChartDay, CompletionRecord } from './types';
import { AVATARIMAGES, DAY_LABELS, CAL_DAY_LABELS } from './constants';

export const avatarImage = (key: string) =>
  AVATARIMAGES[key as AvatarKey] ?? AVATARIMAGES.avatar_bunny;

export const getTodayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
export const getYesterdayKey = () => {
  const d = new Date(); d.setDate(d.getDate()-1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
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
export const isScheduledForDay = (c: Commission, dow: number) =>
  !c.days||c.days.length===0?true:c.days.includes(dow);
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
  const recordMap=new Map(records.map(r=>[r.date,r.completed]));
  const cols: {date:string;state:'done'|'missed'|'today'|'future'|'empty'}[][]=[];
  for (let w=-(weeks-1);w<=0;w++) {
    const col: {date:string;state:'done'|'missed'|'today'|'future'|'empty'}[]=[];
    for (let dow=0;dow<7;dow++) {
      const d=new Date(sunday); d.setDate(sunday.getDate()+w*7+dow);
      const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (d>today)               col.push({date:key,state:'future'});
      else if (key===todayKey)   col.push({date:key,state:'today'});
      else if (recordMap.has(key)) col.push({date:key,state:recordMap.get(key)?'done':'missed'});
      else                         col.push({date:key,state:'empty'});
    }
    cols.push(col);
  }
  return cols;
};
export const migrateCommissions = (items: any[]): Commission[] =>
  items.map(c=>({...c,days:c.days??[],reminderTime:c.reminderTime??null}));
export const defaultStats = () => ({currentStreak:0,bestStreak:0,totalCompleted:0,lastFullDate:''});