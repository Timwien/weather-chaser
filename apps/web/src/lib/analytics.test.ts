import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock with a minimal model of posthog-js 1.398 consent: reset() runs
// consent.reset(), which DELETES the stored opt-out flag (→ capturing again).
let optedOut = false;
const ph = {
  init: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(() => { optedOut = false; }),
  set_config: vi.fn(),
  opt_out_capturing: vi.fn(() => { optedOut = true; }),
  opt_in_capturing: vi.fn(() => { optedOut = false; }),
  is_capturing: vi.fn(() => !optedOut),
  startSessionRecording: vi.fn(),
  stopSessionRecording: vi.fn(),
};
let posthogImported = false;
vi.mock('posthog-js', () => {
  posthogImported = true;
  return { default: ph };
});

const flush = () => new Promise((r) => setTimeout(r, 20));
// dynamic import timing varies under load: wait for the effect instead of guessing
const until = (fn: () => void) => vi.waitFor(fn, { timeout: 2000 });

describe('analytics consent gating', () => {
  let a: typeof import('./analytics.ts');
  beforeEach(async () => {
    vi.resetModules();
    posthogImported = false;
    optedOut = false;
    Object.values(ph).forEach((f) => f.mockClear());
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
    a = await import('./analytics.ts');
  });

  it('does not import posthog-js or send anything before consent; calls are dropped', async () => {
    a.capture('x');
    a.identifyUser('u1');
    a.captureError({ name: 'Error', scope: 's', hash: 'h' });
    await flush();
    expect(posthogImported).toBe(false);
    expect(ph.init).not.toHaveBeenCalled();
    a.enableAnalytics();
    await until(() => expect(ph.init).toHaveBeenCalledTimes(1));
    await flush();
    expect(ph.capture).not.toHaveBeenCalled(); // pre-consent calls were NOT replayed
    expect(ph.identify).not.toHaveBeenCalled();
  });

  it('after opt-in: inits with masking + memory persistence and identifies', async () => {
    a.enableAnalytics('u1');
    await until(() => expect(ph.init).toHaveBeenCalledTimes(1));
    const cfg = ph.init.mock.calls[0][1];
    expect(cfg).toMatchObject({ persistence: 'memory', mask_all_text: true });
    expect(cfg.session_recording.maskAllInputs).toBe(true);
    // console logs, network timing and exception autocapture stay off
    expect(cfg).toMatchObject({
      enable_recording_console_log: false,
      capture_exceptions: false,
      capture_performance: { network_timing: false },
    });
    expect(ph.identify).toHaveBeenCalledWith('u1');
    a.capture('evt', { a: 1 });
    expect(ph.capture).toHaveBeenCalledWith('evt', { a: 1 });
  });

  it('withdrawal opts out, resets and stops further capture', async () => {
    a.enableAnalytics();
    await until(() => expect(ph.init).toHaveBeenCalled());
    a.disableAnalytics();
    expect(ph.opt_out_capturing).toHaveBeenCalled();
    expect(ph.reset).toHaveBeenCalled();
    a.capture('after');
    expect(ph.capture).not.toHaveBeenCalledWith('after', undefined);
  });

  it('withdrawal: recording stopped, reset() BEFORE opt_out_capturing(), not capturing afterwards', async () => {
    a.enableAnalytics();
    await until(() => expect(ph.init).toHaveBeenCalled());
    a.disableAnalytics();
    const order = (f: { mock: { invocationCallOrder: number[] } }) => f.mock.invocationCallOrder.at(-1)!;
    expect(ph.stopSessionRecording).toHaveBeenCalled();
    expect(order(ph.stopSessionRecording)).toBeLessThan(order(ph.opt_out_capturing));
    expect(order(ph.reset)).toBeLessThan(order(ph.opt_out_capturing));
    expect(ph.is_capturing()).toBe(false);
  });

  it('opts in explicitly after init (a stale opt-out flag from an earlier visit must not win)', async () => {
    optedOut = true; // as if `__ph_opt_in_out_` = 0 was left in localStorage
    a.enableAnalytics();
    await until(() => expect(ph.init).toHaveBeenCalled());
    expect(ph.opt_in_capturing).toHaveBeenCalledWith({ captureEventName: false });
    expect(ph.init.mock.invocationCallOrder[0]).toBeLessThan(ph.opt_in_capturing.mock.invocationCallOrder[0]);
    expect(ph.is_capturing()).toBe(true);
  });

  it('re-consent in the same page view opts in again without an extra $opt_in event', async () => {
    a.enableAnalytics();
    await until(() => expect(ph.init).toHaveBeenCalled());
    a.disableAnalytics();
    ph.opt_in_capturing.mockClear();
    a.enableAnalytics();
    expect(ph.opt_in_capturing).toHaveBeenCalledWith({ captureEventName: false });
    expect(ph.is_capturing()).toBe(true);
  });

  it('withdrawal while the chunk loads never initialises PostHog', async () => {
    a.enableAnalytics();
    a.disableAnalytics();
    await flush();
    expect(ph.init).not.toHaveBeenCalled();
  });

  it('captureError sends only name, scope and hash', async () => {
    a.enableAnalytics();
    await until(() => expect(ph.init).toHaveBeenCalled());
    a.captureError({ name: 'TypeError', scope: 'worker', hash: 'abc' });
    const [evt, props] = ph.capture.mock.calls.at(-1)!;
    expect(evt).toBe('$exception');
    expect(JSON.stringify(props)).not.toMatch(/http|stack/);
    expect(props.scope).toBe('worker');
  });
});
