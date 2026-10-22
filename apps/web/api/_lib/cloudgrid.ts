// Pure logic of GET /api/cloudgrid — cloud-cover lattice tiles from Open-Meteo.
//
// Lattice convention (shared with src/services/cloudGrid.ts):
//   * A tile is 8×8 lattice points. Tile edge = 8 × step degrees; tiles are
//     anchored at 0°/0° (lat0, lng0 are multiples of the tile edge).
//   * Points sit on the lattice CORNERS: lat = lat0 + row × step,
//     lng = lng0 + col × step (row 0 = south, col 0 = west, rows/cols 0..7).
//     The tile's last point is therefore one step short of the next tile's first
//     point — a client that holds the neighbouring tile interpolates seamlessly.
//   * Values are hour-major: values[hour × 64 + row × 8 + col], one byte each
//     (cloud cover 0..100 %).

export const GRID_N = 8;
export const STEPS = [1, 0.5, 0.25] as const;
export const LAT_RANGE = [30, 72] as const;
export const LNG_RANGE = [-25, 45] as const;
export const FORECAST_DAYS = 7;

const ALLOWED_PARAMS = new Set(['step', 'lat0', 'lng0']);
const NUMBER_RE = /^-?\d{1,3}(\.\d{1,4})?$/;

export interface CloudGridQuery { step: number; lat0: number; lng0: number }

export type ParseResult = { ok: true; query: CloudGridQuery } | { ok: false; error: string };

export function parseCloudGridQuery(params: URLSearchParams): ParseResult {
  for (const key of params.keys()) {
    if (!ALLOWED_PARAMS.has(key)) return { ok: false, error: `unknown parameter: ${key}` };
    if (params.getAll(key).length > 1) return { ok: false, error: `duplicate parameter: ${key}` };
  }
  const stepRaw = params.get('step');
  const step = STEPS.find((s) => String(s) === stepRaw);
  if (step === undefined) return { ok: false, error: 'step must be one of 1, 0.5, 0.25' };

  const num = (name: string): number | null => {
    const raw = params.get(name);
    return raw !== null && NUMBER_RE.test(raw) ? Number(raw) : null;
  };
  const lat0 = num('lat0');
  const lng0 = num('lng0');
  if (lat0 === null || lng0 === null) return { ok: false, error: 'lat0 and lng0 are required numbers' };

  const edge = GRID_N * step;
  if (lat0 % edge !== 0 || lng0 % edge !== 0) {
    return { ok: false, error: `lat0 and lng0 must be multiples of the tile size ${edge}` };
  }
  // The tile must overlap the supported area (Europe + North Atlantic fringe).
  if (lat0 >= LAT_RANGE[1] || lat0 + edge <= LAT_RANGE[0] || lng0 >= LNG_RANGE[1] || lng0 + edge <= LNG_RANGE[0]) {
    return { ok: false, error: 'tile outside the supported area (lat 30..72, lng -25..45)' };
  }
  return { ok: true, query: { step, lat0, lng0 } };
}

/** The 64 lattice points in row-major order (row = latitude index, col = longitude index). */
export function latticePoints({ step, lat0, lng0 }: CloudGridQuery): { lat: number[]; lng: number[] } {
  const lat: number[] = [];
  const lng: number[] = [];
  for (let row = 0; row < GRID_N; row++) {
    for (let col = 0; col < GRID_N; col++) {
      lat.push(lat0 + row * step);
      lng.push(lng0 + col * step);
    }
  }
  return { lat, lng };
}

export function upstreamParams(q: CloudGridQuery): URLSearchParams {
  const { lat, lng } = latticePoints(q);
  return new URLSearchParams({
    latitude: lat.join(','),
    longitude: lng.join(','),
    hourly: 'cloud_cover',
    forecast_days: String(FORECAST_DAYS),
    timezone: 'GMT',
  });
}

export interface CloudGridPayload {
  /** ISO instant (UTC, full hour) of hour index 0 */
  start: string;
  hours: number;
  step: number;
  lat0: number;
  lng0: number;
  /** base64 of Uint8Array(hours × 64), hour-major */
  values: string;
}

/** Converts the Open-Meteo multi-location response; null when it does not have the expected shape. */
export function buildPayload(q: CloudGridQuery, raw: unknown): CloudGridPayload | null {
  const list = Array.isArray(raw) ? raw : [raw];
  if (list.length !== GRID_N * GRID_N) return null;
  type Loc = { hourly?: { time?: unknown; cloud_cover?: unknown } };
  const first = (list[0] as Loc)?.hourly;
  if (!first || !Array.isArray(first.time) || first.time.length === 0) return null;
  const hours = first.time.length;
  const out = new Uint8Array(hours * GRID_N * GRID_N);
  for (let p = 0; p < list.length; p++) {
    const series = (list[p] as Loc)?.hourly?.cloud_cover;
    if (!Array.isArray(series) || series.length !== hours) return null;
    for (let h = 0; h < hours; h++) {
      const v = Number(series[h]);
      out[h * GRID_N * GRID_N + p] = Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : 0;
    }
  }
  const startMs = Date.parse(`${String(first.time[0])}:00Z`);
  if (!Number.isFinite(startMs)) return null;
  return {
    start: new Date(startMs).toISOString(),
    hours,
    step: q.step,
    lat0: q.lat0,
    lng0: q.lng0,
    values: Buffer.from(out).toString('base64'),
  };
}
