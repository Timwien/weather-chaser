import { create } from 'zustand';
import { getSupabase, supabaseConfigured } from '../lib/supabase.ts';

/**
 * Subscription tier state (Phase 4 freemium).
 *
 * The client-side tier is for UX only (showing/hiding premium UI). The actual
 * enforcement is server-side: /api/premium/validate returns 403 for
 * non-premium users, and the subscriptions table is only writable by the
 * Stripe webhook (service_role). Guests and signed-in free users are 'free'.
 */
export type SubscriptionTier = 'free' | 'premium';

const ACTIVE_STATUSES = new Set(['active', 'trialing']);

interface SubscriptionState {
  tier: SubscriptionTier;
  loading: boolean;
  /** Re-reads the subscription row for the given user (null = signed out). */
  refresh: (userId: string | null) => Promise<void>;
}

export const useSubscriptionStore = create<SubscriptionState>((set) => ({
  tier: 'free',
  loading: false,

  refresh: async (userId) => {
    if (!userId || !supabaseConfigured) {
      set({ tier: 'free', loading: false });
      return;
    }
    set({ loading: true });
    try {
      const { data } = await getSupabase()
        .from('subscriptions')
        .select('status, current_period_end')
        .eq('user_id', userId)
        .maybeSingle();

      const status = (data as { status?: string } | null)?.status ?? 'inactive';
      const periodEnd = (data as { current_period_end?: string } | null)?.current_period_end;
      const active =
        ACTIVE_STATUSES.has(status) &&
        (!periodEnd || new Date(periodEnd).getTime() > Date.now());
      set({ tier: active ? 'premium' : 'free', loading: false });
    } catch {
      set({ tier: 'free', loading: false });
    }
  },
}));
