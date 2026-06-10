// Creates a Stripe Billing Portal session so subscribers can manage/cancel.
// POST with Authorization: Bearer <supabase access token>.

import { stripeConfigured, stripeRequest, authenticateRequest, adminClient, json } from './_shared.js';

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }
    if (!stripeConfigured()) {
      return json({ error: 'stripe_not_configured' }, 503);
    }

    const user = await authenticateRequest(request);
    if (!user) return new Response('Unauthorized', { status: 401 });

    const { data } = await adminClient()
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const customerId = data?.stripe_customer_id as string | undefined;
    if (!customerId) return json({ error: 'no_subscription' }, 404);

    const origin = request.headers.get('origin') ?? process.env.PUBLIC_APP_URL ?? '';

    try {
      const session = await stripeRequest('/billing_portal/sessions', {
        customer: customerId,
        return_url: `${origin}/`,
      });
      return json({ url: session.url });
    } catch (err) {
      console.error('[stripe/portal] Error:', err instanceof Error ? err.message : err);
      return json({ error: 'portal_failed' }, 500);
    }
  },
};
