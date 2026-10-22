import { describe, it, expect } from 'vitest';
import { bufferTarget, PlaybackEngine, type PlaybackState } from './playbackEngine.ts';

/** Deterministic harness: manual clock + timers, frames become ready on demand. */
function harness(total: number, opts: { showMs?: number } = {}) {
  let t = 0;
  const timers: Array<{ at: number; fn: () => void }> = [];
  const ready = new Set<number>();
  const label: number[] = []; // order of shown frames = what the label displays
  const states: PlaybackState[] = [];
  const intervals: number[] = [];
  const engine = new PlaybackEngine({
    count: () => total,
    isReady: (i) => ready.has(i),
    pump: () => {},
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
  return { engine, ready, label, states, intervals, advance, now: () => t };
}

describe('bufferTarget', () => {
  it('needs all frames for short loops, 6 ahead for long ones', () => {
    expect(bufferTarget(12)).toBe(11);
    expect(bufferTarget(24)).toBe(6);
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
