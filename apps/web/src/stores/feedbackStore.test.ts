import { describe, it, expect, beforeEach, vi } from 'vitest';

// Node test env has no localStorage — minimal in-memory stub before the store loads.
const mem = new Map<string, string>([
  // left behind by older builds — must be removed on load
  ['wc_search_success_count', '7'],
  ['wc_feedback_prompt_shown', '1'],
  ['wc-theme', 'dark'],
]);
const setItem = vi.fn((k: string, v: string) => void mem.set(k, v));
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem,
  removeItem: (k: string) => void mem.delete(k),
});
vi.mock('../lib/analytics.ts', () => ({ capture: vi.fn() }));

const { useFeedbackStore, isPromptArmed, __resetFeedbackPromptForTests } = await import('./feedbackStore.ts');
const { useAppStore } = await import('./appStore.ts');

describe('feedback prompt (D4)', () => {
  beforeEach(() => {
    __resetFeedbackPromptForTests();
    setItem.mockClear();
    vi.useFakeTimers();
    useFeedbackStore.setState({ modalOpen: false });
    useAppStore.setState({ mode: 'idle' });
  });

  it('removes the legacy counter keys from storage once on load (and nothing else)', () => {
    expect(mem.has('wc_search_success_count')).toBe(false);
    expect(mem.has('wc_feedback_prompt_shown')).toBe(false);
    expect(mem.get('wc-theme')).toBe('dark');
  });

  it('does not open over the results; opens after returning to the entry form', () => {
    useFeedbackStore.getState().recordSearchSuccess(); // 1st
    useAppStore.setState({ mode: 'results' });
    useFeedbackStore.getState().recordSearchSuccess(); // 2nd -> armed
    vi.advanceTimersByTime(5000);
    expect(isPromptArmed()).toBe(true);
    expect(useFeedbackStore.getState().modalOpen).toBe(false);

    useAppStore.getState().reset(); // user presses "Back"
    expect(useFeedbackStore.getState().modalOpen).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(useFeedbackStore.getState().modalOpen).toBe(true);
    expect(isPromptArmed()).toBe(false);
  });

  it('never writes the counters to device storage', () => {
    useFeedbackStore.getState().recordSearchSuccess();
    useFeedbackStore.getState().recordSearchSuccess();
    useAppStore.setState({ mode: 'results' });
    useAppStore.getState().reset();
    vi.advanceTimersByTime(1000);
    expect(useFeedbackStore.getState().modalOpen).toBe(true);
    expect(setItem).not.toHaveBeenCalled();
    expect([...mem.keys()].some((k) => k.includes('feedback') || k.includes('search_success'))).toBe(false);
  });

  it('is not armed after a single success', () => {
    useFeedbackStore.getState().recordSearchSuccess();
    expect(isPromptArmed()).toBe(false);
  });

  it('shows at most once per page session', () => {
    useFeedbackStore.getState().recordSearchSuccess();
    useFeedbackStore.getState().recordSearchSuccess();
    useAppStore.setState({ mode: 'results' });
    useAppStore.getState().reset();
    vi.advanceTimersByTime(1000);
    useFeedbackStore.getState().closeModal();
    useFeedbackStore.getState().recordSearchSuccess();
    expect(isPromptArmed()).toBe(false);
  });
});
