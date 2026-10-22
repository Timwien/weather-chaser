// Fetches the tiles of upcoming animation frames through the tile cache, a few at a
// time, in frame order. Abortable (viewport / layer / time-range change, unmount).
// Generic over "url" so it is unit-testable without a map or a network.

export interface PreloadFrame {
  /** index in the playback range */
  id: number;
  urls: string[];
}

export interface PreloaderDeps {
  /** Loads (and caches) one tile; may reject. */
  load: (url: string, signal: AbortSignal) => Promise<unknown>;
  /** Cache key of a tile URL (computed once per URL at start()). */
  keyOf: (url: string) => string;
  /** True when the tile with this key is in the cache. */
  has: (key: string) => boolean;
  concurrency?: number;
  /** Called whenever a frame may have become ready (throttled by the caller if needed). */
  onChange?: () => void;
}

export class FramePreloader {
  private frames: Array<{ items: Array<{ url: string; key: string }> }> = [];
  private order: number[] = [];
  private ctrl: AbortController | null = null;
  /** Tiles that failed in this run: they count as settled so a gap cannot stall the animation. */
  private failed = new Set<string>();
  private running = false;
  /** pump() was called while a run was active: loop once more afterwards (the cache may have evicted tiles meanwhile). */
  private again = false;

  constructor(private deps: PreloaderDeps) {}

  /** Replaces the work list and aborts anything running; `order` = frame ids by priority (default: list order). */
  start(frames: PreloadFrame[], order?: number[]) {
    this.stop();
    this.frames = frames.map((f) => ({ items: f.urls.map((url) => ({ url, key: this.deps.keyOf(url) })) }));
    this.order = order ?? frames.map((_, i) => i);
    this.failed = new Set();
    this.ctrl = new AbortController();
    this.deps.onChange?.();
    void this.pump();
  }

  stop() {
    this.ctrl?.abort();
    this.ctrl = null;
    this.running = false;
    this.again = false;
  }

  isReady(id: number): boolean {
    const f = this.frames[id];
    return !!f && f.items.every((it) => this.deps.has(it.key) || this.failed.has(it.key));
  }

  readyCount(): number {
    let n = 0;
    for (let i = 0; i < this.frames.length; i++) if (this.isReady(i)) n++;
    return n;
  }

  get total() { return this.frames.length; }

  /**
   * (Re)queues every tile that is neither cached nor failed. Call again when the cache
   * may have evicted something (frame not ready although it was loaded before).
   */
  async pump(order?: number[]): Promise<void> {
    if (order) this.order = order;
    if (!this.ctrl) return;
    if (this.running) { this.again = true; return; }
    this.running = true;
    const ctrl = this.ctrl;
    do {
      this.again = false;
      const queue: Array<{ url: string; key: string }> = [];
      const seen = new Set<string>();
      for (const id of this.order) {
        for (const it of this.frames[id]?.items ?? []) {
          if (!seen.has(it.key) && !this.deps.has(it.key) && !this.failed.has(it.key)) { seen.add(it.key); queue.push(it); }
        }
      }
      const worker = async () => {
        for (;;) {
          const it = queue.shift();
          if (it === undefined || ctrl.signal.aborted) return;
          try {
            await this.deps.load(it.url, ctrl.signal);
          } catch {
            if (ctrl.signal.aborted) return;
            this.failed.add(it.key);
          }
          if (!ctrl.signal.aborted) this.deps.onChange?.();
        }
      };
      await Promise.all(Array.from({ length: this.deps.concurrency ?? 6 }, worker));
    } while (this.again && this.ctrl === ctrl && !ctrl.signal.aborted);
    if (this.ctrl === ctrl) this.running = false;
  }
}
