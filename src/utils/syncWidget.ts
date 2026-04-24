import { TurboModuleRegistry } from 'react-native';
import SharedGroupPreferences from 'react-native-shared-group-preferences';

const APP_GROUP = 'group.com.selrvk.habbit';
const DEBOUNCE_MS = 1500;

type WidgetReloaderModule = {
  setData(data: object): void;
  reloadAll(): void;
};

const WidgetReloader = TurboModuleRegistry.get<WidgetReloaderModule>('WidgetReloader');

export type WidgetData = {
  name: string;
  completedCount: number;
  totalCount: number;
  spentToday: number;
  allocatedPerDay: number;
  currency: string;
  streak: number;
  avatar: string;
  upcomingHabbit?: string;
};

let lastSerialized: string | null = null;
let pendingPayload: object | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

const flush = async () => {
  timer = null;
  const payload = pendingPayload;
  pendingPayload = null;
  if (!payload) return;

  const serialized = JSON.stringify(payload);
  if (serialized === lastSerialized) return;
  lastSerialized = serialized;

  if (WidgetReloader?.setData) {
    WidgetReloader.setData(payload);
    return;
  }

  // Fallback: write via SharedGroupPreferences then trigger reload separately
  try {
    await SharedGroupPreferences.setItem('widgetData', serialized, APP_GROUP);
    WidgetReloader?.reloadAll?.();
  } catch {}
};

export const syncWidgetData = (data: WidgetData) => {
  pendingPayload = { upcomingHabbit: '', ...data };
  if (timer) return;
  timer = setTimeout(flush, DEBOUNCE_MS);
};

export const flushWidgetData = () => {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  return flush();
};
