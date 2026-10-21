// Feedback modal state + one-time proactive trigger. Callable from non-React
// modules (optimizerRunner) via useFeedbackStore.getState().

import { create } from 'zustand';
import { capture } from '../lib/analytics.ts';
import { useAppStore } from './appStore.ts';

export type FeedbackSource = 'prompt' | 'entry_footer' | 'account_tab';

// localStorage keys follow the existing wc_* idiom (wc_first_route_hint_shown).
const COUNT_KEY = 'wc_search_success_count';
const SHOWN_KEY = 'wc_feedback_prompt_shown';

// Ask after the user has seen the app work twice — they can judge it by then.
const PROMPT_AFTER_SUCCESSES = 2;
// The prompt never pops up over results (D4: a backdrop appearing mid-interaction
// swallowed the user's next click, e.g. the first "Back"). It is armed on the
// 2nd success and shown the next time the user returns to the entry form.
const PROMPT_DELAY_MS = 600;

function readCount(): number {
  try {
    return parseInt(localStorage.getItem(COUNT_KEY) ?? '0', 10) || 0;
  } catch { return 0; }
}

function promptAlreadyShown(): boolean {
  try {
    return localStorage.getItem(SHOWN_KEY) === '1';
  } catch { return true; } // storage unavailable → never prompt
}

let promptArmed = false;

interface FeedbackState {
  modalOpen: boolean;
  modalSource: FeedbackSource;

  /** Called from both search 'complete' handlers. Arms the prompt once ever (shown on the next return to the entry form). */
  recordSearchSuccess: () => void;
  openModal: (source: FeedbackSource) => void;
  closeModal: () => void;
}

export const useFeedbackStore = create<FeedbackState>((set) => ({
  modalOpen: false,
  modalSource: 'prompt',

  recordSearchSuccess: () => {
    try {
      const count = readCount() + 1;
      localStorage.setItem(COUNT_KEY, String(count));
      // Armed per session; marked shown only when it actually opens, so a user
      // who closes the tab on the results still gets asked on a later visit.
      if (count >= PROMPT_AFTER_SUCCESSES && !promptAlreadyShown()) promptArmed = true;
    } catch { /* storage unavailable — skip silently */ }
  },

  openModal: (source) => set({ modalOpen: true, modalSource: source }),

  closeModal: () => set({ modalOpen: false }),
}));

// Show an armed prompt once the user is back on the entry form (mode 'idle').
useAppStore.subscribe((state, prev) => {
  if (!promptArmed || state.mode !== 'idle' || prev.mode === 'idle') return;
  promptArmed = false;
  setTimeout(() => {
    // Once ever, even if the user just closes it.
    try { localStorage.setItem(SHOWN_KEY, '1'); } catch { return; }
    useFeedbackStore.setState({ modalOpen: true, modalSource: 'prompt' });
    capture('feedback_prompt_shown');
  }, PROMPT_DELAY_MS);
});

/** Test hook: whether a proactive prompt is waiting for the entry form. */
export const isPromptArmed = (): boolean => promptArmed;
