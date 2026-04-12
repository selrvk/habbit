// src/types.ts

export type ReminderTime    = { hour: number; minute: number };
export type Commission      = { id: string; label: string; completed: boolean; days: number[]; reminderTime: ReminderTime | null };
export type CommissionsData = { items: Commission[]; date: string };
export type SpendingEntry   = { id: string; amount: number; time: string };
export type FinanceData     = { spentToday: number; date: string; history: SpendingEntry[] };
export type DailyTotal      = { date: string; total: number };
export type Settings        = { allocatedPerDay: number; currency: string; name: string; avatar: string; midnightNotifEnabled: boolean };
export type Stats           = { currentStreak: number; bestStreak: number; totalCompleted: number; lastFullDate: string };
export type ChartDay        = { date: string; dayName: string; total: number; isToday: boolean };
export type TabKey          = 'home' | 'tasks' | 'finance' | 'profile';
export type CompletionRecord = { date: string; completed: boolean };
export type OnboardingResult = { name: string; firstHabbit: string | null; budget: number; currency: string };
export type AvatarKey = 'avatar_bunny' | 'avatar_hamster' | 'avatar_bear' | 'avatar_panda' | 'avatar_fox';