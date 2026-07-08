// Client for the /api/feedback endpoint (guest-capable). Fire-and-forget
// spirit: returns false on any failure, never throws — the form shows a
// friendly retry hint, nothing else depends on it.

import i18n from '../i18n/index.ts';
import { useAppStore } from '../stores/appStore.ts';
import { getSupabase, supabaseConfigured } from '../lib/supabase.ts';
import { capture } from '../lib/analytics.ts';
import type { FeedbackSource } from '../stores/feedbackStore.ts';

export type { FeedbackSource };

export async function submitFeedback(
  rating: number,
  message: string,
  source: FeedbackSource,
): Promise<boolean> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    // Attach identity when signed in — guests submit without a token.
    if (supabaseConfigured) {
      try {
        const { data } = await getSupabase().auth.getSession();
        const token = data.session?.access_token;
        if (token) headers.Authorization = `Bearer ${token}`;
      } catch { /* guest path */ }
    }

    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        rating,
        message,
        context: {
          source,
          mode: useAppStore.getState().mode,
          locale: i18n.language,
          viewport_w: window.innerWidth,
          viewport_h: window.innerHeight,
          is_mobile: window.matchMedia('(max-width: 768px)').matches,
        },
      }),
    });

    if (!res.ok) return false;

    capture('feedback_submitted', {
      rating,
      has_message: message.trim().length > 0,
      source,
    });
    return true;
  } catch {
    return false;
  }
}
