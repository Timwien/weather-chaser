// M12: browser/Android Back from results returns to the entry form instead of
// leaving the app. Entering results pushes ONE history entry (marked in
// history.state, via the router's own history so TanStack stays in sync);
// a Back navigation onto an unmarked entry runs the same reset() as the in-app
// "Zurück". The in-app "Zurück" pops the entry again, so no double-back is needed.

import { useEffect, useRef } from 'react';
import { useRouter } from '@tanstack/react-router';
import { useAppStore } from '../stores/appStore.ts';

const MARK = 'wcResults';

const isMarked = (state: unknown): boolean =>
  !!state && typeof state === 'object' && (state as Record<string, unknown>)[MARK] === true;

export function useResultsHistory(): void {
  const router = useRouter();
  const mode = useAppStore((s) => s.mode);
  const hasFinderResults = useAppStore((s) => s.finderTowns !== null);

  const inResults = mode === 'results' || (mode === 'weather-finder' && hasFinderResults);
  // 'loading' (re-weighting from results) is neutral: the entry stays in place.
  const leaving =
    mode === 'idle' || mode === 'route-config' || (mode === 'weather-finder' && !hasFinderResults);

  const pushed = useRef(false);
  const poppedByBrowser = useRef(false);

  useEffect(() => {
    const history = router.history;
    if (inResults && !pushed.current) {
      pushed.current = true;
      history.push(history.location.href, { [MARK]: true });
    } else if (leaving && pushed.current) {
      pushed.current = false;
      if (poppedByBrowser.current) poppedByBrowser.current = false;
      else if (isMarked(history.location.state)) history.back();
    }
  }, [inResults, leaving, router]);

  useEffect(
    () =>
      router.history.subscribe(({ location, action }) => {
        if (action.type === 'PUSH' || action.type === 'REPLACE') return;
        if (pushed.current && !isMarked(location.state)) {
          poppedByBrowser.current = true;
          useAppStore.getState().reset();
        }
      }),
    [router],
  );
}
