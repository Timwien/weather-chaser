// Buffered animation state machine: idle → buffering → playing → (buffering …).
// Knows nothing about maps or tiles: a caller supplies the frame list size, a
// readiness test and a "show frame i" function. The time label must never run ahead
// of the picture, so the clock only advances after show() has resolved, and only
// when the next frame is fully cached.
//
// Reusable by the route timeline / camper animation (F3/F4): give it your own frame
// list (e.g. one instant per route step) and read `shownMs` from the weather store.

export type PlayPhase = 'idle' | 'buffering' | 'playing';

export interface PlaybackState {
  phase: PlayPhase;
  /** frames of the loop that are fully cached */
  ready: number;
  total: number;
}

export interface PlaybackDeps {
  count: () => number;
  /** frame i fully cached (and anything else it needs, e.g. cloud data)? */
  isReady: (i: number) => boolean;
  /** Puts frame i on screen; resolves once it is displayed AND the label has been updated. */
  show: (i: number) => Promise<void>;
  /** Ask the loader to (re)queue missing tiles. */
  pump: () => void;
  onState: (s: PlaybackState) => void;
  cadenceMs?: number;
  /** false = play once: after the last frame the engine goes idle and calls onEnd (default: loop). */
  loop?: boolean;
  onEnd?: () => void;
  /** extra pause on the last frame before the loop restarts */
  dwellMs?: number;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (h: unknown) => void;
  /** called with the interval (ms) between two consecutive displayed frames while playing */
  onInterval?: (ms: number, wrapped: boolean) => void;
}

export const CADENCE_MS = 600;
export const DWELL_MS = 700;

/** Frames that must be cached ahead of the current one before playing starts. */
export function bufferTarget(total: number): number {
  return total <= 12 ? total - 1 : 6;
}

export class PlaybackEngine {
  private phase: PlayPhase = 'idle';
  private cur = 0;
  private timer: unknown = null;
  private gen = 0;
  private lastShownAt = 0;
  private nextDue = 0;
  private readonly cadence: number;
  private readonly dwell: number;
  private readonly now: () => number;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (h: unknown) => void;

  constructor(private d: PlaybackDeps) {
    this.cadence = d.cadenceMs ?? CADENCE_MS;
    this.dwell = d.dwellMs ?? DWELL_MS;
    this.now = d.now ?? (() => performance.now());
    this.setTimer = d.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = d.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  }

  get state(): PlaybackState {
    const total = this.d.count();
    let ready = 0;
    for (let i = 0; i < total; i++) if (this.d.isReady(i)) ready++;
    return { phase: this.phase, ready, total };
  }

  private emit() { this.d.onState(this.state); }

  private showFirst = false;

  /** Starts at frame `index`; with `showFirst` that frame is put on screen as soon as it is cached (else it already is). */
  play(index: number, showFirst = false) {
    this.stopTimer();
    this.gen++;
    this.showFirst = showFirst;
    this.cur = Math.max(0, Math.min(index, this.d.count() - 1));
    if (this.d.count() < 2) { this.phase = 'idle'; this.emit(); return; }
    this.phase = 'buffering';
    this.d.pump();
    this.emit();
    this.check();
  }

  pause() {
    this.stopTimer();
    this.gen++;
    if (this.phase !== 'idle') { this.phase = 'idle'; this.emit(); }
  }

  /** Index of the frame that is currently displayed by the loop. */
  get index() { return this.cur; }

  /** The loader made progress (or the cache changed): re-evaluate. */
  notify() {
    if (this.phase === 'idle') return;
    if (this.phase === 'buffering') this.check();
    else this.emit();
  }

  private enoughAhead(): boolean {
    const n = this.d.count();
    if (this.showFirst && !this.d.isReady(this.cur)) return false;
    if (n <= 12) {
      for (let i = 0; i < n; i++) if (!this.d.isReady(i)) return false;
      return true;
    }
    const need = bufferTarget(n);
    for (let k = 1; k <= need; k++) if (!this.d.isReady((this.cur + k) % n)) return false;
    return true;
  }

  private check() {
    if (this.phase !== 'buffering') { this.emit(); return; }
    if (this.enoughAhead()) {
      this.phase = 'playing';
      this.emit();
      if (this.showFirst) {
        this.showFirst = false;
        const gen = this.gen;
        void this.d.show(this.cur).then(() => {
          if (gen !== this.gen) return;
          this.nextDue = this.now() + this.cadence;
          this.lastShownAt = this.now();
          this.schedule();
        });
        return;
      }
      this.nextDue = this.now() + this.cadence;
      this.lastShownAt = this.now();
      this.schedule();
    } else {
      this.emit();
    }
  }

  private stopTimer() {
    if (this.timer !== null) { this.clearTimer(this.timer); this.timer = null; }
  }

  private schedule() {
    this.stopTimer();
    const gen = this.gen;
    this.timer = this.setTimer(() => { this.timer = null; if (gen === this.gen) void this.tick(); }, Math.max(0, this.nextDue - this.now()));
  }

  private async tick() {
    if (this.phase !== 'playing') return;
    const n = this.d.count();
    if (this.d.loop === false && this.cur >= n - 1) {
      this.stopTimer();
      this.gen++;
      this.phase = 'idle';
      this.emit();
      this.d.onEnd?.();
      return;
    }
    const next = (this.cur + 1) % n;
    if (!this.d.isReady(next)) {
      // underrun: stop the clock, show the spinner, resume when enough is cached again
      this.phase = 'buffering';
      this.d.pump();
      this.emit();
      this.check();
      return;
    }
    const gen = this.gen;
    try {
      await this.d.show(next);
    } catch {
      if (gen === this.gen) { this.phase = 'buffering'; this.d.pump(); this.emit(); this.check(); }
      return;
    }
    if (gen !== this.gen) return; // paused / restarted meanwhile
    const wrapped = next === 0;
    this.cur = next;
    const t = this.now();
    this.d.onInterval?.(t - this.lastShownAt, wrapped);
    this.lastShownAt = t;
    // steady cadence: schedule from the due time, but re-base after a stall
    const due = this.nextDue + this.cadence + (next === n - 1 ? this.dwell : 0);
    this.nextDue = due < t ? t + this.cadence : due;
    this.emit();
    this.schedule();
  }
}
