// Shared helpers for the Stripe serverless endpoints.
// All Stripe calls use the REST API directly via fetch — no SDK dependency,
// which keeps the serverless bundles small and avoids Node-version coupling.
// CRITICAL: STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET must NOT use VITE_ prefix.

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

export const STRIPE_API = 'https://api.stripe.com/v1';

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Calls the Stripe REST API with form-encoded params. Throws on non-2xx. */
export async function stripeRequest(
  path: string,
  params: Record<string, string>,
  method: 'POST' | 'GET' = 'POST',
): Promise<Record<string, unknown>> {
  const body = new URLSearchParams(params);
  const url = method === 'GET' ? `${STRIPE_API}${path}?${body}` : `${STRIPE_API}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: method === 'POST' ? body : undefined,
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = json.error as { message?: string } | undefined;
    throw new Error(err?.message ?? `Stripe ${path} failed (${res.status})`);
  }
  return json;
}

/** Validates the Authorization bearer token; returns the Supabase user or null. */
export async function authenticateRequest(request: Request): Promise<User | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const anonClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
  );
  const { data, error } = await anonClient.auth.getUser(authHeader.slice(7));
  if (error || !data.user) return null;
  return data.user;
}

/** Service-role client — server-side writes to the subscriptions table. */
export function adminClient(): SupabaseClient {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
