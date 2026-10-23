import { describe, it, expect, beforeEach, vi } from 'vitest';

const ph = {
  init: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  set_config: vi.fn(),
  opt_out_capturing: vi.fn(),
  opt_in_capturing: vi.fn(),
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
