import { describe, it, expect, beforeEach, vi } from 'vitest';

const captureError = vi.fn();
vi.mock('./analytics.ts', () => ({ captureError }));
const { logError, sanitizeError } = await import('./logger.ts');

describe('logger sanitising', () => {
  beforeEach(() => {
    captureError.mockClear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('never forwards message text or URLs', () => {
    const err = new TypeError('Failed to fetch https://x.test/api?place=Hamburg-Altona');
    logError('route_fetch', err, { place: 'Hamburg-Altona' });
    expect(captureError).toHaveBeenCalledTimes(1);
    const report = captureError.mock.calls[0][0];
    expect(report).toEqual({ scope: 'route_fetch', name: 'TypeError', hash: expect.stringMatching(/^[0-9a-f]{8}$/) });
    expect(JSON.stringify(report)).not.toMatch(/Hamburg|http/);
  });

  it('hashes deterministically and handles non-Error values', () => {
    expect(sanitizeError(new Error('a')).hash).toBe(sanitizeError(new Error('a')).hash);
    expect(sanitizeError(new Error('a')).hash).not.toBe(sanitizeError(new Error('b')).hash);
    expect(sanitizeError('Berlin broke').name).toBe('Error');
    expect(sanitizeError({ weird: 1 }).name).toBe('Error');
  });

  it('never throws', () => {
    captureError.mockImplementationOnce(() => { throw new Error('x'); });
    expect(() => logError('s', new Error('m'))).not.toThrow();
  });
});
