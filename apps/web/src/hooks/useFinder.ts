import { useRef, useCallback } from 'react';
import { useAppStore } from '../stores/appStore.ts';
import type { FinderWorkerInput, FinderWorkerOutput } from '../workers/finder.worker.ts';
import type { HourlyWeatherData } from '../services/weatherHourly.ts';

export function useFinder() {
  const workerRef = useRef<Worker | null>(null);
  const {
    finderConfig,
    tripConfig,
    setFinderLoading,
    setFinderError,
    setFinderData,
    clearFinderData,
  } = useAppStore();

  const run = useCallback(() => {
    const { startLat, startLng, radiusKm } = finderConfig;
    const { startDate, endDate } = tripConfig;

    if (startLat === null || startLng === null || !startDate || !endDate) {
      setFinderError('missing_config');
      return;
    }

    // Terminate any existing worker
    workerRef.current?.terminate();

    const worker = new Worker(
      new URL('../workers/finder.worker.ts', import.meta.url),
      { type: 'module' },
    );
    workerRef.current = worker;

    clearFinderData();
    setFinderLoading(true);
    setFinderError(null);

    worker.onmessage = (event: MessageEvent<FinderWorkerOutput>) => {
      const msg = event.data;
      if (msg.type === 'progress') {
        // progress messages are informational — finderLoading remains true
        return;
      }
      if (msg.type === 'complete') {
        // Convert hourlyData array to a Record<townId, HourlyWeather> for O(1) lookup
        const cache: Record<string, HourlyWeatherData['hourly']> = {};
        for (const entry of msg.hourlyData) {
          cache[entry.townId] = entry.hourly;
        }
        setFinderData(msg.towns, cache);
        worker.terminate();
        workerRef.current = null;
      }
      if (msg.type === 'error') {
        setFinderError(msg.message);
        setFinderLoading(false);
        worker.terminate();
        workerRef.current = null;
      }
    };

    worker.onerror = (e) => {
      setFinderError(e.message ?? 'worker_error');
      setFinderLoading(false);
      worker.terminate();
      workerRef.current = null;
    };

    const input: FinderWorkerInput = {
      type: 'run',
      config: {
        startLat,
        startLng,
        radiusKm,
        startDate,
        endDate,
      },
    };
    worker.postMessage(input);
  }, [finderConfig, tripConfig, setFinderLoading, setFinderError, setFinderData, clearFinderData]);

  return { run };
}
