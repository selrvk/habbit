// src/utils/habbitInbox.ts
//
// The queue of things Siri, Shortcuts and quick actions did, and a link left by an intent
// that opened the app (ios/HabbitInbox.m).

import { NativeEventEmitter, TurboModuleRegistry, type TurboModule } from 'react-native';
import { parseInbox, type InboxEvent } from '../inbox';

interface HabbitInboxModule extends TurboModule {
  take(): Promise<string | null>;
  takeLink(): Promise<string | null>;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

const Native = TurboModuleRegistry.get<HabbitInboxModule>('HabbitInbox');

/** Everything queued, emptying the queue. */
export const takeInbox = async (): Promise<InboxEvent[]> => {
  if (!Native) return [];
  try { return parseInbox(await Native.take()); } catch { return []; }
};

/** A habbit:// link to open ("Open Habbit" in Shortcuts), or null. */
export const takeLink = async (): Promise<string | null> => {
  if (!Native) return null;
  try { return await Native.takeLink(); } catch { return null; }
};

/** Called when something is queued, or a link left, while the app is running. */
export const onInboxChanged = (listener: () => void): (() => void) => {
  if (!Native) return () => {};
  const sub = new NativeEventEmitter(Native).addListener('changed', listener);
  return () => sub.remove();
};
