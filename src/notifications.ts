// src/notifications.ts

import { Platform } from 'react-native';
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
  try {
    await cancelHabitNotifs(commission.id);
    if (!commission.reminderTime) return;
    const {hour,minute}=commission.reminderTime;
    const scheduledDays=commission.days.length===0?[0,1,2,3,4,5,6]:commission.days;
    for (const dow of scheduledDays) {
      await notifee.createTriggerNotification(
        {id:`hr-${commission.id}-${dow}`,title:'Habbit 🐰',body:commission.label,
          android:{channelId:NOTIF_CHANNEL,pressAction:{id:'default'}},ios:{sound:'default'}},
        {type:TriggerType.TIMESTAMP,timestamp:getNextWeeklyTimestamp(dow,hour,minute),repeatFrequency:RepeatFrequency.WEEKLY}
      );
    }
  } catch {}
};

export const cancelHabitNotifs = async (commissionId: string) => {
  try { await notifee.cancelNotifications([0,1,2,3,4,5,6].map(d=>`hr-${commissionId}-${d}`)); } catch {}
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