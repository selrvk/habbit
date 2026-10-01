// src/notifications.ts

import { Platform } from 'react-native';
import { addDaysToKey, computeSplitTimes, currencyStr, getTodayKey, isScheduledForDay, parseDateKey } from './helpers';
import { nextDueDate, type Bill } from './bills';
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

// Habit reminders repeat daily (or weekly on chosen days). On iOS a repeating reminder
// can't start "tomorrow": it matches only the time of day, so it would still fire today.
// So once a habit is done or skipped for the day, its repeating reminders are swapped for
// one-off reminders on the next few days, and the next time the app opens on a new day
// (see App's quiet-reminder effect and load) the repeating ones are restored.

const habitNotification = (c: Commission) => ({
  title: 'Habbit 🐰',
  body: c.label,
  android: { channelId: NOTIF_CHANNEL, pressAction: { id: 'default' } },
  ios: { sound: 'default' },
});

/**
 * How long a habit's reminders stay quiet: `today` once it's done or skipped today,
 * `week` once an "N× a week" habit has reached N (until Monday).
 */
export type Quiet = 'today' | 'week';

const quietFromState = (c: Commission): Quiet | null => (c.completed || c.skipped ? 'today' : null);

/** Days from today until next Monday (1–7). */
const daysToNextWeek = () => ((8 - new Date().getDay()) % 7) || 7;

/**
 * How many days of one-off reminders to plan while a habit is quiet. Fewer for habits with
 * many reminders a day: iOS keeps only the 64 soonest notifications.
 */
const quietDays = (timesPerDay: number) => Math.max(2, Math.min(7, Math.floor(14 / timesPerDay)));

/**
 * (Re)plans one habit's reminders. Call it whenever a habit is added, edited, completed,
 * skipped or un-done. `quiet` defaults to what the habit's own state says; App passes
 * `week` for weekly habits that have reached their goal (that needs their history).
 */
export const scheduleHabitNotifs = async (commission: Commission, quiet: Quiet | null = quietFromState(commission)) => {
  try {
    await cancelHabitNotifs(commission.id);
    const times = reminderTimesFor(commission).slice(0, MAX_TIMES_PER_DAY);
    if (times.length === 0) return;
    const notification = habitNotification(commission);

    if (quiet) {
      const first = quiet === 'week' ? daysToNextWeek() : 1;
      for (let d = first; d < first + quietDays(times.length); d++) {
        const day = new Date(); day.setDate(day.getDate() + d);
        if (commission.days.length > 0 && !commission.days.includes(day.getDay())) continue;
        for (const [ti, t] of times.entries()) {
          const at = new Date(day); at.setHours(t.hour, t.minute, 0, 0);
          await notifee.createTriggerNotification(
            { ...notification, id: `hr-${commission.id}-later-${d}-${ti}` },
            { type: TriggerType.TIMESTAMP, timestamp: at.getTime() },
          );
        }
      }
      return;
    }

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

/** Cancels every pending reminder for a habit: repeating, one-off and legacy ids. */
export const cancelHabitNotifs = async (commissionId: string) => {
  try {
    const prefix = `hr-${commissionId}-`;
    const ids = (await notifee.getTriggerNotificationIds()).filter(id => id.startsWith(prefix));
    if (ids.length > 0) await notifee.cancelTriggerNotifications(ids);
  } catch {}
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
      const scheduled = commissions.filter(c => isScheduledForDay(c, dow));
      if (scheduled.length === 0) continue;

      let body = "Evening check-in — how did your Habbits go today? 🐰";
      if (i === 0) {
        const left = scheduled.filter(c => !c.completed && !c.skipped).length;
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

// ── Bills ────────────────────────────────────────────────────────────────────
// One-off reminders at 9 AM on each bill's next two due dates, re-planned whenever the
// app loads or a bill changes (iOS can't repeat monthly).

const BILL_REMINDER_HOUR = 9;

export const scheduleBillReminders = async (bills: Bill[], currency: string) => {
  try {
    const old = (await notifee.getTriggerNotificationIds()).filter(id => id.startsWith('bill-'));
    if (old.length > 0) await notifee.cancelTriggerNotifications(old);

    for (const bill of bills) {
      if (!bill.remind) continue;
      let from = getTodayKey();
      for (let n = 0; n < 2; ) {
        const due = nextDueDate(bill, from);
        if (!due) break;
        from = addDaysToKey(due, 1);
        const at = parseDateKey(due); at.setHours(BILL_REMINDER_HOUR, 0, 0, 0);
        if (at.getTime() <= Date.now()) continue;
        const amount = currencyStr(currency, bill.amount.toLocaleString('en-US', { maximumFractionDigits: 2 }));
        await notifee.createTriggerNotification(
          {
            id: `bill-${bill.id}-${n}`, title: 'Habbit 🧾', body: `${bill.name} (${amount}) is due today. Habbit logs it for you.`,
            android: { channelId: NOTIF_CHANNEL, pressAction: { id: 'default' } }, ios: { sound: 'default' },
          },
          { type: TriggerType.TIMESTAMP, timestamp: at.getTime() },
        );
        n++;
      }
    }
  } catch {}
};

export const cancelAllNotifications = async () => {
  try { 
    await notifee.cancelAllNotifications();
    await notifee.cancelDisplayedNotifications();
   } catch {}
};