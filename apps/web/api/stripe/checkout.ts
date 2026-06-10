// Creates a Stripe Checkout Session for the premium subscription.
// POST with Authorization: Bearer <supabase access token>.
// Responds 503 when Stripe is not configured (pre-launch safe default).

import { stripeConfigured, stripeRequest, authenticateRequest, json } from './_shared.js';

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }
    if (!stripeConfigured() || !process.env.STRIPE_PRICE_ID) {
      return json({ error: 'stripe_not_configured' }, 503);
    }

    const user = await authenticateRequest(request);
    if (!user) return new Response('Unauthorized', { status: 401 });

    const origin = request.headers.get('origin') ?? process.env.PUBLIC_APP_URL ?? '';

    try {
      const session = await stripeRequest('/checkout/sessions', {
        mode: 'subscription',
        'line_items[0][price]': process.env.STRIPE_PRICE_ID,
        'line_items[0][quantity]': '1',
        client_reference_id: user.id,
        customer_email: user.email ?? '',
        success_url: `${origin}/?checkout=success`,
        cancel_url: `${origin}/?checkout=cancelled`,
        // Webhook needs the user id even when Stripe creates a new customer
        'subscription_data[metadata][supabase_user_id]': user.id,
        'metadata[supabase_user_id]': user.id,
      });
      return json({ url: session.url });
    } catch (err) {
      console.error('[stripe/checkout] Error:', err instanceof Error ? err.message : err);
      return json({ error: 'checkout_failed' }, 500);
    }
  },
};
