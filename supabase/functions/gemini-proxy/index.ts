// supabase/functions/gemini-proxy/index.ts
//
// Bonbon coach backend. The app sends a system prompt, recent history and the new
// message; this function builds the Gemini request itself (fixed model, capped sizes,
// capped output), enforces a per-user daily limit and a global daily cap, and returns
// only the reply text.
//
// Callers must be signed in (Supabase anonymous auth is enough). The anon key alone
// is rejected, because it has no user to count messages against.

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL');
const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';

// Server-side ceilings. The app enforces the smaller free limit itself; this is the
// hard stop no client can get around.
const PER_USER_DAILY_LIMIT = Number(Deno.env.get('COACH_PER_USER_DAILY_LIMIT') ?? 50);
const GLOBAL_DAILY_LIMIT   = Number(Deno.env.get('COACH_GLOBAL_DAILY_LIMIT') ?? 5000);
// Bucket for the global counter in the same table.
const GLOBAL_BUCKET = '00000000-0000-0000-0000-000000000000';

const MAX_SYSTEM_CHARS  = 8000;
const MAX_MESSAGE_CHARS = 1000;
const MAX_HISTORY_ITEMS = 12;
const MAX_HISTORY_CHARS = 2000;
const MAX_OUTPUT_TOKENS = 400;

type HistoryItem = { role: 'user' | 'model'; text: string };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** The gateway has already verified the JWT signature (verify_jwt = true); read its claims. */
const userIdFromRequest = (req: Request): string | null => {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    // The anon key is a valid JWT too, but it has no subject and role 'anon'.
    if (payload.role !== 'authenticated' || typeof payload.sub !== 'string') return null;
    return payload.sub;
  } catch {
    return null;
  }
};

const incrementUsage = async (userId: string, day: string): Promise<number> => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_coach_usage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY!,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ p_user: userId, p_day: day }),
  });
  if (!res.ok) throw new Error(`usage rpc ${res.status}`);
  return await res.json();
};

const isString = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;

const parseBody = (body: any): { system: string; history: HistoryItem[]; message: string } | null => {
  if (!body || !isString(body.system, MAX_SYSTEM_CHARS) || !isString(body.message, MAX_MESSAGE_CHARS)) return null;
  const rawHistory = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY_ITEMS) : [];
  const history: HistoryItem[] = [];
  for (const h of rawHistory) {
    if ((h?.role !== 'user' && h?.role !== 'model') || !isString(h?.text, MAX_HISTORY_CHARS)) return null;
    history.push({ role: h.role, text: h.text });
  }
  return { system: body.system, history, message: body.message };
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!GEMINI_API_KEY || !SUPABASE_URL || !SERVICE_KEY) return json({ error: 'server_misconfigured' }, 500);

  const userId = userIdFromRequest(req);
  if (!userId) return json({ error: 'unauthorized' }, 401);

  let input;
  try {
    input = parseBody(await req.json());
  } catch {
    input = null;
  }
  if (!input) return json({ error: 'bad_request' }, 400);

  // Count before calling Gemini so parallel requests can't slip past the limit.
  const day = new Date().toISOString().slice(0, 10); // UTC day
  try {
    const globalCount = await incrementUsage(GLOBAL_BUCKET, day);
    if (globalCount > GLOBAL_DAILY_LIMIT) return json({ error: 'busy' }, 503);
    const userCount = await incrementUsage(userId, day);
    if (userCount > PER_USER_DAILY_LIMIT) return json({ error: 'daily_limit' }, 429);
  } catch (e) {
    console.error('usage check failed', e);
    return json({ error: 'server_error' }, 500);
  }

  try {
    const geminiRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: input.system }] },
        contents: [
          ...input.history.map(h => ({ role: h.role, parts: [{ text: h.text }] })),
          { role: 'user', parts: [{ text: input.message }] },
        ],
        generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
      }),
    });

    if (!geminiRes.ok) {
      console.error('gemini error', geminiRes.status, await geminiRes.text());
      return json({ error: geminiRes.status === 429 ? 'rate_limited' : 'upstream_error' }, geminiRes.status === 429 ? 429 : 502);
    }

    const data = await geminiRes.json();
    const text: string = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
    return json({ text });
  } catch (e) {
    console.error('gemini request failed', e);
    return json({ error: 'upstream_error' }, 502);
  }
});
