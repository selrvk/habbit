// src/storage.ts

import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_COMMISSIONS        = '@habbit_rabbit_commissions';
export const STORAGE_FINANCE            = '@habbit_rabbit_finance';
export const STORAGE_FINANCE_HISTORY    = '@habbit_rabbit_finance_history';
export const STORAGE_SETTINGS          = '@habbit_rabbit_settings';
export const STORAGE_STATS             = '@habbit_rabbit_stats';
export const STORAGE_ONBOARDED         = '@habbit_rabbit_onboarded';
export const STORAGE_COMPLETION_HISTORY = '@habbit_rabbit_completion_history';
export const STORAGE_COACH_MESSAGES     = '@habbit_rabbit_coach_messages';
export const STORAGE_NOTIF_VERSION      = '@habbit_rabbit_notif_version';
export const STORAGE_TOPUPS             = '@habbit_rabbit_budget_topups';
export const STORAGE_BILLS              = '@habbit_rabbit_bills';
export const STORAGE_SAVINGS            = '@habbit_rabbit_savings';
/** Achievements earned: { earned: { [id]: day } }. */
export const STORAGE_ACHIEVEMENTS       = '@habbit_rabbit_achievements';
/** Custom spending categories (CustomCategory[], categories.ts). */
export const STORAGE_CATEGORIES         = '@habbit_rabbit_categories';
/** The running focus timer (FocusSession, focus.ts). Not backed up. */
export const STORAGE_FOCUS              = '@habbit_rabbit_focus';
/** Minutes focused per day and habit (FocusLogEntry[]). */
export const STORAGE_FOCUS_LOG          = '@habbit_rabbit_focus_log';
/** The workout in progress (ActiveWorkout, workout.ts). Not backed up. */
export const STORAGE_WORKOUT            = '@habbit_rabbit_workout';
/** Finished workouts (WorkoutLog[]). */
export const STORAGE_WORKOUT_LOG        = '@habbit_rabbit_workout_log';
/** Bonbon's weekly notes, by week. Not backed up: they can be written again. */
export const STORAGE_WEEK_NOTES         = '@habbit_rabbit_week_notes';
/** Whether Bonbon may send things to Google's AI ('allowed' / 'under18' / 'no'; aiConsent.ts). Not backed up. */
export const STORAGE_AI_CONSENT         = '@habbit_rabbit_ai_consent';

// ── Used by "Delete All Data" — never include ONBOARDED or SETTINGS ──────────
export const CONTENT_STORAGE_KEYS = [
  STORAGE_COMMISSIONS,
  STORAGE_FINANCE,
  STORAGE_FINANCE_HISTORY,
  STORAGE_STATS,
  STORAGE_COMPLETION_HISTORY,
  STORAGE_COACH_MESSAGES,
  STORAGE_TOPUPS,
  STORAGE_BILLS,
  STORAGE_SAVINGS,
  STORAGE_WEEK_NOTES,
  STORAGE_ACHIEVEMENTS,
  STORAGE_CATEGORIES,
  STORAGE_FOCUS,
  STORAGE_FOCUS_LOG,
  STORAGE_WORKOUT,
  STORAGE_WORKOUT_LOG,
];

// ── Full wipe — only used if you ever need a true factory reset ───────────────
export const ALL_STORAGE_KEYS = [
  ...CONTENT_STORAGE_KEYS,
  STORAGE_SETTINGS,
  STORAGE_ONBOARDED,
  STORAGE_AI_CONSENT,
];