// Vercel cron endpoint — keeps Supabase free tier from auto-pausing
// Scheduled every 3 days via vercel.json crons
// Returns 200 regardless of DB result — the HTTP request itself is the keepalive

import { createClient } from '@supabase/supabase-js';

export default {
  async fetch(_request: Request): Promise<Response> {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      // Lightweight ping — error acceptable (table may not exist yet)
      await supabase.from('saved_routes').select('count').limit(0);
    }

    return new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  },
};
