import { useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '../stores/appStore.ts';
import type { OptimizerWorkerInput, OptimizerWorkerOutput, SearchAreaSpec } from '../workers/optimizer.worker.ts';

export function useOptimizer() {
  const workerRef = useRef<Worker | null>(null);
  const { searchAreas, searchArea, searchRadiusKm, tripConfig, setMode, setLoadingStep, setRoute, setError } =
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
    const placeAreas = searchAreas.filter((a) => a.type === 'place');
    const usesPinnedMode = placeAreas.length > 1 &&
      placeAreas.every((a) => 'lat' in a && a.lat !== undefined);

    const singlePlace = searchAreas.length === 1 && searchAreas[0].type === 'place';

    for (const area of searchAreas) {
      if (area.type === 'place') {
        if (usesPinnedMode && 'lat' in area && area.lat !== undefined) {
          specs.push({ type: 'pinned', lat: area.lat, lng: area.lng, name: area.name });
        } else if (singlePlace && 'lat' in area && area.lat !== undefined) {
          // Single place: use radius slider to define the search area, not the raw Nominatim bbox
          const lat = area.lat;
          const lng = area.lng ?? 0;
          const dLat = searchRadiusKm / 111;
          const dLng = searchRadiusKm / (111 * Math.cos((lat * Math.PI) / 180));
          specs.push({ type: 'place', bbox: [lng - dLng, lat - dLat, lng + dLng, lat + dLat] });
        } else if (area.bbox) {
          specs.push({ type: 'place', bbox: area.bbox });
        }
      } else if (area.type === 'polygon' && 'polygon' in area) {
        specs.push({ type: 'polygon', polygon: area.polygon as [number, number][] });
      } else if (area.type === 'radius' && 'centerLat' in area) {
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
      const firstPlace = searchAreas.find((a) => a.type === 'place' && 'lat' in a && a.lat !== undefined);
      if (firstPlace && 'lat' in firstPlace && firstPlace.lat !== undefined) {
        startLat = firstPlace.lat;
        startLng = firstPlace.lng ?? null;
      }
    }

    // Fallback: legacy single searchArea (polygon draw from map)
    if (specs.length === 0 && searchArea) {
      if (searchArea.type === 'polygon' && searchArea.polygon) {
        specs.push({ type: 'polygon', polygon: searchArea.polygon as [number, number][] });
      } else if (searchArea.bbox) {
        specs.push({ type: 'place', bbox: searchArea.bbox });
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
        console.error('[optimizer] worker error:', msg.message);
        setError(msg.message);
        setMode('idle');
        setLoadingStep(null);
      }
    };

    workerRef.current.onerror = (err) => {
      console.error('[optimizer] worker onerror:', err);
      setError(err.message ?? 'Worker error');
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
        preset: tripConfig.preset,
        startLat,
        startLng,
        mustVisitCoords: tripConfig.mustVisitCoords,
      },
    };

    workerRef.current.postMessage(input);
  }, [searchAreas, searchArea, searchRadiusKm, tripConfig, setMode, setLoadingStep, setRoute, setError]);

  return { run };
}
