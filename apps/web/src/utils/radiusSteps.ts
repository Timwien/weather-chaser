/** Radius slider stops (km) — shared by the "Wo?" slider and the finder's expand-radius action. */
export const RADIUS_STEPS: readonly number[] = [10, 25, 50, 100, 150, 200, 300, 500];

/** Next slider stop above `currentKm`, or null when already at the maximum. */
export function nextRadiusStep(currentKm: number): number | null {
  return RADIUS_STEPS.find((s) => s > currentKm) ?? null;
}
