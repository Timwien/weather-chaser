import React, { useCallback, useEffect, useRef } from 'react';
import './MobileBottomSheet.css';

// ── Snap detent heights ─────────────────────────────────────────────────────
/**
 * Canonical detent heights in px (how much of the viewport the sheet covers at each snap).
 * SINGLE SOURCE OF TRUTH: the sheet uses this for its own translateY, and Plan 03
 * imports it to pad the map by the sheet's real coverage. Do NOT duplicate these numbers.
 * Read `window.innerHeight` at call time (Vite SPA, no SSR for this route).
 *
 * Returns [peekPx, halfPx, fullPx]
 *  peekPx — handle + summary strip only (≈84px)
 *  halfPx — ~50% of the visual viewport height
 *  fullPx — full visual viewport height (100dvh)
 */
export function getSheetHeights(): [number, number, number] {
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const PEEK = 84; // handle pill (4px) + padding + summary strip (~60px)
  return [PEEK, Math.round(vh * 0.5), vh];
}

/** Derive CSS translateY from a coverage height: sheet wrapper is 100dvh and
 *  sits at the bottom; we slide it DOWN so only `coveragePx` of it is visible. */
function coverageToTranslateY(coveragePx: number, fullPx: number): number {
  return fullPx - coveragePx;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface MobileBottomSheetProps {
  /** Controlled snap index: 0 = peek, 1 = half, 2 = full */
  snapIndex: 0 | 1 | 2;
  onSnapChange: (index: 0 | 1 | 2) => void;
  /** Peek strip content rendered under the handle (e.g. "6 places found") — provided by Plan 03 */
  summary?: React.ReactNode;
  /** Scrollable sheet content (panels) */
  children: React.ReactNode;
  /** Optional accessible label for the drag handle (prefer providing via Plan 03 i18n) */
  handleAriaLabel?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MobileBottomSheet({
  snapIndex,
  onSnapChange,
  summary,
  children,
  handleAriaLabel,
}: MobileBottomSheetProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Live state during drag — stored in refs to avoid re-render on every pointermove
  const isDragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartTranslateY = useRef(0);
  // Current translateY applied to the wrapper (ref-tracked during drag, synced from prop)
  const currentTranslateY = useRef(0);

  // ── Sync prop → transform ─────────────────────────────────────────────────
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const [peekPx, halfPx, fullPx] = getSheetHeights();
    const heights: [number, number, number] = [peekPx, halfPx, fullPx];
    const ty = coverageToTranslateY(heights[snapIndex], fullPx);
    currentTranslateY.current = ty;
    wrapper.style.transform = `translateY(${ty}px)`;
  }, [snapIndex]);

  // ── Recompute on resize / orientation change ──────────────────────────────
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const onResize = () => {
      if (isDragging.current) return; // leave drag alone; it will re-snap on release
      const [peekPx, halfPx, fullPx] = getSheetHeights();
      const heights: [number, number, number] = [peekPx, halfPx, fullPx];
      const ty = coverageToTranslateY(heights[snapIndex], fullPx);
      currentTranslateY.current = ty;
      wrapper.style.transform = `translateY(${ty}px)`;
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [snapIndex]);

  // ── Drag: nearest-snap helper ─────────────────────────────────────────────
  const nearestSnap = useCallback((ty: number): 0 | 1 | 2 => {
    const [peekPx, halfPx, fullPx] = getSheetHeights();
    const snapTranslates = [
      coverageToTranslateY(peekPx, fullPx),  // index 0 (peek) — large translateY
      coverageToTranslateY(halfPx, fullPx),  // index 1 (half)
      coverageToTranslateY(fullPx, fullPx),  // index 2 (full) — translateY = 0
    ] as const;

    let nearest: 0 | 1 | 2 = 0;
    let minDist = Infinity;
    ([0, 1, 2] as const).forEach((i) => {
      const dist = Math.abs(ty - snapTranslates[i]);
      if (dist < minDist) {
        minDist = dist;
        nearest = i;
      }
    });
    return nearest;
  }, []);

  // ── Pointer handlers (bound to handle only) ───────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const handle = handleRef.current;
    const wrapper = wrapperRef.current;
    if (!handle || !wrapper) return;

    handle.setPointerCapture(e.pointerId);
    isDragging.current = true;
    dragStartY.current = e.clientY;
    dragStartTranslateY.current = currentTranslateY.current;

    // Remove snap transition during drag
    wrapper.setAttribute('data-dragging', 'true');
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const [peekPx, , fullPx] = getSheetHeights();
    const maxTy = coverageToTranslateY(peekPx, fullPx); // lowest visible (peek)
    const minTy = 0; // fully open (full)

    const delta = e.clientY - dragStartY.current;
    const rawTy = dragStartTranslateY.current + delta;
    // Clamp: don't drag above full open or below peek
    const clampedTy = Math.max(minTy, Math.min(maxTy, rawTy));

    currentTranslateY.current = clampedTy;
    // Write transform directly — no React state update keeps this at 60fps
    wrapper.style.transform = `translateY(${clampedTy}px)`;
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging.current) return;
      const wrapper = wrapperRef.current;
      if (!wrapper) return;

      isDragging.current = false;
      wrapper.removeAttribute('data-dragging');

      const totalDrag = Math.abs(e.clientY - dragStartY.current);

      if (totalDrag < 6) {
        // Treat as tap: advance one detent (peek→half→full; full stays)
        const next: 0 | 1 | 2 =
          snapIndex === 0 ? 1 : snapIndex === 1 ? 2 : 2;
        onSnapChange(next);
      } else {
        // Snap to nearest detent from released position
        const nearest = nearestSnap(currentTranslateY.current);
        onSnapChange(nearest);
      }
    },
    [snapIndex, onSnapChange, nearestSnap]
  );

  const onPointerCancel = useCallback(() => {
    if (!isDragging.current) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    isDragging.current = false;
    wrapper.removeAttribute('data-dragging');

    // Snap back to current controlled snap
    const [peekPx, halfPx, fullPx] = getSheetHeights();
    const heights: [number, number, number] = [peekPx, halfPx, fullPx];
    const ty = coverageToTranslateY(heights[snapIndex], fullPx);
    currentTranslateY.current = ty;
    wrapper.style.transform = `translateY(${ty}px)`;
  }, [snapIndex]);

  // ── Content swipe handoff ─────────────────────────────────────────────────
  // Below full the content is scroll-locked (see .mbs-content--locked), so a
  // swipe up on it unambiguously means "expand". At full, a swipe down while
  // the content sits at scrollTop 0 collapses back to half. Listeners stay
  // passive — we never preventDefault, so taps and normal scrolling at full
  // are unaffected.
  //
  // All gesture state lives in refs and snapIndex is read through a ref: the
  // snap change we trigger re-renders mid-gesture, and closure state would be
  // reset by an effect re-bind — the remaining touchmoves of the same gesture
  // would then read startY=0 and immediately snap back.
  const snapIndexRef = useRef(snapIndex);
  useEffect(() => {
    snapIndexRef.current = snapIndex;
  }, [snapIndex]);

  const gestureStartY = useRef(0);
  const gestureStartX = useRef(0);
  const gestureFired = useRef(false);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      gestureStartY.current = e.touches[0].clientY;
      gestureStartX.current = e.touches[0].clientX;
      gestureFired.current = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (gestureFired.current) return; // one snap change per gesture
      const dy = gestureStartY.current - e.touches[0].clientY; // > 0 = swipe up
      const dx = Math.abs(e.touches[0].clientX - gestureStartX.current);
      // Threshold + vertical dominance: ignore taps and horizontal swipes
      // (e.g. the finder sort bar scrolls sideways)
      if (Math.abs(dy) < 14 || dx > Math.abs(dy)) return;
      const snap = snapIndexRef.current;
      if (snap < 2 && dy > 0) {
        gestureFired.current = true;
        onSnapChange(2);
      } else if (snap === 2 && dy < 0 && el.scrollTop <= 0) {
        gestureFired.current = true;
        onSnapChange(1);
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
    };
  }, [onSnapChange]);

  // ── Scrim tap → collapse to half ─────────────────────────────────────────
  const onScrimClick = useCallback(() => {
    onSnapChange(1);
  }, [onSnapChange]);

  // ── Render ────────────────────────────────────────────────────────────────
  const isFullOpen = snapIndex === 2;

  return (
    <>
      {/* Scrim — rendered/faded via CSS class; pointer-events only at full */}
      <div
        className={`mbs-scrim${isFullOpen ? ' mbs-scrim--visible' : ''}`}
        onClick={isFullOpen ? onScrimClick : undefined}
        aria-hidden="true"
      />

      {/* Sheet wrapper — translateY drives the snap position */}
      <div
        ref={wrapperRef}
        className="mbs-wrapper"
      >
        <div className="mbs-body">
          {/* Handle area — drag and tap-to-advance are bound here */}
          <div
            ref={handleRef}
            className="mbs-handle-area"
            role="button"
            tabIndex={0}
            aria-label={handleAriaLabel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
          >
            <div className="mbs-handle-pill" />
          </div>

          {/* Peek summary strip */}
          {summary != null && (
            <div className="mbs-summary">{summary}</div>
          )}

          {/* Independently-scrolling content area (scroll-locked below full) */}
          <div
            ref={contentRef}
            className={`mbs-content${snapIndex < 2 ? ' mbs-content--locked' : ''}`}
          >
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
