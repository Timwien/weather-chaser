import { describe, it, expect } from 'vitest';
import { createRateLimiter } from './rateLimit.js';

const MIN = 60 * 1000;

describe('createRateLimiter', () => {
  it('allows max hits per window, then refuses', () => {
    const limited = createRateLimiter({ windowMs: 10 * MIN, max: 5 });
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) expect(limited('1.2.3.4', t0 + i)).toBe(false);
    expect(limited('1.2.3.4', t0 + 10)).toBe(true);
    expect(limited('5.6.7.8', t0 + 10)).toBe(false); // other keys unaffected
    expect(limited('1.2.3.4', t0 + 10 * MIN + 10)).toBe(false); // window passed
  });

  it('prunes keys whose window has passed, so IPs do not accumulate', () => {
    const limited = createRateLimiter({ windowMs: 10 * MIN, max: 5 });
    const t0 = 1_000_000;
    for (let i = 0; i < 100; i++) limited(`10.0.0.${i}`, t0);
    expect(limited.size()).toBe(100);
    limited('9.9.9.9', t0 + 11 * MIN); // next request after the window triggers pruning
    expect(limited.size()).toBe(1);
  });

  it('keeps keys that are still inside the window', () => {
    const limited = createRateLimiter({ windowMs: 10 * MIN, max: 5 });
    const t0 = 1_000_000;
    limited('old', t0);
    limited('recent', t0 + 9 * MIN);
    limited('trigger', t0 + 11 * MIN);
    expect(limited.size()).toBe(2); // 'old' pruned; 'recent' and 'trigger' kept
  });
});
