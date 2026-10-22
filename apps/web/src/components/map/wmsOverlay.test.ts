import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Map as MaplibreMap } from 'maplibre-gl';
import type { WmsFrame } from '../../services/dwdLayers.ts';

vi.mock('./wmsProtocol.ts', () => ({ registerWmsProtocol: () => Promise.resolve() }));
const { WmsOverlay } = await import('./wmsOverlay.ts');

/** MapLibre stand-in whose sources "load" without ever firing a sourcedata event (tiles dropped mid-flyTo). */
function silentMap() {
  const sources = new Set<string>();
  let loaded = false;
  const map = {
    on: vi.fn(), off: vi.fn(),
    getStyle: () => ({ layers: [] }),
    addSource: (id: string) => { sources.add(id); },
    getSource: (id: string) => (sources.has(id) ? {} : undefined),
    removeSource: (id: string) => { sources.delete(id); },
    addLayer: vi.fn(), removeLayer: vi.fn(), setPaintProperty: vi.fn(),
    getLayer: () => undefined,
    isSourceLoaded: () => loaded,
  } as unknown as MaplibreMap;
  return { map, finishLoading: () => { loaded = true; } };
}

const frame = { layer: 'Niederschlagsradar', time: '2026-10-22T10:00:00.000Z', format: 'image/png' } as WmsFrame;

describe('WmsOverlay.show', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('resolves once the source is loaded even if MapLibre fires no further sourcedata event', async () => {
    vi.useFakeTimers();
    const { map, finishLoading } = silentMap();
    const ov = new WmsOverlay(map, 'dwd-wx-test');
    let done = false;
    void ov.show(frame, 0.8).then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(500);
    expect(done).toBe(false);
    finishLoading();
    await vi.advanceTimersByTimeAsync(300); // far below the 12 s give-up timeout
    expect(done).toBe(true);
    ov.destroy();
  });
});
