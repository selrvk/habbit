// src/utils/supabaseAuth.ts
//
// Anonymous Supabase session for this install, so the coach backend can count messages
// per user. Talks to the Supabase Auth REST API directly (no supabase-js dependency).
// Requires "Anonymous sign-ins" to be enabled in the Supabase project.
//
// The session lives in the Keychain, which on iOS survives deleting the app: a reinstall
// keeps the same user id, so the daily message count and the RevenueCat customer (Pro)
// carry over. AsyncStorage is only a fallback if the Keychain is unavailable.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@env';

// Provided by Hermes (RN 0.74+) but missing from React Native's type definitions.
declare function atob(data: string): string;

// Deliberately not part of "Delete All Data": wiping it would reset the daily message count.
const KEYCHAIN_SERVICE = 'com.selrvk.habbit.coach-session';
const LEGACY_STORAGE_SESSION = '@habbit_rabbit_coach_session';

type Session = { access_token: string; refresh_token: string; expires_at: number };

// ── Storage ─────────────────────────────────────────────────────────────────

const loadSession = async (): Promise<Session | null> => {
  try {
    const item = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
    if (item) return JSON.parse(item.password);
  } catch {}
  // Older builds kept the session in AsyncStorage; saveSession moves it to the Keychain.
  const raw = await AsyncStorage.getItem(LEGACY_STORAGE_SESSION).catch(() => null);
  return raw ? JSON.parse(raw) : null;
};

const saveSession = async (session: Session) => {
  try {
    await Keychain.setGenericPassword('session', JSON.stringify(session), {
      service: KEYCHAIN_SERVICE,
      // Readable whenever the phone has been unlocked once since boot (e.g. background work).
      accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK,
    });
    await AsyncStorage.removeItem(LEGACY_STORAGE_SESSION).catch(() => {});
  } catch {
    await AsyncStorage.setItem(LEGACY_STORAGE_SESSION, JSON.stringify(session)).catch(() => {});
  }
};

// ── Auth API ────────────────────────────────────────────────────────────────

const authFetch = async (path: string, body: object): Promise<Session> => {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error(`auth ${res.status}: ${data.error_code ?? data.msg ?? ''}`);
  return {
    access_token:  data.access_token,
    refresh_token: data.refresh_token,
    expires_at:    data.expires_at ?? Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
  };
};

const signInAnonymously = () => authFetch('signup', { data: {} });
const refresh = (refreshToken: string) => authFetch('token?grant_type=refresh_token', { refresh_token: refreshToken });

// ── Public API ──────────────────────────────────────────────────────────────

let inFlight: Promise<string> | null = null;
let forceRefresh = false;

/** A valid access token for this install, signing in or refreshing as needed. */
export const getAccessToken = (): Promise<string> => {
  if (!inFlight) {
    inFlight = (async () => {
      let session = await loadSession();

      const now = Math.floor(Date.now() / 1000);
      if (session && (forceRefresh || session.expires_at - 60 <= now)) {
        forceRefresh = false;
        // Only if the refresh token itself is dead do we start over as a new user.
        session = await refresh(session.refresh_token).catch(() => null);
      }
      if (!session) session = await signInAnonymously();

      await saveSession(session);
      return session.access_token;
    })().finally(() => { inFlight = null; });
  }
  return inFlight;
};

/** This install's Supabase user id (the `sub` claim of the access token). */
export const getUserId = async (): Promise<string> => {
  const token = await getAccessToken();
  const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(payload)).sub;
};

/**
 * The server rejected the current token: refresh it on the next getAccessToken() call.
 * Keeps the same user (and their Pro / message count) unless the refresh token is dead.
 */
export const invalidateAccessToken = () => { forceRefresh = true; };
