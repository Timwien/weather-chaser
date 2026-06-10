// Stripe webhook — the ONLY writer of the subscriptions table.
// Verifies the Stripe-Signature header (HMAC-SHA256 over `${t}.${rawBody}`)
// with Web Crypto, then upserts subscription state for the Supabase user.
//
// Events handled:
//   checkout.session.completed          → activate (links customer + sub ids)
//   customer.subscription.updated       → sync status / period end
//   customer.subscription.deleted       → mark canceled
//
// Configure in Stripe Dashboard: endpoint /api/stripe/webhook with the three
// events above; put the signing secret in STRIPE_WEBHOOK_SECRET.

import { stripeRequest, adminClient, json } from './_shared.js';

const TOLERANCE_SECONDS = 300; // 5 min replay window, same as Stripe SDK default

async function verifySignature(payload: string, header: string | null, secret: string): Promise<boolean> {
  if (!header) return false;
  const parts = new Map(
    header.split(',').map((kv) => {
      const [k, ...rest] = kv.split('=');
      return [k.trim(), rest.join('=')] as const;
    }),
  );
  const timestamp = parts.get('t');
  const signature = parts.get('v1');
  if (!timestamp || !signature) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > TOLERANCE_SECONDS) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${payload}`));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time comparison
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

interface SubscriptionShape {
  id: string;
  customer: string;
  status: string;
  current_period_end?: number;
  items?: { data?: Array<{ price?: { id?: string } }> };
  metadata?: Record<string, string>;
}

async function upsertSubscription(userId: string, sub: SubscriptionShape): Promise<void> {
  await adminClient().from('subscriptions').upsert({
    user_id: userId,
    stripe_customer_id: sub.customer,
    stripe_subscription_id: sub.id,
    status: sub.status,
    price_id: sub.items?.data?.[0]?.price?.id ?? null,
    current_period_end: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  });
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return json({ error: 'webhook_not_configured' }, 503);

    const payload = await request.text();
    const valid = await verifySignature(payload, request.headers.get('stripe-signature'), secret);
    if (!valid) return new Response('Invalid signature', { status: 400 });

    const event = JSON.parse(payload) as { type: string; data: { object: Record<string, unknown> } };

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as {
            client_reference_id?: string;
            subscription?: string;
            metadata?: Record<string, string>;
          };
          const userId = session.client_reference_id ?? session.metadata?.supabase_user_id;
          if (userId && session.subscription) {
            // Fetch the full subscription for status + period end
            const sub = (await stripeRequest(
              `/subscriptions/${session.subscription}`, {}, 'GET',
            )) as unknown as SubscriptionShape;
            await upsertSubscription(userId, sub);
          }
          break;
        }
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const sub = event.data.object as unknown as SubscriptionShape;
          const userId = sub.metadata?.supabase_user_id;
          if (userId) {
            await upsertSubscription(userId, {
              ...sub,
              status: event.type === 'customer.subscription.deleted' ? 'canceled' : sub.status,
            });
          }
          break;
        }
        default:
          break; // Unhandled event types are acknowledged silently
      }
      return json({ received: true });
    } catch (err) {
      console.error('[stripe/webhook] Error:', err instanceof Error ? err.message : err);
      return json({ error: 'webhook_processing_failed' }, 500);
    }
  },
};
