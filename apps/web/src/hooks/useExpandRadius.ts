import { useEffect, useRef } from 'react';
import { useAppStore } from '../stores/appStore.ts';
import { nextRadiusStep } from '../utils/radiusSteps.ts';
import { useFinder } from './useFinder.ts';

/**
 * "Expand radius" for the weather finder: raises the search radius to the next
 * slider stop and re-runs the search (results are fetched for the radius, so
 * growing it needs a fresh lookup). `nextKm` is null at the maximum.
 */
export function useExpandRadius() {
  const searchRadiusKm = useAppStore((s) => s.searchRadiusKm);
  const setSearchRadiusKm = useAppStore((s) => s.setSearchRadiusKm);
  const { run } = useFinder();
  const rerunPending = useRef(false);

  // `run` closes over the radius, so re-run only after the new value has rendered.
  useEffect(() => {
    if (!rerunPending.current) return;
    rerunPending.current = false;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchRadiusKm]);

  const nextKm = nextRadiusStep(searchRadiusKm);

  function expand() {
    if (nextKm === null) return;
    rerunPending.current = true;
    setSearchRadiusKm(nextKm);
  }

  return { nextKm, expand };
}
