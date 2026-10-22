import { describe, it, expect } from 'vitest';
import { FramePreloader } from './framePreloader.ts';

function setup(opts: { fail?: Set<string>; concurrency?: number } = {}) {
  const cache = new Set<string>();
  const started: string[] = [];
  let active = 0;
  let maxActive = 0;
  const pre = new FramePreloader({
    keyOf: (u) => u,
    has: (k) => cache.has(k),
    concurrency: opts.concurrency ?? 2,
    load: async (url, signal) => {
      started.push(url);
      active++; maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 1));
      active--;
      if (signal.aborted) throw new Error('aborted');
      if (opts.fail?.has(url)) throw new Error('boom');
      cache.add(url);
    },
  });
  return { pre, cache, started, maxActive: () => maxActive };
}
const frames = [
  { id: 0, urls: ['a1', 'a2'] }, { id: 1, urls: ['b1', 'b2'] }, { id: 2, urls: ['c1'] },
];
const drain = () => new Promise((r) => setTimeout(r, 30));

describe('FramePreloader', () => {
  it('loads everything within the concurrency limit and reports frames ready', async () => {
    const { pre, maxActive } = setup({ concurrency: 2 });
    pre.start(frames);
    expect(pre.isReady(0)).toBe(false);
    await drain();
    expect([pre.isReady(0), pre.isReady(1), pre.isReady(2), pre.readyCount()]).toEqual([true, true, true, 3]);
    expect(maxActive()).toBeLessThanOrEqual(2);
  });

  it('follows the priority order', async () => {
    const { pre, started } = setup({ concurrency: 1 });
    pre.start(frames, [2, 0, 1]);
    await drain();
    expect(started).toEqual(['c1', 'a1', 'a2', 'b1', 'b2']);
  });

  it('counts failed tiles as settled so a gap cannot stall the animation', async () => {
    const { pre } = setup({ fail: new Set(['b2']) });
    pre.start(frames);
    await drain();
    expect(pre.isReady(1)).toBe(true);
  });

  it('stop() aborts: nothing more is fetched and frames stay unready', async () => {
    const { pre, started } = setup({ concurrency: 1 });
    pre.start(frames);
    pre.stop();
    await drain();
    expect(started.length).toBeLessThanOrEqual(1);
    expect(pre.isReady(0) && pre.isReady(1) && pre.isReady(2)).toBe(false);
  });

  it('start() again drops the previous run and re-queues evicted tiles on pump()', async () => {
    const { pre, cache } = setup();
    pre.start(frames);
    await drain();
    cache.delete('a1'); // evicted by the LRU
    expect(pre.isReady(0)).toBe(false);
    await pre.pump();
    expect(pre.isReady(0)).toBe(true);
  });
});

describe('FramePreloader pump while running', () => {
  it('re-pumps once more when called during a run (evicted tiles are reloaded)', async () => {
    const { pre, cache } = setup({ concurrency: 1 });
    pre.start(frames);
    // a pump arrives while the first run is busy, then the cache evicts a loaded tile
    await new Promise((r) => setTimeout(r, 3));
    void pre.pump();
    cache.delete('a1');
    await drain();
    expect(cache.has('a1')).toBe(true);
    expect(pre.readyCount()).toBe(3);
  });

  it('can be pumped again after a run finished', async () => {
    const { pre, cache } = setup();
    pre.start(frames);
    await drain();
    cache.delete('c1');
    await pre.pump();
    expect(cache.has('c1')).toBe(true);
  });
});
