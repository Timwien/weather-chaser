import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase.ts';

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const prevUser = get().user;
        const pending = get().pendingAction;

        set({
          session,
          user: session?.user ?? null,
          loading: false,
          initialized: true,
        });

        // After sign-in: if there's a pending action queued before auth, re-dispatch
        // Actual execution is handled by the component that set the pending action
        // (it listens to user state change). Clear it here after logging.
        if (event === 'SIGNED_IN' && !prevUser && pending) {
          // pendingAction is consumed by the UI layer that set it.
          // We leave it in state — the UI clears it after executing.
          console.info('[auth] SIGNED_IN with pending action:', pending.type);
        }
      }
    );
    return () => subscription.unsubscribe();
  },

  signInWithGoogle: async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  },

  signInWithApple: async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: window.location.origin },
    });
  },

  signInWithEmail: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  signUpWithEmail: async (email, password) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null, pendingAction: null });
  },

  setPendingAction: (action) => set({ pendingAction: action }),
}));
