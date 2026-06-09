/**
 * allocateNights — optimal night distribution along an ordered tour.
 *
 * Given the visit order, finds nights n_i ∈ [1, maxStay] with Σ n_i = totalDays
 * maximizing Σ_i Σ_{d=arrival_i}^{arrival_i+n_i-1} dayScores[town_i][d],
 * where arrival_i is the prefix sum of nights before stop i.
 *
 * This is what makes the planner temporally aware: if a town's weather peaks
 * late in the trip window, the DP holds earlier stops longer so the arrival
 * lands on the good days.
 *
 * DP over (stop index, days consumed): O(K · totalDays · maxStay) with O(1)
 * range sums via per-town prefix sums — trivially fast for K, D ≤ 14.
 *
 * Returns utility −Infinity when infeasible (K > totalDays or K·maxStay < totalDays).
 */
export function allocateNights(
  tour: number[],
  dayScores: number[][],
  totalDays: number,
  maxStay: number,
): { nights: number[]; utility: number } {
  const k = tour.length;
  if (k === 0 || totalDays <= 0 || k > totalDays || k * maxStay < totalDays) {
    return { nights: [], utility: -Infinity };
  }

  // Prefix sums per tour stop: prefix[i][d] = Σ dayScores[tour[i]][0..d-1]
  const prefix: number[][] = tour.map((town) => {
    const row = dayScores[town];
    const p = new Array<number>(totalDays + 1);
    p[0] = 0;
    for (let d = 0; d < totalDays; d++) p[d + 1] = p[d] + (row[d] ?? 0);
    return p;
  });
  const windowSum = (i: number, from: number, len: number) =>
    prefix[i][Math.min(from + len, totalDays)] - prefix[i][Math.min(from, totalDays)];

  // f[i][d] = best utility with first i stops covering exactly d days
  const NEG = -Infinity;
  const f: number[][] = Array.from({ length: k + 1 }, () =>
    new Array<number>(totalDays + 1).fill(NEG),
  );
  const choice: number[][] = Array.from({ length: k + 1 }, () =>
    new Array<number>(totalDays + 1).fill(0),
  );
  f[0][0] = 0;

  for (let i = 0; i < k; i++) {
    for (let d = 0; d <= totalDays; d++) {
      if (f[i][d] === NEG) continue;
      const maxN = Math.min(maxStay, totalDays - d);
      for (let n = 1; n <= maxN; n++) {
        const val = f[i][d] + windowSum(i, d, n);
        if (val > f[i + 1][d + n]) {
          f[i + 1][d + n] = val;
          choice[i + 1][d + n] = n;
        }
      }
    }
  }

  if (f[k][totalDays] === NEG) return { nights: [], utility: -Infinity };

  // Reconstruct
  const nights = new Array<number>(k);
  let d = totalDays;
  for (let i = k; i >= 1; i--) {
    const n = choice[i][d];
    nights[i - 1] = n;
    d -= n;
  }

  return { nights, utility: f[k][totalDays] };
}
