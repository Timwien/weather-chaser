/**
 * orOptImprove — Or-opt-1: single-stop reinsertion local search.
 *
 * For each interior stop, tries moving it to every other insertion gap.
 * Applies the first improving move found, then restarts.
 * Eliminates "zig-zag" detours that 2-opt cannot fix:
 *   2-opt only removes crossing edges — or-opt also removes backtracking detours
 *   where a stop is visited "out of geographic flow" without a crossing.
 *
 * Example it fixes: A→Wien→B→C where Wien is far east and B,C are northwest.
 *   Reinserting Wien between B and C (or elsewhere) may give a shorter overall path.
 *
 * Time complexity: O(n²) per pass. On small post-truncation tours (5–14 stops)
 * this is negligible (<1 ms).
 */
export function orOptImprove(tour: number[], distanceMatrix: number[][]): number[] {
  if (tour.length <= 3) return [...tour];

  let current = [...tour];
  let improved = true;

  while (improved) {
    improved = false;
    const n = current.length;

    outer: for (let i = 1; i < n - 1; i++) {
      const prev = current[i - 1];
      const node = current[i];
      const next = current[i + 1];

      // Gain from removing node from its current position (shortcut prev→next)
      const removeGain =
        distanceMatrix[prev][node] + distanceMatrix[node][next] - distanceMatrix[prev][next];

      for (let j = 0; j < n - 1; j++) {
        if (j === i - 1 || j === i) continue; // skip current and adjacent gaps

        const a = current[j];
        const b = current[j + 1];

        // Extra cost to insert node between a and b
        const insertCost =
          distanceMatrix[a][node] + distanceMatrix[node][b] - distanceMatrix[a][b];

        if (removeGain - insertCost > 1e-10) {
          // Profitable reinsertion: remove from i, insert between j and j+1
          current.splice(i, 1);
          // After removing index i, indices > i shift left by 1
          const insertPos = j < i ? j + 1 : j;
          current.splice(insertPos, 0, node);
          improved = true;
          break outer; // restart with updated positions
        }
      }
    }
  }

  return current;
}
