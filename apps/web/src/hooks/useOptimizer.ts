import { useCallback, useEffect, useRef } from 'react';
import { useAppStore, isPlaceArea, isPolygonArea, isRadiusArea, isLocatedPlace } from '../stores/appStore.ts';
import type { OptimizerWorkerInput, OptimizerWorkerOutput, SearchAreaSpec } from '../workers/optimizer.worker.ts';

export function useOptimizer() {
  const workerRef = useRef<Worker | null>(null);
  const { searchAreas, searchRadiusKm, searchGranularity, tripConfig, weatherPrefs, setMode, setLoadingStep, setRoute, setError } =
    useAppStore();

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const run = useCallback(() => {
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

    workerRef.current?.terminate();
    workerRef.current = new Worker(
      new URL('../workers/optimizer.worker.ts', import.meta.url),
      { type: 'module' },
    );

    setMode('loading');
    setLoadingStep('finding_towns');
    setError(null);
    setRoute(null);

    workerRef.current.onmessage = (event: MessageEvent<OptimizerWorkerOutput>) => {
      const msg = event.data;
      if (msg.type === 'progress') {
        setLoadingStep(msg.step);
      } else if (msg.type === 'complete') {
        setRoute(msg.result);
        setMode('results');
        setLoadingStep(null);
      } else if (msg.type === 'error') {
        console.error('[optimizer] worker error:', msg.code);
        setError(msg.code);
        setMode('idle');
        setLoadingStep(null);
      }
    };

    workerRef.current.onerror = (err) => {
      console.error('[optimizer] worker onerror:', err);
      setError('unknown');
      setMode('idle');
      setLoadingStep(null);
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
      },
    };

    workerRef.current.postMessage(input);
  }, [searchAreas, searchRadiusKm, searchGranularity, tripConfig, weatherPrefs, setMode, setLoadingStep, setRoute, setError]);

  return { run };
}
