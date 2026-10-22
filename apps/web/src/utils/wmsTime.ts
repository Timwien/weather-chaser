// Pure helpers for WMS time dimensions (GetCapabilities <Dimension name="time">).
// Formats seen at DWD: "2026-10-21T03:00:00.000Z/2026-10-29T12:00:00.000Z/PT3H"
// (start/end/period) and comma lists of instants and/or ranges.

export type TimeAxis =
  | { kind: 'range'; start: number; end: number; stepMs: number }
  | { kind: 'list'; times: number[] };

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** ISO-8601 duration (PnDTnHnMnS) → ms. Returns null for anything unparseable. */
export function parseIsoDuration(s: string): number | null {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(s.trim());
  if (!m || s.trim() === 'P' || s.trim().endsWith('T')) return null;
  const [, d, h, mi, sec] = m;
  const ms = (Number(d ?? 0) * DAY) + (Number(h ?? 0) * HOUR) + (Number(mi ?? 0) * MIN) + (Number(sec ?? 0) * 1000);
  return ms > 0 ? ms : null;
}

function parseInstant(s: string): number | null {
  const t = Date.parse(s.trim());
  return Number.isFinite(t) ? t : null;
}

/** Parses the text content of a WMS time Dimension. Null when nothing usable is found. */
export function parseTimeDimension(raw: string): TimeAxis | null {
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  // single range → keep compact
  if (parts.length === 1 && parts[0].includes('/')) {
    const [a, b, p] = parts[0].split('/');
    const start = parseInstant(a ?? '');
    const end = parseInstant(b ?? '');
    const stepMs = p ? parseIsoDuration(p) : null;
    if (start === null || end === null || end < start) return null;
    if (!stepMs) return { kind: 'list', times: start === end ? [start] : [start, end] };
    return { kind: 'range', start, end, stepMs };
  }

  const times = new Set<number>();
  for (const part of parts) {
    if (part.includes('/')) {
      const sub = parseTimeDimension(part);
      if (sub) for (const t of axisTimes(sub)) times.add(t);
    } else {
      const t = parseInstant(part);
      if (t !== null) times.add(t);
    }
  }
  if (times.size === 0) return null;
  return { kind: 'list', times: [...times].sort((x, y) => x - y) };
}

/**
 * Extracts the time Dimension from a capabilities document. With `layerName`
 * and a multi-layer document, only the block of that layer is searched.
 */
export function extractTimeDimension(xml: string, layerName?: string): TimeAxis | null {
  let scope = xml;
  if (layerName) {
    const idx = xml.indexOf(`<Name>${layerName}</Name>`);
    if (idx >= 0) {
      const end = xml.indexOf('</Layer>', idx);
      scope = xml.slice(idx, end > idx ? end : undefined);
    }
  }
  const m = /<Dimension\b[^>]*\bname="time"[^>]*>([^<]*)<\/Dimension>/i.exec(scope);
  return m ? parseTimeDimension(m[1]) : null;
}

export function axisStart(a: TimeAxis): number {
  return a.kind === 'range' ? a.start : a.times[0];
}
export function axisEnd(a: TimeAxis): number {
  if (a.kind === 'list') return a.times[a.times.length - 1];
  // last grid point at or before end
  return a.start + Math.floor((a.end - a.start) / a.stepMs) * a.stepMs;
}

/** All instants of the axis (capped to avoid runaway expansion). */
export function axisTimes(a: TimeAxis, cap = 5000): number[] {
  if (a.kind === 'list') return a.times.slice(0, cap);
  const out: number[] = [];
  for (let t = a.start; t <= a.end && out.length < cap; t += a.stepMs) out.push(t);
  return out;
}

export function axisContains(a: TimeAxis, t: number): boolean {
  return t >= axisStart(a) && t <= axisEnd(a);
}

/** Nearest instant of the axis to t (ties → earlier). Always inside the axis. */
export function snapToAxis(a: TimeAxis, t: number): number {
  if (a.kind === 'range') {
    const clamped = Math.min(Math.max(t, a.start), axisEnd(a));
    const k = Math.round((clamped - a.start) / a.stepMs);
    return Math.min(a.start + k * a.stepMs, axisEnd(a));
  }
  let best = a.times[0];
  for (const x of a.times) if (Math.abs(x - t) < Math.abs(best - t)) best = x;
  return best;
}

/** Latest instant ≤ t (clamped to the axis start). */
export function floorOnAxis(a: TimeAxis, t: number): number {
  if (a.kind === 'range') {
    const clamped = Math.min(Math.max(t, a.start), axisEnd(a));
    return a.start + Math.floor((clamped - a.start) / a.stepMs) * a.stepMs;
  }
  let best = a.times[0];
  for (const x of a.times) if (x <= t) best = x;
  return best;
}

/**
 * Radar animation frames: the last `spanMs` up to "now" (latest available
 * instant ≤ nowMs), every `stepMs`, oldest first, never before the axis start.
 */
export function radarFrames(a: TimeAxis, nowMs: number, spanMs = 2 * HOUR, stepMs = 10 * MIN): number[] {
  const latest = floorOnAxis(a, nowMs);
  const start = axisStart(a);
  const out: number[] = [];
  for (let t = latest; t >= latest - spanMs && t >= start; t -= stepMs) out.unshift(t);
  return out;
}

/** Local calendar day key YYYY-MM-DD of an instant. */
export function localDayKey(t: number): string {
  const d = new Date(t);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** [startOfDay, startOfNextDay) in local time for a YYYY-MM-DD key. */
export function localDayBounds(key: string): [number, number] {
  const [y, m, d] = key.split('-').map(Number);
  return [new Date(y, m - 1, d).getTime(), new Date(y, m - 1, d + 1).getTime()];
}

/** Axis instants that fall on the given local day. */
export function timesOnLocalDay(a: TimeAxis, key: string): number[] {
  const [from, to] = localDayBounds(key);
  return axisTimes(a).filter((t) => t >= from && t < to);
}

/** Merges two axes into one covering both (as an explicit list). */
export function mergeAxes(a: TimeAxis, b: TimeAxis): TimeAxis {
  const set = new Set([...axisTimes(a), ...axisTimes(b)]);
  return { kind: 'list', times: [...set].sort((x, y) => x - y) };
}
