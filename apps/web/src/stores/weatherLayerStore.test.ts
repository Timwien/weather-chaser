import { describe, it, expect, beforeEach } from 'vitest';
import { parseStoredLayer, useWeatherLayerStore } from './weatherLayerStore.ts';

describe('setLayer', () => {
  it('resets a stale cloud error and horizon so switching the layer on shows no unavailable note', () => {
    useWeatherLayerStore.setState({ cloudStatus: 'error', cloudHorizonMs: 123 });
    useWeatherLayerStore.getState().setLayer('weather');
    const s = useWeatherLayerStore.getState();
    expect([s.cloudStatus, s.cloudHorizonMs]).toEqual(['loading', null]);
  });
});

describe('openTimeline', () => {
  beforeEach(() => useWeatherLayerStore.setState({ layer: 'off', timeMs: null, playing: false, playSeq: 0 }));

  it('switches to the forecast, sets the time, starts playback and bumps playSeq', () => {
    useWeatherLayerStore.getState().openTimeline(1000);
    const s = useWeatherLayerStore.getState();
    expect([s.layer, s.timeMs, s.playing, s.playSeq]).toEqual(['weather', 1000, true, 1]);
  });

  it('bumps playSeq on every call so a running playback restarts', () => {
    const { openTimeline } = useWeatherLayerStore.getState();
    openTimeline(1000);
    openTimeline(2000);
    const s = useWeatherLayerStore.getState();
    expect([s.timeMs, s.playing, s.playSeq]).toEqual([2000, true, 2]);
  });
});

describe('parseStoredLayer', () => {
  it('migrates the former radar / forecast / clouds choices to the unified layer', () => {
    for (const old of ['radar', 'forecast', 'clouds', 'weather']) expect(parseStoredLayer(old)).toBe('weather');
  });
  it('keeps off, defaults garbage and missing values to off', () => {
    expect([parseStoredLayer('off'), parseStoredLayer(null), parseStoredLayer('x')]).toEqual(['off', 'off', 'off']);
  });
});
