// Server-side premium enforcement (PREM requirement: bypassing the UI must
// not grant access — this endpoint is the source of truth and returns 403
// for non-premium users).
// GET with Authorization: Bearer <supabase access token>.

import { authenticateRequest, adminClient, json } from '../stripe/_shared.js';

const ACTIVE_STATUSES = new Set(['active', 'trialing']);

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }

    const user = await authenticateRequest(request);
    if (!user) return new Response('Unauthorized', { status: 401 });

    const { data } = await adminClient()
      .from('subscriptions')
      .select('status, current_period_end')
      .eq('user_id', user.id)
      .maybeSingle();

    const status = (data?.status as string | undefined) ?? 'inactive';
    const periodEnd = data?.current_period_end ? new Date(data.current_period_end as string) : null;
    const premium =
      ACTIVE_STATUSES.has(status) && (periodEnd === null || periodEnd.getTime() > Date.now());

    if (!premium) return json({ premium: false, status }, 403);
    return json({ premium: true, status });
  },
};
