import { describe, expect, it } from 'vitest';
import {
  axisContains, axisEnd, axisStart, axisTimes, extractTimeDimension, floorOnAxis, localDayKey,
  mergeAxes, parseIsoDuration, parseTimeDimension, radarFrames, snapToAxis, timesOnLocalDay,
} from './wmsTime.ts';

const iso = (s: string) => Date.parse(s);

describe('parseIsoDuration', () => {
  it('parses minutes, hours, days and combinations', () => {
    expect(parseIsoDuration('PT5M')).toBe(300_000);
    expect(parseIsoDuration('PT3H')).toBe(10_800_000);
    expect(parseIsoDuration('P1D')).toBe(86_400_000);
    expect(parseIsoDuration('PT1H30M')).toBe(5_400_000);
  });
  it('rejects garbage', () => {
    expect(parseIsoDuration('foo')).toBeNull();
    expect(parseIsoDuration('P')).toBeNull();
    expect(parseIsoDuration('PT')).toBeNull();
    expect(parseIsoDuration('PT0M')).toBeNull();
  });
});

describe('parseTimeDimension', () => {
  it('parses start/end/period', () => {
    const a = parseTimeDimension('2026-10-21T03:00:00.000Z/2026-10-29T12:00:00.000Z/PT3H');
    expect(a).toEqual({ kind: 'range', start: iso('2026-10-21T03:00:00Z'), end: iso('2026-10-29T12:00:00Z'), stepMs: 10_800_000 });
    expect(axisTimes(a!)).toHaveLength(68);
  });
  it('parses comma lists, sorts and dedupes', () => {
    const a = parseTimeDimension('2026-10-19T00:10:00.000Z, 2026-10-19T00:05:00.000Z,2026-10-19T00:05:00.000Z');
    expect(a).toEqual({ kind: 'list', times: [iso('2026-10-19T00:05:00Z'), iso('2026-10-19T00:10:00Z')] });
  });
  it('parses mixed lists with ranges', () => {
    const a = parseTimeDimension('2026-10-01T00:00:00Z/2026-10-01T06:00:00Z/PT3H,2026-10-02T00:00:00Z');
    expect(axisTimes(a!)).toEqual([
      iso('2026-10-01T00:00:00Z'), iso('2026-10-01T03:00:00Z'), iso('2026-10-01T06:00:00Z'), iso('2026-10-02T00:00:00Z'),
    ]);
  });
  it('returns null for empty or invalid input', () => {
    expect(parseTimeDimension('')).toBeNull();
    expect(parseTimeDimension('nonsense')).toBeNull();
    expect(parseTimeDimension('2026-10-02T00:00:00Z/2026-10-01T00:00:00Z/PT3H')).toBeNull();
  });
});

describe('extractTimeDimension', () => {
  const xml = `<Capability><Layer><Layer><Name>A</Name><Dimension name="time" default="current" units="ISO8601">2026-10-01T00:00:00.000Z/2026-10-01T06:00:00.000Z/PT3H</Dimension></Layer>
  <Layer><Name>B</Name><Dimension name="REFERENCE_TIME" units="ISO8601">2026-10-01T00:00:00.000Z</Dimension><Dimension name="time" units="ISO8601">2026-11-01T00:00:00.000Z/2026-11-02T00:00:00.000Z/PT6H</Dimension></Layer></Layer></Capability>`;
  it('reads the time dimension (not REFERENCE_TIME) of a single-layer doc', () => {
    expect(axisStart(extractTimeDimension(xml.replace(/<Layer><Name>A[\s\S]*?<\/Layer>/, ''))!)).toBe(iso('2026-11-01T00:00:00Z'));
  });
  it('scopes to the requested layer in a multi-layer doc', () => {
    expect(axisStart(extractTimeDimension(xml, 'A')!)).toBe(iso('2026-10-01T00:00:00Z'));
    expect(axisStart(extractTimeDimension(xml, 'B')!)).toBe(iso('2026-11-01T00:00:00Z'));
  });
  it('returns null without a time dimension', () => {
    expect(extractTimeDimension('<Capability/>')).toBeNull();
  });
});

describe('axis helpers', () => {
  const a = parseTimeDimension('2026-10-21T03:00:00.000Z/2026-10-22T12:00:00.000Z/PT3H')!;
  it('end is the last grid point; containment is inclusive', () => {
    expect(axisEnd(a)).toBe(iso('2026-10-22T12:00:00Z'));
    expect(axisContains(a, iso('2026-10-22T12:00:00Z'))).toBe(true);
    expect(axisContains(a, iso('2026-10-22T12:00:01Z'))).toBe(false);
  });
  it('snaps and floors onto the grid and clamps', () => {
    expect(snapToAxis(a, iso('2026-10-21T04:10:00Z'))).toBe(iso('2026-10-21T03:00:00Z'));
    expect(snapToAxis(a, iso('2026-10-21T04:40:00Z'))).toBe(iso('2026-10-21T06:00:00Z'));
    expect(snapToAxis(a, iso('2030-01-01T00:00:00Z'))).toBe(axisEnd(a));
    expect(floorOnAxis(a, iso('2026-10-21T08:59:00Z'))).toBe(iso('2026-10-21T06:00:00Z'));
    expect(floorOnAxis(a, iso('2000-01-01T00:00:00Z'))).toBe(axisStart(a));
  });
  it('radarFrames: last 2 h in 10-min steps, oldest first', () => {
    const r = parseTimeDimension('2026-10-19T00:00:00.000Z/2026-10-22T14:15:00.000Z/PT5M')!;
    const frames = radarFrames(r, iso('2026-10-22T12:19:00Z'));
    expect(frames).toHaveLength(13);
    expect(frames[12]).toBe(iso('2026-10-22T12:15:00Z'));
    expect(frames[0]).toBe(iso('2026-10-22T10:15:00Z'));
  });
  it('radarFrames never goes before axis start', () => {
    const r = parseTimeDimension('2026-10-22T12:00:00.000Z/2026-10-22T12:30:00.000Z/PT5M')!;
    expect(radarFrames(r, iso('2026-10-22T12:30:00Z'))).toHaveLength(4);
  });
  it('mergeAxes unions grids', () => {
    const b = parseTimeDimension('2026-10-22T12:00:00.000Z/2026-10-23T00:00:00.000Z/PT3H')!;
    const m = mergeAxes(a, b);
    expect(axisEnd(m)).toBe(iso('2026-10-23T00:00:00Z'));
    expect(axisStart(m)).toBe(axisStart(a));
  });
  it('timesOnLocalDay selects instants of a local calendar day', () => {
    const day = localDayKey(iso('2026-10-21T12:00:00Z'));
    const ts = timesOnLocalDay(a, day);
    expect(ts.length).toBeGreaterThan(0);
    expect(ts.every((t) => localDayKey(t) === day)).toBe(true);
  });
});
