// src/utils/bonbonApi.ts
//
// One request to Bonbon (the gemini-proxy edge function): a system prompt, recent history
// and a message in, the reply text out. Each request counts toward the user's daily limit.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@env';
import { getAccessToken, invalidateAccessToken } from './supabaseAuth';
import { syncRevenueCatUser } from './revenueCatIdentity';

export type BonbonTurn = { role: 'user' | 'model'; text: string };

/** Error codes from the gemini-proxy function: daily_limit, rate_limited, busy, … */
export class CoachError extends Error {
  constructor(public code: string) { super(code); }
}

export async function askBonbon({ system, history = [], message }: {
  system: string; history?: BonbonTurn[]; message: string;
}): Promise<string> {
  // Must stay within the server's limits (see supabase/functions/gemini-proxy).
  const body = JSON.stringify({
    system:  system.slice(0, 8000),
    history: history.map(h => ({ role: h.role, text: h.text.slice(0, 2000) })),
    message: message.slice(0, 1000),
  });

  const post = async () => fetch(`${SUPABASE_URL}/functions/v1/gemini-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${await getAccessToken()}`,
    },
    body,
  });

  // The server checks Pro for the session's user, so RevenueCat must be on that user too.
  // Done for free users as well: the server's RevenueCat lookup creates the customer if it
  // doesn't exist, which would stop a later login from carrying purchases over.
  await syncRevenueCatUser().catch(() => null);

  let res = await post();
  if (res.status === 401) {
    // Rejected token: refresh it (same user) and try once more.
    invalidateAccessToken();
    await syncRevenueCatUser().catch(() => null);
    res = await post();
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new CoachError(data.error ?? `http_${res.status}`);
  return data.text ?? '';
}
