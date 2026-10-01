// src/links.ts
//
// habbit:// links, opened by quick actions, Shortcuts and (later) widgets. A link only opens
// a screen, at most with an expense filled in for the user to confirm, so a link from a
// website or another app can't change anything. Saving from outside the app goes through
// Siri and Shortcuts instead (see inbox.ts).
//
//   habbit://home                     habbit://habits/new
//   habbit://habits                   habbit://habits/<id>
//   habbit://finance                  habbit://spend?amount=150&category=food&note=Lunch
//   habbit://add-money                habbit://recap
//   habbit://coach                    habbit://profile

import { categoryOf, type CategoryKey } from './categories';

type PlainScreen = 'home' | 'habits' | 'new-habit' | 'finance' | 'add-money' | 'recap' | 'coach' | 'profile';

export type LinkTarget =
  | { screen: PlainScreen }
  | { screen: 'habit'; id: string }
  | { screen: 'spend'; amount?: string; category?: CategoryKey; note?: string };

const decode = (s: string) => {
  try { return decodeURIComponent(s.replace(/\+/g, ' ')); } catch { return ''; }
};

const queryParams = (query: string): Record<string, string> =>
  Object.fromEntries(query.split('&').filter(Boolean).map(pair => {
    const [k, ...v] = pair.split('=');
    return [decode(k).toLowerCase(), decode(v.join('='))];
  }));

/** An amount for the numpad: positive, at most 2 decimals, as the numpad would type it. */
const numpadAmount = (raw: string | undefined): string | undefined => {
  const n = Number(raw);
  if (!raw || !Number.isFinite(n) || n <= 0 || n >= 100_000_000) return undefined;
  return String(Math.round(n * 100) / 100);
};

const PLAIN = new Map<string, PlainScreen>([
  ['', 'home'], ['home', 'home'], ['today', 'home'],
  ['habits', 'habits'], ['habbits', 'habits'],
  ['finance', 'finance'], ['money', 'finance'], ['budget', 'finance'],
  ['add-money', 'add-money'], ['recap', 'recap'],
  ['coach', 'coach'], ['bonbon', 'coach'], ['chat', 'coach'],
  ['profile', 'profile'],
]);

export const parseLink = (url: string): LinkTarget | null => {
  const m = /^habbit:\/\/([^?#]*)(?:\?([^#]*))?/i.exec(url.trim());
  if (!m) return null;
  const [first = '', second] = m[1].split('/').filter(Boolean).map(p => decode(p));
  const params = queryParams(m[2] ?? '');
  const head = first.toLowerCase();

  if ((head === 'habits' || head === 'habbits') && second) {
    return second.toLowerCase() === 'new' ? { screen: 'new-habit' } : { screen: 'habit', id: second };
  }
  if (head === 'spend' || head === 'expense') {
    const amount   = numpadAmount(params.amount);
    const category = categoryOf(params.category?.toLowerCase())?.key;
    const note     = params.note?.trim().slice(0, 60);
    return { screen: 'spend', ...(amount ? { amount } : {}), ...(category ? { category } : {}), ...(note ? { note } : {}) };
  }
  const screen = PLAIN.get(head);
  return screen ? { screen } : null;
};
