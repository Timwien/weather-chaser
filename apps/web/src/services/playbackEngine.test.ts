import { describe, it, expect } from 'vitest';
import { adaptiveTarget, bufferTarget, PlaybackEngine, STALL_MS, type PlaybackState } from './playbackEngine.ts';

/** Deterministic harness: manual clock + timers, frames become ready on demand. */
function harness(total: number, opts: { showMs?: number; loop?: boolean; isReady?: (i: number, ready: Set<number>) => boolean } = {}) {
  let ended = 0;
  let t = 0;
  const timers: Array<{ at: number; fn: () => void }> = [];
  const ready = new Set<number>();
  const label: number[] = []; // order of shown frames = what the label displays
  const states: PlaybackState[] = [];
  const intervals: number[] = [];
  const engine = new PlaybackEngine({
    count: () => total,
    isReady: (i) => (opts.isReady ? opts.isReady(i, ready) : ready.has(i)),
    pump: () => {},
    loop: opts.loop,
    onEnd: () => { ended++; },
    show: async (i) => { if (opts.showMs) t += opts.showMs; label.push(i); },
    onState: (s) => states.push(s),
    onInterval: (ms) => intervals.push(ms),
    now: () => t,
    setTimer: (fn, ms) => { const h = { at: t + ms, fn }; timers.push(h); return h; },
    clearTimer: (h) => { const i = timers.indexOf(h as never); if (i >= 0) timers.splice(i, 1); },
  });
  const advance = async (ms: number) => {
    const end = t + ms;
    for (;;) {
      timers.sort((a, b) => a.at - b.at);
      const next = timers[0];
      if (!next || next.at > end) break;
      timers.shift(); t = Math.max(t, next.at); next.fn();
      await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    }
    t = end;
  };
  return { engine, ready, label, states, intervals, advance, now: () => t, ended: () => ended, pendingTimers: () => timers.length };
}

describe('bufferTarget', () => {
  it('needs all frames for short loops, 6 ahead for long ones', () => {
    expect(bufferTarget(12)).toBe(11);
    expect(bufferTarget(24)).toBe(6);
  });
  it('doubles per underrun, capped at all other frames', () => {
    expect(adaptiveTarget(40, 0)).toBe(6);
    expect(adaptiveTarget(40, 1)).toBe(12);
    expect(adaptiveTarget(40, 3)).toBe(39);
  });
});

describe('PlaybackEngine', () => {
  it('buffers first, starts only once 6 frames ahead are cached (24-frame loop), then ticks at 600 ms', async () => {
    const h = harness(24);
    h.engine.play(0);
    expect(h.states.at(-1)?.phase).toBe('buffering');
    for (let i = 1; i <= 5; i++) h.ready.add(i);
    h.engine.notify();
    expect(h.states.at(-1)?.phase).toBe('buffering');
    h.ready.add(6);
    h.engine.notify();
    expect(h.states.at(-1)?.phase).toBe('playing');
    for (let i = 7; i < 24; i++) h.ready.add(i);
    h.ready.add(0);
    await h.advance(600 * 5);
    expect(h.label).toEqual([1, 2, 3, 4, 5]);
    expect(h.intervals.every((ms) => ms === 600)).toBe(true);
  });

  it('plays a short loop (≤ 12 frames) only when ALL frames are cached', () => {
    const h = harness(8);
    h.engine.play(0);
    for (let i = 0; i < 7; i++) h.ready.add(i);
    h.engine.notify();
    expect(h.states.at(-1)?.phase).toBe('buffering');
    h.ready.add(7);
    h.engine.notify();
    expect(h.states.at(-1)?.phase).toBe('playing');
  });

  it('underrun: does not advance without a cached next frame, resumes after re-buffering, label never runs ahead', async () => {
    const h = harness(24);
    h.engine.play(0);
    for (let i = 1; i <= 6; i++) h.ready.add(i);
    h.engine.notify();
    await h.advance(600 * 3);
    expect(h.label).toEqual([1, 2, 3]);
    // frames 4.. are not cached beyond 6 → at frame 6 the next (7) is missing
    await h.advance(600 * 5);
    expect(h.label).toEqual([1, 2, 3, 4, 5, 6]);
    expect(h.states.at(-1)?.phase).toBe('buffering');
    const shownBefore = h.label.length;
    await h.advance(5000);
    expect(h.label.length).toBe(shownBefore); // clock stopped
    for (let i = 7; i <= 12; i++) h.ready.add(i);
    h.engine.notify();
    // after an underrun the engine wants twice as many frames ahead (6 → 12)
    expect(h.states.at(-1)?.phase).toBe('buffering');
    for (let i = 13; i <= 18; i++) h.ready.add(i);
    h.engine.notify();
    expect(h.states.at(-1)?.phase).toBe('playing');
    await h.advance(1200);
    expect(h.label.slice(shownBefore)).toEqual([7, 8]);
  });

  it('an in-flight show() that finishes after pause() does not move the clock', async () => {
    const h = harness(4);
    for (let i = 0; i < 4; i++) h.ready.add(i);
    h.engine.play(0);
    h.engine.pause();
    await h.advance(3000);
    expect(h.label).toEqual([]);
    expect(h.engine.state.phase).toBe('idle');
  });

  it('loops with a dwell on the last frame', async () => {
    const h = harness(3);
    for (let i = 0; i < 3; i++) h.ready.add(i);
    h.engine.play(0);
    await h.advance(600 * 2 + 700 + 600 + 650);
    expect(h.label.slice(0, 4)).toEqual([1, 2, 0, 1]);
    expect(h.intervals.slice(0, 3)).toEqual([600, 600, 1300]);
  });

  it('showFirst puts the start frame on screen before the cadence starts', async () => {
    const h = harness(3);
    for (let i = 0; i < 3; i++) h.ready.add(i);
    h.engine.play(1, true);
    await h.advance(10);
    expect(h.label).toEqual([1]);
    await h.advance(600);
    expect(h.label).toEqual([1, 2]);
  });
});

