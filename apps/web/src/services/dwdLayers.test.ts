import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLayerAxis, hasImage, LAYER_NAMES } from './dwdLayers.ts';

const sig = new AbortController().signal;
afterEach(() => vi.unstubAllGlobals());
const resp = (status: number, ct: string) => ({ status, ok: status < 400, headers: { get: (): string => ct } });

describe('hasImage', () => {
  it('true for 200 + image, false for 200 + XML (no data)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(resp(200, 'image/png')).mockResolvedValueOnce(resp(200, 'text/xml')));
    expect(await hasImage('L', 0, sig)).toBe(true);
    expect(await hasImage('L', 0, sig)).toBe(false);
  });
  it.each([429, 500, 503])('throws on HTTP %i instead of reporting no data', async (st) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resp(st, 'text/html')));
    await expect(hasImage('L', 0, sig)).rejects.toThrow();
  });
  it('throws on network errors and aborts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(hasImage('L', 0, sig)).rejects.toThrow();
    const c = new AbortController(); c.abort();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError')));
    await expect(hasImage('L', 0, c.signal)).rejects.toThrow();
  });
});

describe('getLayerAxis', () => {
  it('keeps the previous axis when the probe fails (no wrong boundary cached)', async () => {
    const layer = LAYER_NAMES.pastEu;
    const xml = `<Layer><Name>${layer}</Name><Dimension name="time">2026-10-22T00:00:00Z/2026-10-22T03:00:00Z/PT1H</Dimension></Layer>`;
    let probeStatus = 200;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (
      url.includes('GetCapabilities')
        ? { status: 200, ok: true, text: async () => xml, headers: { get: (): string => "text/xml" } }
        : resp(probeStatus, 'image/png')
    )));
    const good = await getLayerAxis(layer, true);
    probeStatus = 503;
    const after = await getLayerAxis(layer, true);
    expect(after).toEqual(good);
  });
});
