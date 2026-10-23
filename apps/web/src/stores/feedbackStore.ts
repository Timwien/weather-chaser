// Feedback modal state + one-time proactive trigger. Callable from non-React
// modules (optimizerRunner) via useFeedbackStore.getState().

import { create } from 'zustand';
import { capture } from '../lib/analytics.ts';
import { useAppStore } from './appStore.ts';

export type FeedbackSource = 'prompt' | 'entry_footer' | 'account_tab';

// Privacy (§ 25 TDDDG): the prompt counter serves the operator's interest, not
// a feature the user asked for — so it is NOT strictly necessary and must not
// touch device storage. It lives in memory only: the prompt shows at most once
// per page session, after the 2nd successful search of that session.
//
// Older builds kept these keys in localStorage; remove them once on load.
const LEGACY_KEYS = ['wc_search_success_count', 'wc_feedback_prompt_shown'] as const;
try {
  for (const k of LEGACY_KEYS) localStorage.removeItem(k);
} catch { /* storage unavailable — nothing to clean up */ }

// Ask after the user has seen the app work twice — they can judge it by then.
const PROMPT_AFTER_SUCCESSES = 2;
// The prompt never pops up over results (D4: a backdrop appearing mid-interaction
// swallowed the user's next click, e.g. the first "Back"). It is armed on the
// 2nd success and shown the next time the user returns to the entry form.
const PROMPT_DELAY_MS = 600;

let successCount = 0;
let promptShown = false;
let promptArmed = false;

interface FeedbackState {
  modalOpen: boolean;
  modalSource: FeedbackSource;

  /** Called from both search 'complete' handlers. Arms the prompt once per page session (shown on the next return to the entry form). */
  recordSearchSuccess: () => void;
  openModal: (source: FeedbackSource) => void;
  closeModal: () => void;
}

export const useFeedbackStore = create<FeedbackState>((set) => ({
  modalOpen: false,
  modalSource: 'prompt',

  recordSearchSuccess: () => {
    successCount += 1;
    // Marked shown only when it actually opens.
    if (successCount >= PROMPT_AFTER_SUCCESSES && !promptShown) promptArmed = true;
  },

  openModal: (source) => set({ modalOpen: true, modalSource: source }),

  closeModal: () => set({ modalOpen: false }),
}));

// Show an armed prompt once the user is back on the entry form (mode 'idle').
useAppStore.subscribe((state, prev) => {
  if (!promptArmed || state.mode !== 'idle' || prev.mode === 'idle') return;
  promptArmed = false;
  setTimeout(() => {
    // Once per page session, even if the user just closes it.
    promptShown = true;
    useFeedbackStore.setState({ modalOpen: true, modalSource: 'prompt' });
    capture('feedback_prompt_shown');
  }, PROMPT_DELAY_MS);
});

/** Test hook: whether a proactive prompt is waiting for the entry form. */
export const isPromptArmed = (): boolean => promptArmed;

/** Test hook: start a fresh page session (in-memory counters only). */
export function __resetFeedbackPromptForTests(): void {
  successCount = 0;
  promptShown = false;
  promptArmed = false;
}
