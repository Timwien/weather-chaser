import { useState, useCallback, useRef } from 'react';
import { searchPlace, type NominatimResult } from '../services/nominatim.ts';

const DEBOUNCE_MS = 500;
const cache = new Map<string, NominatimResult[]>();

export function useLocationSearch() {
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // B3: request-id guard — two debounced fetches can resolve out of order,
  // letting a stale response overwrite newer results. Only the latest wins.
  const seq = useRef(0);

  const search = useCallback((query: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim()) {
      seq.current++;            // invalidate any in-flight request
      setResults([]);
      setLoading(false);
      return;
    }

    timerRef.current = setTimeout(async () => {
      const cacheKey = query.toLowerCase().trim();
      const mySeq = ++seq.current;
      if (cache.has(cacheKey)) {
        setResults(cache.get(cacheKey)!);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await searchPlace(query);
        cache.set(cacheKey, data);
        if (mySeq !== seq.current) return; // a newer query superseded this one
        setResults(data);
      } catch (e) {
        if (mySeq !== seq.current) return;
        setError(e instanceof Error ? e.message : 'Search failed');
      } finally {
        if (mySeq === seq.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
  }, []);

  // B3: after a selection the caller must be able to drop stale results so a
  // programmatic refocus can't reopen the dropdown with the old list.
  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    seq.current++;
    setResults([]);
    setLoading(false);
  }, []);

  return { search, clear, results, loading, error };
}
