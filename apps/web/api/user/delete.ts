// GDPR right to erasure — server-side account deletion endpoint
// Uses service_role key to delete user + all cascade-deleted data
// CRITICAL: SUPABASE_SERVICE_ROLE_KEY must NOT use VITE_ prefix — server-side only
//
// Erasure scope: (1) feedback rows of the user (their FK is `on delete set null`,
// which would otherwise keep the free-text message), (2) the auth user (cascades
// to saved routes etc.), (3) best effort: the PostHog person incl. events, only
// when POSTHOG_PERSONAL_API_KEY + POSTHOG_PROJECT_ID are configured.

import { createClient } from '@supabase/supabase-js';

const POSTHOG_TIMEOUT_MS = 5000;

/** Best-effort PostHog person deletion. Never throws, never logs secrets or ids. */
async function deletePostHogPerson(userId: string): Promise<void> {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  if (!apiKey || !projectId) return;
  try {
    const res = await fetch(
      `https://eu.posthog.com/api/projects/${encodeURIComponent(projectId)}/persons/bulk_delete/`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ distinct_ids: [userId], delete_events: true }),
        signal: AbortSignal.timeout(POSTHOG_TIMEOUT_MS),
      },
    );
    if (!res.ok) console.error('[user/delete] PostHog person deletion failed:', res.status);
  } catch {
    console.error('[user/delete] PostHog person deletion failed');
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'DELETE') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Extract bearer token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response('Unauthorized', { status: 401 });
    }
    const token = authHeader.slice(7); // Remove "Bearer "

    // Validate the token and get user identity using anon client
    const anonClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const adminClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1) Feedback first: user_id is `on delete set null`, so without this the
    //    free-text message would survive the account (and could not be linked
    //    back to the user afterwards). Abort if it fails — don't claim erasure.
    const { error: feedbackError } = await adminClient.from('feedback').delete().eq('user_id', user.id);
    if (feedbackError) {
      console.error('[user/delete] Feedback deletion error:', feedbackError.message);
      return new Response(JSON.stringify({ error: 'Could not delete account data' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2) Auth user (ON DELETE CASCADE removes saved_routes, saved_finder_searches, favorites, …)
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error('[user/delete] Error:', deleteError.message);
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3) Analytics person (optional, best effort)
    await deletePostHogPerson(user.id);

    return new Response(JSON.stringify({ deleted: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
