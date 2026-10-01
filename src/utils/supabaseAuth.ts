// src/utils/supabaseAuth.ts
//
// Anonymous Supabase session for this install, so the coach backend can count messages
// per user. Talks to the Supabase Auth REST API directly (no supabase-js dependency).
// Requires "Anonymous sign-ins" to be enabled in the Supabase project.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@env';

// Provided by Hermes (RN 0.74+) but missing from React Native's type definitions.
declare function atob(data: string): string;

// Deliberately not part of "Delete All Data": wiping it would reset the daily message count.
const STORAGE_SESSION = '@habbit_rabbit_coach_session';

type Session = { access_token: string; refresh_token: string; expires_at: number };

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

let inFlight: Promise<string> | null = null;

/** A valid access token for this install, signing in or refreshing as needed. */
export const getAccessToken = (): Promise<string> => {
  if (!inFlight) {
    inFlight = (async () => {
      const raw = await AsyncStorage.getItem(STORAGE_SESSION).catch(() => null);
      let session: Session | null = raw ? JSON.parse(raw) : null;

      const now = Math.floor(Date.now() / 1000);
      if (session && session.expires_at - 60 <= now) {
        // Refresh tokens can be revoked or expire; fall back to a new anonymous user.
        session = await refresh(session.refresh_token).catch(() => null);
      }
      if (!session) session = await signInAnonymously();

      await AsyncStorage.setItem(STORAGE_SESSION, JSON.stringify(session)).catch(() => {});
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

/** Drop the cached session (e.g. after the server rejects the token). */
export const clearSession = () => AsyncStorage.removeItem(STORAGE_SESSION).catch(() => {});
