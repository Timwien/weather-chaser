/**
 * fetchInBatches — run per-batch requests with bounded concurrency and ONE
 * overall time budget. Used by the daily and hourly weather pipelines.
 *
 * - towns are split into chunks of `batchSize` (Open-Meteo multi-location limit)
 * - at most `concurrency` chunks are in flight at once
 * - a failed chunk is split ONCE into two halves, each tried once
 * - after `budgetMs` no new request starts; whatever succeeded is returned
 * - only if NOTHING succeeded does the call throw (with the last error)
 */

export interface BatchOptions {
  batchSize?: number;
  concurrency?: number;
  budgetMs?: number;
}

export const DEFAULT_BATCH_SIZE = 50;
export const DEFAULT_CONCURRENCY = 3;
export const DEFAULT_BUDGET_MS = 30_000;

/** `fetchOne` receives the shared absolute deadline (epoch ms). */
export type BatchFetcher<TItem, TResult> = (items: TItem[], deadline: number) => Promise<TResult[]>;

async function tryBatch<TItem, TResult>(
  items: TItem[],
  fetchOne: BatchFetcher<TItem, TResult>,
  deadline: number,
  onError: (err: unknown) => void,
): Promise<TResult[]> {
  if (Date.now() >= deadline) return [];
  try {
    return await fetchOne(items, deadline);
  } catch (err) {
    onError(err);
    if (items.length < 2 || Date.now() >= deadline) return [];
    // Split-retry: exactly one level
    const mid = Math.ceil(items.length / 2);
    const halves = await Promise.all(
      [items.slice(0, mid), items.slice(mid)].map(async (half) => {
        if (Date.now() >= deadline) return [] as TResult[];
        try {
          return await fetchOne(half, deadline);
        } catch (e) {
          onError(e);
          return [] as TResult[];
        }
      }),
    );
    return halves.flat();
  }
}

export async function fetchInBatches<TItem, TResult>(
  items: TItem[],
  fetchOne: BatchFetcher<TItem, TResult>,
  {
    batchSize = DEFAULT_BATCH_SIZE,
    concurrency = DEFAULT_CONCURRENCY,
    budgetMs = DEFAULT_BUDGET_MS,
  }: BatchOptions = {},
): Promise<TResult[]> {
  if (items.length === 0) return [];
  const deadline = Date.now() + budgetMs;

  const chunks: TItem[][] = [];
  for (let i = 0; i < items.length; i += batchSize) chunks.push(items.slice(i, i + batchSize));

  let lastError: unknown = new Error('no batch succeeded');
  const perChunk: TResult[][] = new Array(chunks.length).fill(null).map(() => []);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < chunks.length) {
      const idx = next++;
      perChunk[idx] = await tryBatch(chunks[idx], fetchOne, deadline, (e) => { lastError = e; });
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, chunks.length) }, worker));

  const results = perChunk.flat();
  if (results.length === 0) throw lastError instanceof Error ? lastError : new Error(String(lastError));
  return results;
}
