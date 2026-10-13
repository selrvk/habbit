// src/utils/aiConsent.ts
//
// Whether Bonbon may send things to Google's Gemini AI. App Review (guideline 5.1.2(i)) asks
// for a clear yes before personal data goes to a third-party AI, and Google's Gemini API terms
// are for people 18 and older, so nothing reaches Bonbon's server until someone allows it and
// says they're 18 or older: in the chat, the Sunday recap or Settings, where it can be turned
// off again. Under 18, Bonbon stays off and the rest of the app works as usual. Kept on this
// phone only, so a new phone asks again.

import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_AI_CONSENT, STORAGE_RECEIPT_AI } from '../storage';

/** 'allowed' (18 or older and said yes), 'under18' (Bonbon stays off), or 'no' (not yet, or turned off). */
export type AiConsent = 'allowed' | 'under18' | 'no';

/** What Bonbon sends to Google, for the consent card and the Allow prompts. */
export const AI_SHARING_TEXT =
  'Bonbon’s replies are written by Google’s Gemini AI. To answer, he sends Google your ' +
  'message and a summary of your Habbits, spending (with notes), budget, bills, savings jars, ' +
  'focus time and workouts. Google doesn’t use it to train its AI.';

export const AI_AGE_TEXT = 'Bonbon is for people 18 and older.';

let cached: AiConsent | null = null;
const listeners = new Set<(consent: AiConsent) => void>();

const readConsent = async (): Promise<AiConsent> => {
  if (cached === null) {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_AI_CONSENT);
      cached = saved === 'allowed' || saved === 'under18' ? saved : 'no';
    } catch { cached = 'no'; }
  }
  return cached;
};

/** Whether Bonbon may send things to Google right now. */
export const getAiConsent = async (): Promise<boolean> => (await readConsent()) === 'allowed';

export const setAiConsent = async (consent: AiConsent): Promise<void> => {
  cached = consent;
  listeners.forEach(l => l(consent));
  await AsyncStorage.setItem(STORAGE_AI_CONSENT, consent).catch(() => {});
};

/** Asks with an alert; resolves true (and saves it) when they're 18 or older and allow it. */
export const askAiConsent = (): Promise<boolean> => new Promise(resolve => {
  Alert.alert('Let Bonbon use Google’s AI?', `${AI_SHARING_TEXT} ${AI_AGE_TEXT} You can turn this off anytime in Settings › Data & Privacy.`, [
    { text: 'Allow · I’m 18 or older', onPress: () => { setAiConsent('allowed').then(() => resolve(true)); } },
    { text: 'I’m under 18', onPress: () => { setAiConsent('under18').then(() => resolve(false)); } },
    { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
  ]);
});

/** The current answer (null while it loads), kept up to date wherever it changes. */
export const useAiConsent = (): AiConsent | null => {
  const [consent, setConsent] = useState<AiConsent | null>(cached);
  useEffect(() => {
    listeners.add(setConsent);
    readConsent().then(setConsent);
    return () => { listeners.delete(setConsent); };
  }, []);
  return consent;
};

// ── Receipts ─────────────────────────────────────────────────────────────────
// A scanned receipt's text is more than Bonbon was first allowed to send, so it has its own
// yes: asked the first time a receipt is scanned with Bonbon's AI on, and changed in
// Settings. Without it (or with Bonbon off) a receipt is read on the phone alone.

/** What's sent for a receipt, for the prompt and Settings. */
export const RECEIPT_SHARING_TEXT =
  'Your iPhone reads the receipt’s text by itself. Bonbon can then pick the shop and category ' +
  'by sending that text to Google’s Gemini AI, with long numbers like card and phone numbers ' +
  'blanked out. The photo never leaves your iPhone.';

/** null until it's been answered. */
let receiptAi: boolean | null | undefined;
const receiptListeners = new Set<(allowed: boolean | null) => void>();

const readReceiptAi = async (): Promise<boolean | null> => {
  if (receiptAi === undefined) {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_RECEIPT_AI);
      receiptAi = saved === 'allowed' ? true : saved === 'no' ? false : null;
    } catch { receiptAi = null; }
  }
  return receiptAi;
};

export const setReceiptAi = async (allowed: boolean): Promise<void> => {
  receiptAi = allowed;
  receiptListeners.forEach(l => l(allowed));
  await AsyncStorage.setItem(STORAGE_RECEIPT_AI, allowed ? 'allowed' : 'no').catch(() => {});
};

/**
 * Whether a receipt's text may go to Bonbon. Never without Bonbon's AI on. The first time,
 * it asks (`ask` false skips the question and answers no for now).
 */
export const receiptAiAllowed = async (ask = true): Promise<boolean> => {
  if (!(await getAiConsent())) return false;
  const saved = await readReceiptAi();
  if (saved !== null || !ask) return saved === true;
  return new Promise(resolve => {
    Alert.alert('Let Bonbon read your receipts?', `${RECEIPT_SHARING_TEXT} You can change this anytime in Settings › Data & Privacy.`, [
      { text: 'Let Bonbon help', onPress: () => { setReceiptAi(true).then(() => resolve(true)); } },
      { text: 'Keep it on my iPhone', style: 'cancel', onPress: () => { setReceiptAi(false).then(() => resolve(false)); } },
    ]);
  });
};

/** The answer so far (null: not asked, or still loading), kept up to date wherever it changes. */
export const useReceiptAi = (): boolean | null => {
  const [allowed, setAllowed] = useState<boolean | null>(receiptAi ?? null);
  useEffect(() => {
    receiptListeners.add(setAllowed);
    readReceiptAi().then(setAllowed);
    return () => { receiptListeners.delete(setAllowed); };
  }, []);
  return allowed;
};
