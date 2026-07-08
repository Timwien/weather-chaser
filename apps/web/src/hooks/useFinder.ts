import { useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Town } from '@weatherchaser/core';
import { useAppStore } from '../stores/appStore.ts';
import { useFeedbackStore } from '../stores/feedbackStore.ts';
import { recordSearch, buildSearchConfigFromStore } from '../services/savedSearch.ts';
import { capture } from '../lib/analytics.ts';
import { logError } from '../lib/logger.ts';
import type { FinderWorkerInput, FinderWorkerOutput } from '../workers/finder.worker.ts';
import type { HourlyWeatherData } from '../services/weatherHourly.ts';

export function useFinder() {
  const { i18n } = useTranslation();
  const workerRef = useRef<Worker | null>(null);
  const {
    searchAreas,
    searchRadiusKm,
    searchGranularity,
    tripConfig,
    setFinderLoading,
    setFinderError,
    setFinderData,
    clearFinderData,
  } = useAppStore();

  const run = useCallback(() => {
    const { startDate, endDate } = tripConfig;

    if (!startDate || !endDate) {
      setFinderError('missing_config');
      return;
    }

    if (searchAreas.length === 0) {
      setFinderError('no_location');
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

    const t0 = performance.now();
    capture('search_started', {
      kind: 'finder',
      areas_count: searchAreas.length,
      granularity: searchGranularity,
    });

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
        capture('search_completed', {
          kind: 'finder',
          duration_ms: Math.round(performance.now() - t0),
          result_count: msg.towns.length,
          granularity: searchGranularity,
        });
        // X3: record this completed search (fire-and-forget, guest/offline safe).
        void recordSearch('finder', buildSearchConfigFromStore());
        // Feedback prompt: counts successful searches, fires once after the 2nd.
        useFeedbackStore.getState().recordSearchSuccess();
        worker.terminate();
        workerRef.current = null;
      }
      if (msg.type === 'error') {
        logError('finder_worker', new Error(msg.code), { code: msg.code });
        capture('search_failed', {
          kind: 'finder',
          error_code: msg.code,
          duration_ms: Math.round(performance.now() - t0),
        });
        setFinderError(msg.code);
        setFinderLoading(false);
        worker.terminate();
        workerRef.current = null;
      }
    };

    worker.onerror = (err) => {
      logError('finder_worker_onerror', err.error ?? err.message ?? 'worker crashed');
      capture('search_failed', {
        kind: 'finder',
        error_code: 'unknown',
        duration_ms: Math.round(performance.now() - t0),
      });
      setFinderError('unknown');
      setFinderLoading(false);
      worker.terminate();
      workerRef.current = null;
    };

    // Detect mode from searchAreas
    let input: FinderWorkerInput;

    if (searchAreas.length > 1) {
      // Mode C: multiple named places — score them directly, skip Overpass
      const towns: Town[] = searchAreas
        .filter((a): a is Extract<typeof searchAreas[number], { type: 'place' }> =>
          a.type === 'place' &&
          typeof (a as { lat?: number }).lat === 'number' &&
          typeof (a as { lng?: number }).lng === 'number',
        )
        .map((a) => ({
          id: a.id,
          name: a.name,
          lat: (a as { lat: number }).lat,
          lng: (a as { lng: number }).lng,
        }));

      input = {
        type: 'run',
        config: {
          mode: 'multi-place',
          towns,
          startDate,
          endDate,
        },
      };
    } else {
      const area = searchAreas[0];
      if (area.type === 'polygon') {
        // Mode B: drawn polygon
        const polygon = area.polygon as [number, number][];
        input = {
          type: 'run',
          config: {
            mode: 'polygon',
            polygon,
            startDate,
            endDate,
            granularity: searchGranularity,
            lang: i18n.language,
          },
        };
      } else if (area.type === 'place' || area.type === 'radius') {
        // Mode A: single place + radius
        const lat = area.type === 'place'
          ? (area as { lat?: number }).lat
          : (area as { centerLat: number }).centerLat;
        const lng = area.type === 'place'
          ? (area as { lng?: number }).lng
          : (area as { centerLng: number }).centerLng;

        if (lat === undefined || lat === null || lng === undefined || lng === null) {
          setFinderError('missing_config');
          setFinderLoading(false);
          worker.terminate();
          workerRef.current = null;
          return;
        }

        input = {
          type: 'run',
          config: {
            mode: 'around',
            startLat: lat,
            startLng: lng,
            radiusKm: searchRadiusKm,
            startDate,
            endDate,
            granularity: searchGranularity,
            lang: i18n.language,
          },
        };
      } else {
        setFinderError('missing_config');
        setFinderLoading(false);
        worker.terminate();
        workerRef.current = null;
        return;
      }
    }

    worker.postMessage(input);
  }, [searchAreas, searchRadiusKm, searchGranularity, tripConfig, i18n.language, setFinderLoading, setFinderError, setFinderData, clearFinderData]);

  return { run };
}
