// src/notifications.ts

import { Platform } from 'react-native';
import { computeSplitTimes } from './helpers';
import notifee, { TriggerType, RepeatFrequency, AndroidImportance } from '@notifee/react-native';
import type { Commission, ReminderTime } from './types';

export const NOTIF_CHANNEL     = 'habbits';
export const MIDNIGHT_NOTIF_ID = 'hr-midnight';

export const initNotifications = async () => {
  try {
    if (Platform.OS==='android') {
      await notifee.createChannel({id:NOTIF_CHANNEL,name:'Habbit Reminders',importance:AndroidImportance.HIGH});
    }
    await notifee.requestPermission();
  } catch {}
};

const getNextWeeklyTimestamp = (dow:number,hour:number,minute:number):number => {
  const now=new Date(); const target=new Date();
  target.setHours(hour,minute,0,0);
  const currentDow=now.getDay();
  let daysUntil=(dow-currentDow+7)%7;
  if (daysUntil===0&&target.getTime()<=now.getTime()) daysUntil=7;
  target.setDate(target.getDate()+daysUntil);
  return target.getTime();
};

const getNextDailyTimestamp = (hour:number,minute:number):number => {
  const target=new Date(); target.setHours(hour,minute,0,0);
  if (target.getTime()<=Date.now()) target.setDate(target.getDate()+1);
  return target.getTime();
};

/** The times of day a habit should remind at. */
export const reminderTimesFor = (c: Commission): ReminderTime[] => {
  if ((c.timesPerDay ?? 1) === 1) return c.reminderTime ? [c.reminderTime] : [];
  if (c.reminderSplit) {
    const s = c.reminderSplit;
    return computeSplitTimes(s.startHour, s.startMinute, s.endHour, s.endMinute, c.timesPerDay);
  }
  return c.reminderTimes ?? [];
};

const MAX_TIMES_PER_DAY = 10; // matches the AddHabbitScreen stepper limit

export const scheduleHabitNotifs = async (commission: Commission) => {
  try {
    await cancelHabitNotifs(commission.id);
    const times = reminderTimesFor(commission).slice(0, MAX_TIMES_PER_DAY);
    if (times.length === 0) return;

    const notification = {
      title: 'Habbit 🐰',
      body: commission.label,
      android: { channelId: NOTIF_CHANNEL, pressAction: { id: 'default' } },
      ios: { sound: 'default' },
    };
    const everyDay = commission.days.length === 0 || commission.days.length === 7;

    for (const [ti, t] of times.entries()) {
      if (everyDay) {
        // One daily trigger instead of 7 weekly ones — iOS only keeps 64 pending notifications.
        await notifee.createTriggerNotification(
          { ...notification, id: `hr-${commission.id}-daily-${ti}` },
          { type: TriggerType.TIMESTAMP, timestamp: getNextDailyTimestamp(t.hour, t.minute), repeatFrequency: RepeatFrequency.DAILY },
        );
        continue;
      }
      for (const dow of commission.days) {
        await notifee.createTriggerNotification(
          { ...notification, id: `hr-${commission.id}-${dow}-${ti}` },
          { type: TriggerType.TIMESTAMP, timestamp: getNextWeeklyTimestamp(dow, t.hour, t.minute), repeatFrequency: RepeatFrequency.WEEKLY },
        );
      }
    }
  } catch {}
};

export const cancelHabitNotifs = async (commissionId: string) => {
  const slots = Array.from({ length: MAX_TIMES_PER_DAY }, (_, ti) => ti);
  const ids = [
    ...[0,1,2,3,4,5,6].flatMap(d => slots.map(ti => `hr-${commissionId}-${d}-${ti}`)),
    ...slots.map(ti => `hr-${commissionId}-daily-${ti}`),
    ...[0,1,2,3,4,5,6].map(d => `hr-${commissionId}-${d}`), // legacy
  ];
  await Promise.all(ids.map(id => notifee.cancelNotification(id).catch(() => {})));
};

export const scheduleMidnightNotif = async () => {
  try {
    const midnight=new Date(); midnight.setDate(midnight.getDate()+1); midnight.setHours(0,0,0,0);
    await notifee.createTriggerNotification(
      {id:MIDNIGHT_NOTIF_ID,title:'Habbit 🥕',body:'A fresh new day! Your Habbits are reset and ready.',
        android:{channelId:NOTIF_CHANNEL,pressAction:{id:'default'}},ios:{sound:'default'}},
      {type:TriggerType.TIMESTAMP,timestamp:midnight.getTime(),repeatFrequency:RepeatFrequency.DAILY}
    );
  } catch {}
};

export const cancelMidnightNotif = async () => {
  try { await notifee.cancelNotification(MIDNIGHT_NOTIF_ID); } catch {}
};

// ── Evening check-in ─────────────────────────────────────────────────────────
// One-shot notifications for the next 7 days, re-planned whenever habits change.
// Today's is skipped once everything is done, and days with nothing scheduled are skipped.

const EVENING_DAYS = 7;
const eveningId = (i: number) => `hr-evening-${i}`;

export const cancelEveningCheckins = async () => {
  await Promise.all(Array.from({ length: EVENING_DAYS }, (_, i) => notifee.cancelNotification(eveningId(i)).catch(() => {})));
};

export const scheduleEveningCheckins = async (
  time: { hour: number; minute: number },
  commissions: Commission[],
) => {
  try {
    await cancelEveningCheckins();
    const now = new Date();
    for (let i = 0; i < EVENING_DAYS; i++) {
      const at = new Date(now);
      at.setDate(now.getDate() + i);
      at.setHours(time.hour, time.minute, 0, 0);
      if (at.getTime() <= now.getTime()) continue;

      const dow       = at.getDay();
      const scheduled = commissions.filter(c => !c.days?.length || c.days.includes(dow));
      if (scheduled.length === 0) continue;

      let body = "Evening check-in — how did your Habbits go today? 🐰";
      if (i === 0) {
        const left = scheduled.filter(c => !c.completed).length;
        if (left === 0) continue;
        body = `${left} Habbit${left === 1 ? '' : 's'} left today — you've still got time 🐰`;
      }

      await notifee.createTriggerNotification(
        {
          id: eveningId(i), title: 'Habbit 🥕', body,
          android: { channelId: NOTIF_CHANNEL, pressAction: { id: 'default' } }, ios: { sound: 'default' },
        },
        { type: TriggerType.TIMESTAMP, timestamp: at.getTime() },
      );
    }
  } catch {}
};

export const cancelAllNotifications = async () => {
  try { 
    await notifee.cancelAllNotifications();
    await notifee.cancelDisplayedNotifications();
   } catch {}
};