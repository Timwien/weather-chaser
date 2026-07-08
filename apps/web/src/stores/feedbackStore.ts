// Feedback prompt + modal state. Callable from non-React modules
// (optimizerRunner) via useFeedbackStore.getState().

import { create } from 'zustand';
import { capture } from '../lib/analytics.ts';

export type FeedbackSource = 'prompt' | 'entry_footer' | 'account_tab';

// localStorage keys follow the existing wc_* idiom (wc_first_route_hint_shown).
const COUNT_KEY = 'wc_search_success_count';
const SHOWN_KEY = 'wc_feedback_prompt_shown';

// Ask after the user has seen the app work twice — they can judge it by then.
const PROMPT_AFTER_SUCCESSES = 2;

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
  promptVisible: boolean;
  modalOpen: boolean;
  modalSource: FeedbackSource;

  /** Called from both search 'complete' handlers. Fires the prompt once ever. */
  recordSearchSuccess: () => void;
  dismissPrompt: () => void;
  openModal: (source: FeedbackSource) => void;
  closeModal: () => void;
}

export const useFeedbackStore = create<FeedbackState>((set) => ({
  promptVisible: false,
  modalOpen: false,
  modalSource: 'prompt',

  recordSearchSuccess: () => {
    try {
      const count = readCount() + 1;
      localStorage.setItem(COUNT_KEY, String(count));
      if (count >= PROMPT_AFTER_SUCCESSES && !promptAlreadyShown()) {
        // Mark shown immediately — once ever, even if the user never interacts.
        localStorage.setItem(SHOWN_KEY, '1');
        set({ promptVisible: true });
        capture('feedback_prompt_shown');
      }
    } catch { /* storage unavailable — skip silently */ }
  },

  dismissPrompt: () => {
    set({ promptVisible: false });
    capture('feedback_prompt_dismissed');
  },

  openModal: (source) => set({ modalOpen: true, modalSource: source, promptVisible: false }),

  closeModal: () => set({ modalOpen: false }),
}));
