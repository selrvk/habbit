// src/utils/keepAwake.ts

import { NativeModules } from 'react-native';

/**
 * Keeps the screen from dimming and locking, or lets it again (ios/WidgetReloader.m). For a
 * hold being timed in a workout: the timer has to stay readable from the floor.
 */
export const keepAwake = (on: boolean) => {
  try { NativeModules.WidgetReloader?.setKeepAwake?.(on); } catch {}
};
