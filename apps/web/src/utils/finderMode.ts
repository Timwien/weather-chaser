import { isLocatedPlace, isPolygonArea, type SearchAreaItem } from '../stores/appStore.ts';

/**
 * Which kind of finder search the current "Wo?" selection means.
 * A drawn polygon always wins (even with named places present); several
 * named places without a polygon are scored directly; otherwise it is a
 * single origin (place or radius) with a radius around it.
 */
export type FinderMode = 'polygon' | 'multi-place' | 'around';

export function getFinderMode(areas: readonly SearchAreaItem[]): FinderMode {
  if (areas.some(isPolygonArea)) return 'polygon';
  if (areas.filter(isLocatedPlace).length > 1) return 'multi-place';
  return 'around';
}
