// src/types.ts

export type ReminderTime    = { hour: number; minute: number };
export type ReminderSplit   = { startHour: number; startMinute: number; endHour: number; endMinute: number };

export type Commission      = {
  id: string;
  label: string;
  completed: boolean;
  days: number[];
  // Single reminder (timesPerDay === 1)
  reminderTime: ReminderTime | null;
  // Multi-times fields
  timesPerDay: number;                  // default 1
  completionCount: number;             // current swipe count; resets to 0 at midnight
  reminderTimes: ReminderTime[];       // manual multi-reminder list
  reminderSplit: ReminderSplit | null; // "split evenly between X and Y" config
};

/** Shape produced by AddHabbitScreen and consumed by App handlers */
export type HabbitFormData  = {
  label: string;
  days: number[];
  timesPerDay: number;
  reminderTime: ReminderTime | null;
  reminderTimes: ReminderTime[];
  reminderSplit: ReminderSplit | null;
};


export type CommissionsData = { items: Commission[]; date: string };
export type SpendingEntry   = { id: string; amount: number; time: string; note?: string };
export type FinanceData     = { spentToday: number; date: string; history: SpendingEntry[] };
export type DailyTotal      = { date: string; total: number; entries?: SpendingEntry[] };
export type Settings        = { allocatedPerDay: number; currency: string; name: string; avatar: string; midnightNotifEnabled: boolean };
export type Stats           = { currentStreak: number; bestStreak: number; totalCompleted: number; lastFullDate: string };

export type ChartDay        = { date: string; dayName: string; total: number; isToday: boolean };
export type HabitChartDay = { 
  date: string; 
  dayName: string; 
  isToday: boolean; 
  completed: number;   
  scheduled: number;   
  completedIds: string[];
};

export type TabKey          = 'home' | 'tasks' | 'finance' | 'profile' | 'settings' | 'chat';
export type CompletionRecord = { 
  date: string; 
  completed: boolean;
  completedIds: string[]; 
  scheduledIds: string[];  
};
export type OnboardingResult = { name: string; firstHabbit: string | null; budget: number; currency: string };
export type AvatarKey = 'avatar_bunny' | 'avatar_hamster' | 'avatar_bear' | 'avatar_panda' | 'avatar_fox';