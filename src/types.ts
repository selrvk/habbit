// src/types.ts

export type ReminderTime    = { hour: number; minute: number };
export type EveningReminder = { enabled: boolean; hour: number; minute: number };
export type ReminderSplit   = { startHour: number; startMinute: number; endHour: number; endMinute: number };

export type Commission      = {
  id: string;
  label: string;
  completed: boolean;
  /** Skipped for today: counts neither for nor against any streak. Cleared at midnight. */
  skipped?: boolean;
  /** Fixed days (0 = Sunday); empty means every day. Unused when `perWeek` is set. */
  days: number[];
  /**
   * "N× a week" habits: done on any days, at most once a day, until N times in the week
   * (Monday to Sunday). They're never scheduled on a particular day, so they can't be
   * missed on a day and don't count toward the daily "perfect day" streak.
   */
  perWeek?: number;
  // Single reminder (timesPerDay === 1)
  reminderTime: ReminderTime | null;
  // Multi-times fields
  timesPerDay: number;                  // default 1
  completionCount: number;             // current swipe count; resets to 0 at midnight
  reminderTimes: ReminderTime[];       // manual multi-reminder list
  reminderSplit: ReminderSplit | null; // "split evenly between X and Y" config
  /** Focus timer: each block of this many minutes counts as one check-off (focus.ts). */
  focus?: { minutes: number; breakMinutes: number };
};

/** Shape produced by AddHabbitScreen and consumed by App handlers */
export type HabbitFormData  = {
  label: string;
  days: number[];
  perWeek: number | null;
  timesPerDay: number;
  reminderTime: ReminderTime | null;
  reminderTimes: ReminderTime[];
  reminderSplit: ReminderSplit | null;
  focus: { minutes: number; breakMinutes: number } | null;
};


export type CommissionsData = { items: Commission[]; date: string };
export type SpendingEntry   = {
  id: string; amount: number; time: string; note?: string;
  /** A CategoryKey (see categories.ts); missing on entries logged before categories. */
  category?: string;
  /** Logged automatically for a recurring bill (see bills.ts). */
  billId?: string;
};
export type FinanceData     = { spentToday: number; date: string; history: SpendingEntry[] };
export type DailyTotal      = { date: string; total: number; entries?: SpendingEntry[] };
export type Settings        = {
  /** Legacy daily budget. Still read as the fallback when budgetAmount is missing. */
  allocatedPerDay: number;
  budgetPeriod?: 'daily' | 'weekly' | 'monthly';
  budgetAmount?: number;
  currency: string; name: string; avatar: string;
  /** Legacy: the old midnight "new day" notification. Migrated to eveningReminder. */
  midnightNotifEnabled: boolean;
  eveningReminder?: EveningReminder;
  /** The Sunday recap notification. Missing means on. */
  weeklyRecap?: boolean;
};
export type Stats           = {
  currentStreak: number; bestStreak: number; totalCompleted: number; lastFullDate: string;
  /** Values from before today's streak credit, so un-completing a habit can revert it. */
  beforeToday?: { currentStreak: number; bestStreak: number; lastFullDate: string };
};

export type ChartDay        = { date: string; dayName: string; total: number; isToday: boolean };
export type HabitChartDay = { 
  date: string; 
  dayName: string; 
  isToday: boolean; 
  completed: number;   
  scheduled: number;   
  completedIds: string[];
  scheduledIds?: string[];
  skippedIds?: string[];
};

export type TabKey          = 'home' | 'tasks' | 'finance' | 'profile' | 'settings' | 'chat';
export type CompletionRecord = {
  date: string;
  /** Every scheduled habit that wasn't skipped was done (and at least one was). */
  completed: boolean;
  /** Habits done that day: scheduled ones, plus any "N× a week" ones. */
  completedIds: string[];
  scheduledIds: string[];
  /** Scheduled habits skipped that day. A day with all of them skipped is a rest day. */
  skippedIds?: string[];
};
export type OnboardingResult = { name: string; firstHabbit: string | null; budget: number; budgetPeriod: 'daily' | 'weekly' | 'monthly'; currency: string };
export type AvatarKey = 'avatar_bunny' | 'avatar_hamster' | 'avatar_bear' | 'avatar_panda' | 'avatar_fox';