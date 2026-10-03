import { TurboModuleRegistry, type TurboModule } from 'react-native';
import SharedGroupPreferences from 'react-native-shared-group-preferences';

const APP_GROUP = 'group.com.selrvk.habbit';
const DEBOUNCE_MS = 1500;

interface WidgetReloaderModule extends TurboModule {
  setData(data: object): void;
  reloadAll(): void;
  /** Whether the widgets may use the Pro looks. */
  setPro?(pro: boolean): void;
}

const WidgetReloader = TurboModuleRegistry.get<WidgetReloaderModule>('WidgetReloader');

/** A habit as Siri, Shortcuts and quick actions see it (ios/HabbitStore.swift). */
export type WidgetHabit = {
  id: string;
  label: string;
  days: number[];
  perWeek?: number;
  times: number;
  count: number;
  done: boolean;
  skipped: boolean;
  /** "N× a week" habits: times done this week, today included. */
  week: number;
};

/** A day of this week on the large widget. */
export type WidgetDay = { date: string; state: 'done' | 'missed' | 'rest' | 'today' | 'future'; spent: number };

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
  /** Local 'YYYY-MM-DD' the data belongs to, so the widget can tell when it's stale. */
  date: string;
  /** Habits scheduled on each weekday (0 = Sunday), for the widget's fresh-day view. */
  scheduledByDow: number[];
  habits: WidgetHabit[];
  budgetPeriod: 'daily' | 'weekly' | 'monthly';
  /** What's left of this week's or month's budget (today's, for daily budgets). */
  periodLeft: number;
  /** The coming days' allowance and period left, if nothing more is spent today. */
  upcoming: { date: string; allowance: number; periodLeft: number }[];
  /** This week, Monday to Sunday. */
  week: WidgetDay[];
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

/** Unlocks the Pro widget looks (Cream, Match iPhone), or locks them again. */
export const syncWidgetPro = (pro: boolean) => { WidgetReloader?.setPro?.(pro); };

export const flushWidgetData = () => {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  return flush();
};
