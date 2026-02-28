import { useState, useCallback, useRef } from 'react';
import { searchPlace, type NominatimResult } from '../services/nominatim.ts';

const DEBOUNCE_MS = 500;
const cache = new Map<string, NominatimResult[]>();

export function useLocationSearch() {
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((query: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }

    timerRef.current = setTimeout(async () => {
      const cacheKey = query.toLowerCase().trim();
      if (cache.has(cacheKey)) {
        setResults(cache.get(cacheKey)!);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await searchPlace(query);
        cache.set(cacheKey, data);
        setResults(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Search failed');
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
  }, []);

  return { search, results, loading, error };
}
