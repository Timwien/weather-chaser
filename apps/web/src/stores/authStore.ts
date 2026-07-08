import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabase, supabaseConfigured } from '../lib/supabase.ts';
import { useSubscriptionStore } from './subscriptionStore.ts';
import { capture, identifyUser, resetIdentity } from '../lib/analytics.ts';

export interface PendingAction {
  type: 'save_route' | 'favorite_place' | 'save_finder_search';
  payload: unknown;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
  pendingAction: PendingAction | null;

  initialize: () => () => void;  // returns unsubscribe fn
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setPendingAction: (action: PendingAction | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,
  initialized: false,
  pendingAction: null,

  initialize: () => {
    if (!supabaseConfigured) {
      set({ loading: false, initialized: true });
      return () => {};
    }
    const { data: { subscription } } = getSupabase().auth.onAuthStateChange(
      (event, session) => {
        const prevUser = get().user;
        const pending = get().pendingAction;

        set({
          session,
          user: session?.user ?? null,
          loading: false,
          initialized: true,
        });

        // Keep the subscription tier in sync with the signed-in user (Phase 4)
        void useSubscriptionStore.getState().refresh(session?.user?.id ?? null);

        // Analytics identity: id only (no email/name). Reset on sign-out.
        if (session?.user) {
          identifyUser(session.user.id);
        } else if (prevUser) {
          resetIdentity();
        }

        if (event === 'SIGNED_IN' && !prevUser) {
          capture('sign_in_completed', {
            provider: session?.user?.app_metadata?.provider ?? 'unknown',
          });
          if (pending) console.info('[auth] SIGNED_IN with pending action:', pending.type);
        }
      }
    );
    return () => subscription.unsubscribe();
  },

  signInWithGoogle: async () => {
    await getSupabase().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  },

  signInWithApple: async () => {
    await getSupabase().auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: window.location.origin },
    });
  },

  signInWithEmail: async (email, password) => {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  signUpWithEmail: async (email, password) => {
    const { error } = await getSupabase().auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
  },

  signOut: async () => {
    await getSupabase().auth.signOut();
    set({ user: null, session: null, pendingAction: null });
  },

  setPendingAction: (action) => set({ pendingAction: action }),
}));
