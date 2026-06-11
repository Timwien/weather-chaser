/**
 * Free-premium beta flag (pre-GA).
 *
 * Until GA, all premium features are free for everyone — Stripe stays dormant
 * (endpoints exist but are never reached from the UI while this is on).
 *
 * Default is ON. To end the beta at GA, set BOTH (no code change needed):
 *   - Vercel env  VITE_PREMIUM_FREE_BETA=false   (client gating)
 *   - Vercel env  PREMIUM_FREE_BETA=false        (server gate /api/premium/validate)
 * …and configure the Stripe envs (STRIPE_SECRET_KEY, STRIPE_PRICE_ID,
 * STRIPE_WEBHOOK_SECRET) to activate checkout.
 */
export const PREMIUM_FREE_BETA = import.meta.env.VITE_PREMIUM_FREE_BETA !== 'false';
