// src/utils/messageQuota.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_QUOTA_KEY = 'coach_message_quota';

export const MESSAGE_LIMITS = {
  free: 10,
  pro:  50,
} as const;

export const HISTORY_LIMITS = {
  free: 6,   // fewer context messages = fewer tokens
  pro:  12,
} as const;

interface QuotaData {
  date:  string;
  count: number;
}

const todayStr = () => new Date().toISOString().split('T')[0];

export async function getRemainingMessages(isPro: boolean): Promise<number> {
  const limit = isPro ? MESSAGE_LIMITS.pro : MESSAGE_LIMITS.free;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_QUOTA_KEY);
    if (!raw) return limit;
    const data: QuotaData = JSON.parse(raw);
    if (data.date !== todayStr()) return limit; // new day, full quota
    return Math.max(0, limit - data.count);
  } catch {
    return limit;
  }
}

export async function consumeMessage(): Promise<void> {
  const today = todayStr();
  try {
    const raw  = await AsyncStorage.getItem(STORAGE_QUOTA_KEY);
    const prev: QuotaData = raw ? JSON.parse(raw) : { date: today, count: 0 };
    const next: QuotaData = {
      date:  today,
      count: prev.date === today ? prev.count + 1 : 1,
    };
    await AsyncStorage.setItem(STORAGE_QUOTA_KEY, JSON.stringify(next));
  } catch {}
}