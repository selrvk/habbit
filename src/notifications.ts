// src/notifications.ts

import { Platform } from 'react-native';
import { computeSplitTimes } from './helpers';
import notifee, { TriggerType, RepeatFrequency, AndroidImportance } from '@notifee/react-native';
import type { Commission } from './types';
import { daysLabel } from './helpers';

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

export const scheduleHabitNotifs = async (commission: Commission) => {
  await cancelHabitNotifs(commission.id);
  if (!commission.reminderTime && !commission.reminderTimes?.length) return;

  const scheduledDays = commission.days.length === 0
    ? [0,1,2,3,4,5,6] : commission.days;

  // Build the list of {hour, minute} to fire each day
  let times: { hour: number; minute: number }[] = [];

  if ((commission.timesPerDay ?? 1) === 1) {
    times = [commission.reminderTime!];
    } else if (commission.reminderSplit === null) {
      times = commission.reminderTimes ?? [];
    } else {
    // split evenly — compute from the window stored in reminderTimes[0] and reminderTimes[last]
    const [from, to] = [commission.reminderTimes![0], commission.reminderTimes!.at(-1)!];
    times = computeSplitTimes(from.hour, from.minute, to.hour, to.minute, commission.timesPerDay!);
  }

  for (const [ti, t] of times.entries()) {
    for (const dow of scheduledDays) {
      await notifee.createTriggerNotification(
        {
          id: `hr-${commission.id}-${dow}-${ti}`,
          title: 'Habbit 🐰',
          body: commission.label,
          android: { channelId: NOTIF_CHANNEL, pressAction: { id: 'default' } },
          ios: { sound: 'default' },
        },
        {
          type: TriggerType.TIMESTAMP,
          timestamp: getNextWeeklyTimestamp(dow, t.hour, t.minute),
          repeatFrequency: RepeatFrequency.WEEKLY,
        }
      );
    }
  }
};

export const cancelHabitNotifs = async (commissionId: string) => {
  const ids = [0,1,2,3,4,5,6].flatMap(d =>
    Array.from({ length: 10 }, (_, ti) => `hr-${commissionId}-${d}-${ti}`)
  );
  const legacyIds = [0,1,2,3,4,5,6].map(d => `hr-${commissionId}-${d}`);
  await Promise.all([...ids, ...legacyIds].map(id => notifee.cancelNotification(id)));
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

export const cancelAllNotifications = async () => {
  try { 
    await notifee.cancelAllNotifications();
    await notifee.cancelDisplayedNotifications();
   } catch {}
};