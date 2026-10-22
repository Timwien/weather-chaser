// Pure route timetable: where is the camper at which instant of the trip?
//
// Assumptions (documented, also covered by tests):
//  - The first stop is reached on its arrival day at 12:00 local time (trip start).
//  - The camper stays until 10:00 local on the morning after the last night
//    (arrival day + nights); that is when the next leg starts.
//  - A leg lasts `distanceToNextKm / 70 km/h` (or the stop's own `durationToNextSec`
//    when the route carries driving durations). Arrival = departure + duration.
//  - Missing distances fall back to straight-line distance x 1.3 (road detour factor).
//  - The route line is drawn as straight segments between the stops, so the camper
//    moves along the straight segment (interpolated in Web-Mercator screen space,
//    which is what the line looks like on the map).
//  - Local calendar days are used for the clock times, never "+24 h" arithmetic, so
//    the DST change (25 Oct 2026, 25 h day) keeps 10:00 at 10:00.

const HOUR = 3_600_000;
export const FIRST_ARRIVAL_HOUR = 12;
export const DEPARTURE_HOUR = 10;
export const DRIVE_SPEED_KMH = 70;
const DETOUR_FACTOR = 1.3;

export interface ScheduleStopInput {
  lat: number;
  lng: number;
  arrivalDate: Date;
  nights: number;
  distanceToNextKm?: number;
  /** Optional measured driving time to the next stop (seconds). */
  durationToNextSec?: number;
}

export interface StaySegment { kind: 'stay'; stopIndex: number; start: number; end: number }
export interface DriveSegment {
  kind: 'drive';
  legIndex: number;
  start: number;
  end: number;
  from: LatLng;
  to: LatLng;
  km: number;
}
export type Segment = StaySegment | DriveSegment;
export interface LatLng { lat: number; lng: number }

export interface RouteSchedule {
  segments: Segment[];
  stops: Array<LatLng & { arrivalMs: number; departureMs: number }>;
  /** Trip start (arrival at the first stop). */
  startMs: number;
  /** Trip end (departure from the last stop). */
  endMs: number;
}

export interface VanPosition extends LatLng {
  /** Stop the camper is standing at, or null while driving. */
  stopIndex: number | null;
  /** Leg (from stop i to i+1) the camper is on, or null while standing. */
  legIndex: number | null;
  /** Stop the camper is at or driving towards (the one to highlight). */
  focusStopIndex: number;
  /** 0..1 within the current segment. */
  progress: number;
  /** +1 = driving/facing east (right), -1 = west (left). */
  heading: 1 | -1;
}

/** Local calendar day an arrival `Date` belongs to. Arrival dates come from `start + n x 24 h`, which drifts by an hour over a DST change → round to the nearest local day. */
function localDayParts(d: Date): [number, number, number] {
  const r = new Date(d.getTime() + 12 * HOUR);
  return [r.getFullYear(), r.getMonth(), r.getDate()];
}

const atLocal = (ymd: [number, number, number], addDays: number, hour: number) =>
  new Date(ymd[0], ymd[1], ymd[2] + addDays, hour).getTime();

function haversineKm(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function buildRouteSchedule(stopsIn: ScheduleStopInput[]): RouteSchedule | null {
  if (stopsIn.length === 0) return null;
  const segments: Segment[] = [];
  const stops: RouteSchedule['stops'] = [];
  let arrival = atLocal(localDayParts(stopsIn[0].arrivalDate), 0, FIRST_ARRIVAL_HOUR);

  for (let i = 0; i < stopsIn.length; i++) {
    const s = stopsIn[i];
    const day = localDayParts(s.arrivalDate);
    const planned = atLocal(day, Math.max(0, s.nights), DEPARTURE_HOUR);
    const departure = Math.max(arrival, planned);
    stops.push({ lat: s.lat, lng: s.lng, arrivalMs: arrival, departureMs: departure });
    segments.push({ kind: 'stay', stopIndex: i, start: arrival, end: departure });

    const next = stopsIn[i + 1];
    if (!next) break;
    const from = { lat: s.lat, lng: s.lng };
    const to = { lat: next.lat, lng: next.lng };
    const km = s.distanceToNextKm ?? haversineKm(from, to) * DETOUR_FACTOR;
    const durMs = s.durationToNextSec !== undefined ? s.durationToNextSec * 1000 : (km / DRIVE_SPEED_KMH) * HOUR;
    arrival = departure + Math.max(0, durMs);
    if (arrival > departure) {
      segments.push({ kind: 'drive', legIndex: i, start: departure, end: arrival, from, to, km });
    }
  }
  return { segments, stops, startMs: stops[0].arrivalMs, endMs: stops[stops.length - 1].departureMs };
}

// ── Web-Mercator interpolation (matches the straight line the route layer draws) ──
const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * Math.PI) / 360));
const invMercY = (y: number) => ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;

