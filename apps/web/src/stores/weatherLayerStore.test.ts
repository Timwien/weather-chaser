import { describe, it, expect, beforeEach } from 'vitest';
import { useWeatherLayerStore } from './weatherLayerStore.ts';

describe('openTimeline', () => {
  beforeEach(() => useWeatherLayerStore.setState({ layer: 'off', timeMs: null, playing: false, playSeq: 0 }));

  it('switches to the forecast, sets the time, starts playback and bumps playSeq', () => {
    useWeatherLayerStore.getState().openTimeline(1000);
    const s = useWeatherLayerStore.getState();
    expect([s.layer, s.timeMs, s.playing, s.playSeq]).toEqual(['forecast', 1000, true, 1]);
  });

  it('bumps playSeq on every call so a running playback restarts', () => {
    const { openTimeline } = useWeatherLayerStore.getState();
    openTimeline(1000);
    openTimeline(2000);
    const s = useWeatherLayerStore.getState();
    expect([s.timeMs, s.playing, s.playSeq]).toEqual([2000, true, 2]);
  });
});