describe('PlaybackEngine without loop (play route)', () => {
  it('stops on the last frame, goes idle and reports the end once', async () => {
    const h = harness(5, { loop: false });
    for (let i = 0; i < 5; i++) h.ready.add(i);
    h.engine.play(0);
    await h.advance(600 * 10);
    expect(h.label).toEqual([1, 2, 3, 4]);
    expect(h.states.at(-1)?.phase).toBe('idle');
    expect(h.ended()).toBe(1);
  });

  it('a readiness dependency that arrives after play() (lazy cloud overlay) starts the playback on notify', async () => {
    let cloudReady = false; // the cloud overlay attaches later and only then loads its tiles
    const h = harness(24, { isReady: (i, ready) => ready.has(i) && cloudReady });
    for (let i = 0; i < 24; i++) h.ready.add(i); // all rain tiles are cached
    h.engine.play(0, true);
    expect(h.states.at(-1)).toMatchObject({ phase: 'buffering', ready: 0 });
    await h.advance(3000);
    expect(h.label).toEqual([]);
    cloudReady = true;
    h.engine.notify();
    expect(h.states.at(-1)?.phase).toBe('playing');
    await h.advance(10);
    await h.advance(600 * 3);
    expect(h.label).toEqual([0, 1, 2, 3]);
    expect(h.states.at(-1)?.incomplete).toBe(0);
  });

  it('watchdog: frames that never become ready are played incomplete after STALL_MS instead of hanging', async () => {
    const h = harness(24); // nothing ever gets ready (e.g. a dependency that never answers)
    h.engine.play(0, true);
    await h.advance(STALL_MS - 100);
    expect(h.states.at(-1)?.phase).toBe('buffering');
    expect(h.label).toEqual([]);
    await h.advance(200);
    expect(h.states.at(-1)).toMatchObject({ phase: 'playing', incomplete: 24 });
    await h.advance(600 * 3);
    expect(h.label).toEqual([0, 1, 2, 3]);
    // a released frame that loads later no longer counts as incomplete
    h.ready.add(5);
    h.engine.notify();
    expect(h.states.at(-1)?.incomplete).toBe(23);
  });

  it('watchdog is cancelled by reaching the buffer in time and re-armed by an underrun', async () => {
    const h = harness(24);
    h.engine.play(0);
    await h.advance(STALL_MS / 2);
    for (let i = 1; i <= 6; i++) h.ready.add(i);
    h.engine.notify(); // buffer filled in time → playing, nothing released
    expect(h.states.at(-1)).toMatchObject({ phase: 'playing', incomplete: 0 });
    await h.advance(600 * 7); // runs dry after frame 6 → buffering again
    expect(h.states.at(-1)).toMatchObject({ phase: 'buffering', incomplete: 0 });
    // the underrun armed a fresh watchdog: it releases the missing frames instead of buffering forever
    await h.advance(STALL_MS + 100);
    expect(h.states.at(-1)?.phase).toBe('playing');
    expect(h.states.at(-1)!.incomplete).toBeGreaterThan(0);
    await h.advance(700);
    expect(h.label.length).toBeGreaterThan(6);
  });

  it('pause() cancels a pending watchdog: no timer is left behind', async () => {
    const h = harness(24);
    h.engine.play(0);
    expect(h.pendingTimers()).toBe(1); // the watchdog of the first buffering phase
    h.engine.pause();
    expect(h.pendingTimers()).toBe(0);
    await h.advance(STALL_MS * 2);
    expect(h.states.at(-1)).toMatchObject({ phase: 'idle', incomplete: 0 });
  });

  it('play once with a short range (≤ 12 frames): frames before the start point are not required', () => {
    const h = harness(10, { loop: false });
    for (let i = 5; i < 10; i++) h.ready.add(i);
    h.engine.play(5);
    expect(h.states.at(-1)).toMatchObject({ phase: 'playing', incomplete: 0 });
  });

  it('play once (route): frames after the last one are not required ahead', async () => {
    const h = harness(20, { loop: false });
    for (let i = 14; i < 20; i++) h.ready.add(i); // frames 0..13 are not cached (evicted / never needed again)
    h.engine.play(16);
    // 6 ahead of 16 would wrap to 0..2 — a single run never shows those
    expect(h.states.at(-1)?.phase).toBe('playing');
    await h.advance(4000);
    expect(h.label).toEqual([17, 18, 19]);
    expect(h.ended()).toBe(1);
  });
});
