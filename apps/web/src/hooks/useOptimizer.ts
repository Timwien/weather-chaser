import { useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '../stores/appStore.ts';
import type { OptimizerWorkerInput, OptimizerWorkerOutput, SearchAreaSpec } from '../workers/optimizer.worker.ts';

export function useOptimizer() {
  const workerRef = useRef<Worker | null>(null);
  const { searchAreas, searchArea, tripConfig, setMode, setLoadingStep, setRoute, setError } =
    useAppStore();

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const run = useCallback(() => {
    if (!tripConfig.startDate || !tripConfig.endDate) return;

    // Build search area specs from the multi-area store
    const specs: SearchAreaSpec[] = [];

    for (const area of searchAreas) {
      if (area.type === 'place' && 'bbox' in area && area.bbox) {
        specs.push({ type: 'place', bbox: area.bbox });
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
        endDate: tripConfig.endDate,
        totalDays: tripConfig.totalDays,
        maxStay: tripConfig.maxStay,
        preset: tripConfig.preset,
        startLat: tripConfig.startLat,
        startLng: tripConfig.startLng,
        mustVisitCoords: tripConfig.mustVisitCoords,
      },
    };

    workerRef.current.postMessage(input);
  }, [searchAreas, searchArea, tripConfig, setMode, setLoadingStep, setRoute, setError]);

  return { run };
}
