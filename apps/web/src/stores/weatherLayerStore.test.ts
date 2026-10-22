import { describe, it, expect, beforeEach } from 'vitest';
import { parseStoredLayer, useWeatherLayerStore } from './weatherLayerStore.ts';

describe('setLayer', () => {
  it('resets a stale cloud error and horizon so switching the layer on shows no unavailable note', () => {
    useWeatherLayerStore.setState({ cloudStatus: 'error', cloudHorizonMs: 123 });
    useWeatherLayerStore.getState().setLayer('weather');
    const s = useWeatherLayerStore.getState();
    expect([s.cloudStatus, s.cloudHorizonMs]).toEqual(['loading', null]);
  });

  it('re-picking the active layer changes nothing (its cloud overlay stays, so its ready status must too)', () => {
    useWeatherLayerStore.setState({ layer: 'weather', cloudStatus: 'ready', playing: true, timeMs: 42 });
    useWeatherLayerStore.getState().setLayer('weather');
    const s = useWeatherLayerStore.getState();
    expect([s.cloudStatus, s.playing, s.timeMs]).toEqual(['ready', true, 42]);
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

describe('route actions', () => {
  beforeEach(() => useWeatherLayerStore.setState({
    layer: 'off', timeMs: null, playing: true, routePlay: false, stopFocus: null, routePlayReq: null, playSeq: 0,
  }));

  it('focusStop is ignored while the layer is off unless forced', () => {
    useWeatherLayerStore.getState().focusStop(1);
    expect(useWeatherLayerStore.getState().stopFocus).toBeNull();
    useWeatherLayerStore.getState().focusStop(1, true);
    const s = useWeatherLayerStore.getState();
    expect([s.layer, s.stopFocus?.idx, s.playing]).toEqual(['weather', 1, false]);
  });

  it('focusStop on the same stop twice yields a new request each time and pauses playback', () => {
    useWeatherLayerStore.setState({ layer: 'weather' });
    useWeatherLayerStore.getState().focusStop(2);
    const a = useWeatherLayerStore.getState().stopFocus!.seq;
    useWeatherLayerStore.getState().focusStop(2);
    expect(useWeatherLayerStore.getState().stopFocus!.seq).toBe(a + 1);
  });

  it('requestRoutePlay enables the layer; beginRoutePlay starts the scheduled playback; setLayer ends it', () => {
    const st = useWeatherLayerStore.getState();
    st.requestRoutePlay();
    expect(useWeatherLayerStore.getState().layer).toBe('weather');
    expect(useWeatherLayerStore.getState().routePlayReq?.seq).toBe(1);
    st.beginRoutePlay(5000);
    const s = useWeatherLayerStore.getState();
    expect([s.routePlay, s.timeMs, s.playing, s.playSeq]).toEqual([true, 5000, true, 1]);
    st.openTimeline(1);
    expect(useWeatherLayerStore.getState().routePlay).toBe(false);
    st.beginRoutePlay(5000);
    st.setLayer('off');
    expect(useWeatherLayerStore.getState().routePlay).toBe(false);
  });
});

describe('route play mode', () => {
  beforeEach(() => useWeatherLayerStore.setState({ layer: 'weather', timeMs: null, playing: true, routePlay: true }));

  it('scrubTo sets the time and leaves route-play mode', () => {
    useWeatherLayerStore.getState().scrubTo(5000);
    const s = useWeatherLayerStore.getState();
    expect([s.timeMs, s.routePlay]).toEqual([5000, false]);
  });

  it('setTimeMs alone keeps route-play mode (internal moves)', () => {
    useWeatherLayerStore.getState().setTimeMs(5000);
    expect(useWeatherLayerStore.getState().routePlay).toBe(true);
  });

  it('endRoutePlay stops playback and clears route-play mode', () => {
    useWeatherLayerStore.getState().endRoutePlay();
    const s = useWeatherLayerStore.getState();
    expect([s.playing, s.routePlay]).toEqual([false, false]);
  });

  it('focusStop leaves route-play mode, beginRoutePlay enters it', () => {
    useWeatherLayerStore.getState().focusStop(1);
    expect(useWeatherLayerStore.getState().routePlay).toBe(false);
    useWeatherLayerStore.getState().beginRoutePlay(1000);
    expect(useWeatherLayerStore.getState().routePlay).toBe(true);
  });
});
