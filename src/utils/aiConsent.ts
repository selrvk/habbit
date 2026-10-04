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
import { STORAGE_AI_CONSENT } from '../storage';

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
