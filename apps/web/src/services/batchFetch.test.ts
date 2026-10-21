import { describe, it, expect, vi } from 'vitest';
import { fetchInBatches } from './batchFetch.ts';
import { parseRetryAfterMs } from './fetchRetry.ts';

const ids = (n: number) => Array.from({ length: n }, (_, i) => i);

describe('fetchInBatches', () => {
  it('limits concurrency to 3 and returns everything in order', async () => {
    let inFlight = 0;
    let peak = 0;
    const res = await fetchInBatches(ids(500), async (items) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return items;
    });
    expect(peak).toBe(3);
    expect(res).toEqual(ids(500));
  });

  it('splits a failing batch once and drops only the failing half', async () => {
    const calls: number[] = [];
    const res = await fetchInBatches(ids(100), async (items) => {
      calls.push(items.length);
      if (items.includes(70)) throw new Error('HTTP 503'); // always fails when 70 is in
      return items;
    });
    // 100 → batches [0-49] ok, [50-99] fails → halves [50-74] fails (has 70), [75-99] ok
    expect(res).toHaveLength(75);
    expect(res).not.toContain(70);
    expect(calls.filter((n) => n === 50)).toHaveLength(2); // original batches
    expect(Math.max(...calls.filter((_, i) => i > 2))).toBeLessThanOrEqual(25); // single split level
  });

  it('throws only when nothing succeeded', async () => {
    await expect(fetchInBatches(ids(10), async () => { throw new Error('HTTP 500'); })).rejects.toThrow('HTTP 500');
  });

  it('stops starting requests after the budget and returns what it has', async () => {
    vi.useFakeTimers();
    const start = Date.now();
    let started = 0;
    const p = fetchInBatches(
      ids(400),
      async (items) => {
        started++;
        await new Promise((r) => setTimeout(r, 400));
        return items;
      },
      { budgetMs: 1000, concurrency: 1, batchSize: 50 },
    );
    await vi.advanceTimersByTimeAsync(5000);
    const res = await p;
    expect(started).toBeLessThan(8);
    expect(res.length).toBeGreaterThan(0);
    expect(Date.now() - start).toBeLessThan(6000);
    vi.useRealTimers();
  });
});

describe('parseRetryAfterMs', () => {
  it('parses seconds and dates', () => {
    expect(parseRetryAfterMs('3')).toBe(3000);
    expect(parseRetryAfterMs(null)).toBeNull();
    expect(parseRetryAfterMs('garbage')).toBeNull();
    const now = Date.parse('2026-10-21T10:00:00Z');
    expect(parseRetryAfterMs('Wed, 21 Oct 2026 10:00:05 GMT', now)).toBe(5000);
  });
});
