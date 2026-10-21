// Screen-space declutter for ranked map markers: a marker that would overlap a
// better-ranked (or the selected) full-size marker is shown as a compact dot instead.

export interface DeclutterItem {
  /** Screen position of the marker centre (px) */
  x: number;
  y: number;
  /** Diameter of the full-size marker (px) */
  size: number;
  /** 1 = best */
  rank: number;
  selected: boolean;
}

/** Indices (into `items`) that must be rendered as dots. The selected item is never one. */
export function computeDotIndices(items: readonly DeclutterItem[]): Set<number> {
  const order = items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => Number(b.it.selected) - Number(a.it.selected) || a.it.rank - b.it.rank);
  const full: DeclutterItem[] = [];
  const dots = new Set<number>();
  for (const { it, i } of order) {
    const overlaps =
      !it.selected &&
      full.some((f) => Math.hypot(f.x - it.x, f.y - it.y) < (f.size + it.size) / 2);
    if (overlaps) dots.add(i);
    else full.push(it);
  }
  return dots;
}
