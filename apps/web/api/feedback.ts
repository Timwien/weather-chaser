// In-app feedback endpoint — the app's only guest-capable write.
// Inserts into the `feedback` table via the service_role key; the table has
// RLS enabled with NO policies (deny-all for anon/authenticated), so this
// route is the single write path. Validation + rate limit live here because
// RLS cannot express either for anonymous callers.

import { adminClient, authenticateRequest, json } from './stripe/_shared.js';

const MAX_BODY_BYTES = 10_240;
const MAX_MESSAGE_CHARS = 2000;

// Naive per-IP rate limit: 5 submissions / 10 min. Module-level state is
// per-serverless-instance only — a soft beta guard, not a hard boundary
// (documented risk; upgrade to Turnstile/KV if abused).
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (list.length >= RATE_MAX) return true;
  list.push(now);
  hits.set(ip, list);
  return false;
}

/** Whitelist-copy the client context — never store the raw client object. */
function sanitizeContext(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const src = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (typeof src.source === 'string') out.source = src.source.slice(0, 32);
  if (typeof src.mode === 'string') out.mode = src.mode.slice(0, 32);
  if (typeof src.locale === 'string') out.locale = src.locale.slice(0, 16);
  if (typeof src.viewport_w === 'number') out.viewport_w = src.viewport_w;
  if (typeof src.viewport_h === 'number') out.viewport_h = src.viewport_h;
  if (typeof src.is_mobile === 'boolean') out.is_mobile = src.is_mobile;
  return Object.keys(out).length > 0 ? out : null;
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return json({ error: 'method_not_allowed' }, 405);
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SUPABASE_URL) {
      return json({ error: 'not_configured' }, 503);
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    if (rateLimited(ip)) {
      return json({ error: 'rate_limited' }, 429);
    }

    const bodyText = await request.text();
    if (bodyText.length > MAX_BODY_BYTES) {
      return json({ error: 'payload_too_large' }, 413);
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(bodyText) as Record<string, unknown>;
    } catch {
      return json({ error: 'invalid_json' }, 400);
    }

    const rating = body.rating;
    if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return json({ error: 'invalid_rating' }, 400);
    }

    let message: string | null = null;
    if (typeof body.message === 'string') {
      const trimmed = body.message.trim();
      if (trimmed.length > MAX_MESSAGE_CHARS) {
        return json({ error: 'message_too_long' }, 400);
      }
      message = trimmed.length > 0 ? trimmed : null;
    }

    // Optional identity: signed-in clients attach a bearer token; guests don't.
    const user = await authenticateRequest(request);

    try {
      const { error } = await adminClient().from('feedback').insert({
        user_id: user?.id ?? null,
        rating,
        message,
        context: sanitizeContext(body.context),
      });
      if (error) throw error;
      return json({ ok: true });
    } catch (err) {
      console.error('[feedback] insert failed:', err);
      return json({ error: 'insert_failed' }, 500);
    }
  },
};
