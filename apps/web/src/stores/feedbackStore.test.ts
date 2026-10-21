import { describe, it, expect, beforeEach, vi } from 'vitest';

// Node test env has no localStorage — minimal in-memory stub before the store loads.
const mem = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
});
vi.mock('../lib/analytics.ts', () => ({ capture: vi.fn() }));

const { useFeedbackStore, isPromptArmed } = await import('./feedbackStore.ts');
const { useAppStore } = await import('./appStore.ts');

describe('feedback prompt (D4)', () => {
  beforeEach(() => {
    mem.clear();
    vi.useFakeTimers();
    useFeedbackStore.setState({ modalOpen: false });
    useAppStore.setState({ mode: 'idle' });
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

  it('shows at most once ever', () => {
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
