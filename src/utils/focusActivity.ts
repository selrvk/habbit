// src/utils/focusActivity.ts
//
// The focus timer's Live Activity (ios/FocusActivity.swift): its countdown on the Lock Screen
// and in the Dynamic Island, kept in step with the app's timer.

import { TurboModuleRegistry, type TurboModule } from 'react-native';
import type { FocusSession } from '../focus';

interface FocusActivityModule extends TurboModule {
  sync(json: string): void;
}

const Native = TurboModuleRegistry.get<FocusActivityModule>('FocusActivity');

/**
 * Shows the running session, or ends the activity when there's none. `done` ends it showing
 * the day's last block as done, for a while, rather than straight away.
 */
export const syncFocusActivity = (session: FocusSession | null, done = false) => {
  try { Native?.sync(session ? JSON.stringify({ session, done }) : ''); } catch {}
};
