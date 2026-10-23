// Naive in-memory per-key rate limit (used with the client IP by /api/feedback).
// Module-level state is per-serverless-instance only — a soft beta guard, not a
// hard boundary (documented risk; upgrade to Turnstile/KV if abused).
//
// Privacy (policy § 11): keys live only in memory, are never written anywhere,
// and are pruned once their window has passed, so IPs don't pile up in a warm
// instance.

export interface RateLimiter {
  /** true = over the limit (request must be refused). Records the hit otherwise. */
  (key: string, now?: number): boolean;
  /** Number of keys currently held in memory (tests/diagnostics). */
  size: () => number;
}

export function createRateLimiter(opts: { windowMs: number; max: number; pruneEveryMs?: number }): RateLimiter {
  const { windowMs, max } = opts;
  const pruneEveryMs = opts.pruneEveryMs ?? 60 * 1000;
  const hits = new Map<string, number[]>();
  let lastPrune = 0;

  function prune(now: number): void {
    if (now - lastPrune < pruneEveryMs) return;
    lastPrune = now;
    for (const [key, list] of hits) {
      if (list.length === 0 || now - list[list.length - 1] >= windowMs) hits.delete(key);
    }
  }

  const limited = ((key: string, now: number = Date.now()): boolean => {
    prune(now);
    const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (list.length >= max) {
      hits.set(key, list);
      return true;
    }
    list.push(now);
    hits.set(key, list);
    return false;
  }) as RateLimiter;
  limited.size = () => hits.size;
  return limited;
}
