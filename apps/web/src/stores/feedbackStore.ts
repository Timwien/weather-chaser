// Feedback modal state + one-time proactive trigger. Callable from non-React
// modules (optimizerRunner) via useFeedbackStore.getState().

import { create } from 'zustand';
import { capture } from '../lib/analytics.ts';

export type FeedbackSource = 'prompt' | 'entry_footer' | 'account_tab';

// localStorage keys follow the existing wc_* idiom (wc_first_route_hint_shown).
const COUNT_KEY = 'wc_search_success_count';
const SHOWN_KEY = 'wc_feedback_prompt_shown';

// Ask after the user has seen the app work twice — they can judge it by then.
const PROMPT_AFTER_SUCCESSES = 2;
// Let the results render first so the popup doesn't mask the payoff moment.
const PROMPT_DELAY_MS = 1500;

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

interface FeedbackState {
  modalOpen: boolean;
  modalSource: FeedbackSource;

  /** Called from both search 'complete' handlers. Opens the modal once ever. */
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
      if (count >= PROMPT_AFTER_SUCCESSES && !promptAlreadyShown()) {
        // Mark shown immediately — once ever, even if the user just closes it.
        localStorage.setItem(SHOWN_KEY, '1');
        setTimeout(() => {
          set({ modalOpen: true, modalSource: 'prompt' });
          capture('feedback_prompt_shown');
        }, PROMPT_DELAY_MS);
      }
    } catch { /* storage unavailable — skip silently */ }
  },

  openModal: (source) => set({ modalOpen: true, modalSource: source }),

  closeModal: () => set({ modalOpen: false }),
}));
