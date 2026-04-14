// src/storage.ts

import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_COMMISSIONS        = '@habbit_rabbit_commissions';
export const STORAGE_FINANCE            = '@habbit_rabbit_finance';
export const STORAGE_FINANCE_HISTORY    = '@habbit_rabbit_finance_history';
export const STORAGE_SETTINGS          = '@habbit_rabbit_settings';
export const STORAGE_STATS             = '@habbit_rabbit_stats';
export const STORAGE_ONBOARDED         = '@habbit_rabbit_onboarded';
export const STORAGE_COMPLETION_HISTORY = '@habbit_rabbit_completion_history';
export const STORAGE_COACH_MESSAGES = '@habbit_rabbit_coach_messages';

export const ALL_STORAGE_KEYS = [
  STORAGE_COMMISSIONS, STORAGE_FINANCE, STORAGE_FINANCE_HISTORY,
  STORAGE_SETTINGS, STORAGE_STATS, STORAGE_ONBOARDED, STORAGE_COMPLETION_HISTORY,
  STORAGE_COACH_MESSAGES,
];