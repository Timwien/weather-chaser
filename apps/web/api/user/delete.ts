// GDPR right to erasure — server-side account deletion endpoint
// Uses service_role key to delete user + all cascade-deleted data
// CRITICAL: SUPABASE_SERVICE_ROLE_KEY must NOT use VITE_ prefix — server-side only

import { createClient } from '@supabase/supabase-js';

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

    // Delete user with service_role key (cascades to all tables via ON DELETE CASCADE)
    // ON DELETE CASCADE on saved_routes, saved_finder_searches, favorites handles data cascade
    // No manual table deletions needed — Postgres does it automatically
    const adminClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error('[user/delete] Error:', deleteError.message);
      return new Response(deleteError.message, { status: 500 });
    }

    return new Response(JSON.stringify({ deleted: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
