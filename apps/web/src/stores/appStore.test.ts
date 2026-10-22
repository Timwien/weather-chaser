import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from './appStore.ts';

describe('updatePlaceArea', () => {
  beforeEach(() => {
    useAppStore.setState({
      searchAreas: [
        { type: 'place', id: 'a', name: 'Alt', fullName: 'Alt, DE', lat: 1, lng: 2, bbox: [0, 0, 3, 3] },
        { type: 'polygon', id: 'p', polygon: [[0, 0], [1, 1], [0, 1]] },
      ],
    });
  });

  it('moves a place, drops the stale bbox and leaves other areas untouched', () => {
    const before = useAppStore.getState().searchAreas[1];
    useAppStore.getState().updatePlaceArea('a', { lat: 10, lng: 20 });
    const [a, p] = useAppStore.getState().searchAreas;
    expect(a).toMatchObject({ lat: 10, lng: 20, name: 'Alt' });
    expect((a as { bbox?: unknown }).bbox).toBeUndefined();
    expect(p).toBe(before);
  });

  it('renaming alone keeps the bbox; unknown ids and non-places are ignored', () => {
    useAppStore.getState().updatePlaceArea('a', { name: 'Neu', fullName: 'Neu, DE' });
    expect(useAppStore.getState().searchAreas[0]).toMatchObject({ name: 'Neu', bbox: [0, 0, 3, 3] });
    useAppStore.getState().updatePlaceArea('zzz', { name: 'x' });
    useAppStore.getState().updatePlaceArea('p', { lat: 5 });
    expect(useAppStore.getState().searchAreas[1]).not.toHaveProperty('lat');
  });
});
