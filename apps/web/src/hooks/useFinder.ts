import { useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Town } from '@weatherchaser/core';
import { useAppStore, isLocatedPlace, isPolygonArea, isRadiusArea } from '../stores/appStore.ts';
import { getFinderMode } from '../utils/finderMode.ts';
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

    // Detect mode from searchAreas (polygon wins over named places)
    let input: FinderWorkerInput;
    const mode = getFinderMode(searchAreas);

    if (mode === 'polygon') {
      const polygonArea = searchAreas.find(isPolygonArea)!;
      input = {
        type: 'run',
        config: {
          mode: 'polygon',
          polygon: polygonArea.polygon as [number, number][],
          startDate,
          endDate,
          granularity: searchGranularity,
          lang: i18n.language,
        },
      };
    } else if (mode === 'multi-place') {
      // Several named places — score them directly, skip the place lookup
      const towns: Town[] = searchAreas.filter(isLocatedPlace).map((a) => ({
        id: a.id,
        name: a.name,
        lat: a.lat,
        lng: a.lng,
      }));
      input = { type: 'run', config: { mode: 'multi-place', towns, startDate, endDate } };
    } else {
      // Single place or radius: places within the radius around it
      const area = searchAreas[0];
      const origin = isLocatedPlace(area)
        ? { lat: area.lat, lng: area.lng }
        : isRadiusArea(area)
          ? { lat: area.centerLat, lng: area.centerLng }
          : null;

      if (!origin) {
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
          startLat: origin.lat,
          startLng: origin.lng,
          radiusKm: searchRadiusKm,
          startDate,
          endDate,
          granularity: searchGranularity,
          lang: i18n.language,
        },
      };
    }

    worker.postMessage(input);
  }, [searchAreas, searchRadiusKm, searchGranularity, tripConfig, i18n.language, setFinderLoading, setFinderError, setFinderData, clearFinderData]);

  return { run };
}
