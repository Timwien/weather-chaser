import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchJson = vi.fn();
vi.mock('./fetchRetry.ts', () => ({ fetchJsonWithRetry: (...a: unknown[]) => fetchJson(...a) }));

import { fetchTownsInRadius } from './places.ts';

describe('places request dedupe', () => {
  beforeEach(() => {
    fetchJson.mockReset();
    vi.stubGlobal('self', { location: { origin: 'http://localhost' } });
  });

  it('shares one request between concurrent identical lookups and caches the result', async () => {
    fetchJson.mockResolvedValue([{ id: 'gn-1', name: 'A', lat: 1, lng: 1, population: 20000 }]);
    const [a, b, c] = await Promise.all([
      fetchTownsInRadius(10.01, 20.02, 75, 'cities', 'de'),
      fetchTownsInRadius(10.01, 20.02, 75, 'cities', 'de'),
      fetchTownsInRadius(10.01, 20.02, 75, 'cities', 'de'),
    ]);
    expect(fetchJson).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(c).toHaveLength(1);
    await fetchTownsInRadius(10.01, 20.02, 75, 'cities', 'de');
    expect(fetchJson).toHaveBeenCalledTimes(1);
  });

  it('does not cache failures', async () => {
    fetchJson.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce([]);
    await expect(fetchTownsInRadius(30.01, 40.02, 75, 'cities', 'en')).rejects.toThrow('places_unavailable');
    await expect(fetchTownsInRadius(30.01, 40.02, 75, 'cities', 'en')).resolves.toEqual([]);
    expect(fetchJson).toHaveBeenCalledTimes(2);
  });
});
