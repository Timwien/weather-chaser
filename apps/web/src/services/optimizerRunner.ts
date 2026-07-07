// Module-level route-optimizer runner. Previously this lived in the
// useOptimizer hook, whose worker ref died with its host component's unmount —
// which is why it had to be hoisted into EntryPanel. As a module singleton the
// worker survives any mode change, so the route can ALSO be recomputed from the
// results view (itinerary re-weighting) where EntryPanel is unmounted.

import i18n from '../i18n/index.ts';
import { useAppStore, isPlaceArea, isPolygonArea, isRadiusArea, isLocatedPlace } from '../stores/appStore.ts';
import { recordSearch, buildSearchConfigFromStore } from './savedSearch.ts';
import type { OptimizerWorkerInput, OptimizerWorkerOutput, SearchAreaSpec } from '../workers/optimizer.worker.ts';

let worker: Worker | null = null;

function terminate() {
  worker?.terminate();
  worker = null;
}

/** Launch (or relaunch) the route optimization from the current store state. */
export function runOptimizer(): void {
  const s = useAppStore.getState();
  const { searchAreas, searchRadiusKm, searchGranularity, tripConfig, weatherPrefs } = s;

  if (!tripConfig.startDate) return;

  // Derive endDate if user only picked a start date
  let endDate = tripConfig.endDate;
  if (!endDate) {
    const start = new Date(tripConfig.startDate + 'T00:00:00');
    start.setDate(start.getDate() + tripConfig.totalDays - 1);
    const y = start.getFullYear();
    const m = String(start.getMonth() + 1).padStart(2, '0');
    const d = String(start.getDate()).padStart(2, '0');
    endDate = `${y}-${m}-${d}`;
  }

  // Build search area specs from the multi-area store
  const specs: SearchAreaSpec[] = [];

  // Multiple named places → pinned mode (only route through the exact entered cities)
  const placeAreas = searchAreas.filter(isPlaceArea);
  const usesPinnedMode = placeAreas.length > 1 && placeAreas.every(isLocatedPlace);

  const singlePlace = searchAreas.length === 1 && isPlaceArea(searchAreas[0]);

  for (const area of searchAreas) {
    if (isPlaceArea(area)) {
      if (usesPinnedMode && isLocatedPlace(area)) {
        specs.push({ type: 'pinned', lat: area.lat, lng: area.lng, name: area.name });
      } else if (singlePlace && isLocatedPlace(area)) {
        // Single place: use radius slider to define the search area, not the raw Nominatim bbox
        const lat = area.lat;
        const lng = area.lng;
        const dLat = searchRadiusKm / 111;
        const dLng = searchRadiusKm / (111 * Math.cos((lat * Math.PI) / 180));
        specs.push({ type: 'place', bbox: [lng - dLng, lat - dLat, lng + dLng, lat + dLat] });
      } else if (area.bbox) {
        specs.push({ type: 'place', bbox: area.bbox });
      }
    } else if (isPolygonArea(area)) {
      specs.push({ type: 'polygon', polygon: area.polygon as [number, number][] });
    } else if (isRadiusArea(area)) {
      // Approximate radius as bbox (centre ± radiusKm)
      const dLat = area.radiusKm / 111;
      const dLng = area.radiusKm / (111 * Math.cos((area.centerLat * Math.PI) / 180));
      specs.push({
        type: 'place',
        bbox: [
          area.centerLng - dLng,
          area.centerLat - dLat,
          area.centerLng + dLng,
          area.centerLat + dLat,
        ],
      });
    }
  }

  // If start location wasn't explicitly picked, derive from first place area
  let startLat = tripConfig.startLat;
  let startLng = tripConfig.startLng;
  if (startLat === null) {
    const firstPlace = searchAreas.find(isLocatedPlace);
    if (firstPlace) {
      startLat = firstPlace.lat;
      startLng = firstPlace.lng;
    }
  }

  if (specs.length === 0) return;

  terminate();
  worker = new Worker(
    new URL('../workers/optimizer.worker.ts', import.meta.url),
    { type: 'module' },
  );

  s.setMode('loading');
  s.setLoadingStep('finding_towns');
  s.setError(null);
  s.setRoute(null);
  // Remember the prefs this run uses — the itinerary panel compares against it
  // to know when a re-weight needs a recompute.
  s.setLastRoutePrefs({ ...weatherPrefs });

  worker.onmessage = (event: MessageEvent<OptimizerWorkerOutput>) => {
    const st = useAppStore.getState();
    const msg = event.data;
    if (msg.type === 'progress') {
      st.setLoadingStep(msg.step);
    } else if (msg.type === 'complete') {
      st.setRoute(msg.result);
      st.setMode('results');
      st.setLoadingStep(null);
      // X3: record this completed search (fire-and-forget, guest/offline safe).
      void recordSearch('route', buildSearchConfigFromStore());
      terminate();
    } else if (msg.type === 'error') {
      console.error('[optimizer] worker error:', msg.code);
      st.setError(msg.code);
      st.setMode('idle');
      st.setLoadingStep(null);
      terminate();
    }
  };

  worker.onerror = (err) => {
    const st = useAppStore.getState();
    console.error('[optimizer] worker onerror:', err);
    st.setError('unknown');
    st.setMode('idle');
    st.setLoadingStep(null);
    terminate();
  };

  const input: OptimizerWorkerInput = {
    type: 'run',
    searchAreas: specs,
    config: {
      startDate: tripConfig.startDate,
      endDate,
      totalDays: tripConfig.totalDays,
      maxStay: tripConfig.maxStay,
      preset: weatherPrefs.preset,
      startLat,
      startLng,
      mustVisitCoords: tripConfig.mustVisitCoords,
      customWeights: weatherPrefs.customWeights,
      granularity: searchGranularity,
      lang: i18n.language,
    },
  };

  worker.postMessage(input);
}