export function interpolateLatLng(a: LatLng, b: LatLng, p: number): LatLng {
  const k = Math.max(0, Math.min(1, p));
  return { lat: invMercY(mercY(a.lat) + (mercY(b.lat) - mercY(a.lat)) * k), lng: a.lng + (b.lng - a.lng) * k };
}

const dirOf = (a: LatLng, b: LatLng): 1 | -1 => (b.lng < a.lng ? -1 : 1);

/** Direction the camper faces while standing at stop i: the way it arrived, else the way it leaves. */
function standingHeading(sch: RouteSchedule, i: number): 1 | -1 {
  if (i > 0) return dirOf(sch.stops[i - 1], sch.stops[i]);
  if (sch.stops.length > 1) return dirOf(sch.stops[0], sch.stops[1]);
  return 1;
}

export function positionAt(sch: RouteSchedule, t: number): VanPosition {
  const first = sch.segments[0];
  const stay = (i: number, progress: number): VanPosition => ({
    lat: sch.stops[i].lat, lng: sch.stops[i].lng, stopIndex: i, legIndex: null, focusStopIndex: i,
    progress, heading: standingHeading(sch, i),
  });
  if (t <= first.start) return stay(0, 0);
  const lastStop = sch.stops.length - 1;
  if (t >= sch.endMs) return stay(lastStop, 1);
  for (const seg of sch.segments) {
    if (t > seg.end) continue;
    const progress = seg.end > seg.start ? (t - seg.start) / (seg.end - seg.start) : 1;
    if (seg.kind === 'stay') return stay(seg.stopIndex, progress);
    const p = interpolateLatLng(seg.from, seg.to, progress);
    return {
      ...p, stopIndex: null, legIndex: seg.legIndex, focusStopIndex: seg.legIndex + 1, progress,
      heading: dirOf(seg.from, seg.to),
    };
  }
  return stay(lastStop, 1);
}

/**
 * Instant to show for "the weather at this stop": the early afternoon of the arrival day (or the
 * arrival itself if later). The +1.5 h makes the nearest 3-hourly forecast step fall inside the stay.
 */
export function stayFocusMs(sch: RouteSchedule, stopIndex: number): number {
  const s = sch.stops[stopIndex];
  const d = new Date(s.arrivalMs);
  const noon = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime();
  return Math.min(Math.max(s.arrivalMs, noon) + 1.5 * HOUR, s.departureMs);
}

/** Tolerance around the trip: the play frames bracket it by up to one forecast step (<= 6 h). */
export const TRIP_EDGE_TOLERANCE_MS = 6 * HOUR;

/** Is the instant inside the trip (start to end, give or take one forecast step)? Outside, the camper is not "on" the route. */
export function isWithinTrip(sch: RouteSchedule, t: number): boolean {
  return t >= sch.startMs - TRIP_EDGE_TOLERANCE_MS && t <= sch.endMs + TRIP_EDGE_TOLERANCE_MS;
}

/** True when the forecast ends before the trip begins, i.e. there is nothing to play yet. */
export function tripStartsBeyondForecast(frames: number[], sch: RouteSchedule): boolean {
  return frames.length > 0 && sch.startMs > frames[frames.length - 1];
}

/**
 * Frames of "play route": the available weather instants from the trip start to the trip end, plus one frame
 * on each side so the camper begins at the first stop and ends at the last one. A trip that starts beyond the
 * forecast yields no frames; a trip that only partly fits plays the covered part.
 */
export function routePlayFrames(frames: number[], sch: RouteSchedule): number[] {
  if (frames.length === 0 || tripStartsBeyondForecast(frames, sch)) return [];
  const before = frames.filter((t) => t <= sch.startMs).pop();
  const inside = frames.filter((t) => t > sch.startMs && t < sch.endMs);
  const after = frames.find((t) => t >= sch.endMs);
  return [...(before !== undefined ? [before] : []), ...inside, ...(after !== undefined ? [after] : [])];
}

/** Stop caption state at an instant: where the camper is and which night it is. */
export function captionAt(sch: RouteSchedule, t: number): { stopIndex: number; kind: 'at' | 'to' | 'night'; night: number } | null {
  if (!isWithinTrip(sch, t)) return null; // before the trip / after it the camper is not on the route
  const pos = positionAt(sch, t);
  if (pos.stopIndex === null) return { stopIndex: pos.focusStopIndex, kind: 'to', night: 0 };
  const h = new Date(t).getHours();
  const arrival = sch.stops[pos.stopIndex].arrivalMs;
  const a = new Date(arrival);
  const dayDiff = Math.round((new Date(t).setHours(12, 0, 0, 0) - new Date(a.getFullYear(), a.getMonth(), a.getDate(), 12).getTime()) / (24 * HOUR));
  const isNight = h >= 21 || h < 6;
  // night n starts the evening of the n-th day at the stop; after midnight it still belongs to the previous evening
  const night = isNight ? Math.max(1, h < 6 ? dayDiff : dayDiff + 1) : 0;
  return { stopIndex: pos.stopIndex, kind: isNight ? 'night' : 'at', night };
}
