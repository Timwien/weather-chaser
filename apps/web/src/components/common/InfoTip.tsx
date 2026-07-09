import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import './InfoTip.css';

interface InfoTipProps {
  /** Already-translated body text (caller does t()) */
  text: string;
  /** Icon diameter in px */
  size?: number;
  className?: string;
}

interface BubblePos {
  left: number;
  /** Set when the bubble opens below the icon (icon too close to viewport top) */
  top?: number;
  /** Set when the bubble opens above the icon (default) */
  bottom?: number;
}

const BUBBLE_MAX_WIDTH = 260;
const EDGE_MARGIN = 12;

/**
 * Tap-to-open info bubble behind an "i" icon. The bubble is portaled to
 * document.body with position:fixed — inside the mobile bottom sheet both
 * overflow clipping (.mbs-content) and the wrapper's transform (which breaks
 * fixed positioning for descendants) would otherwise misplace it.
 */
export function InfoTip({ text, size = 15, className }: InfoTipProps) {
  const { t } = useTranslation('common');
  const btnRef = useRef<HTMLButtonElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<BubblePos | null>(null);

  const open = pos !== null;

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (open) {
      setPos(null);
      return;
    }
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const vw = window.innerWidth;
    const halfWidth = Math.min(BUBBLE_MAX_WIDTH, vw - EDGE_MARGIN * 2) / 2;
    const centerX = Math.min(
      Math.max(rect.left + rect.width / 2, EDGE_MARGIN + halfWidth),
      vw - EDGE_MARGIN - halfWidth,
    );
    if (rect.top < 170) {
      setPos({ left: centerX, top: rect.bottom + 6 });
    } else {
      setPos({ left: centerX, bottom: window.innerHeight - rect.top + 6 });
    }
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (bubbleRef.current?.contains(target) || btnRef.current?.contains(target)) return;
      setPos(null);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setPos(null);
    }
    // Close on any scroll — the fixed-position bubble would drift from its anchor
    function onScroll() {
      setPos(null);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('scroll', onScroll, { capture: true });
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`info-tip-btn${className ? ` ${className}` : ''}`}
        aria-label={t('a11y.info')}
        aria-expanded={open}
        onClick={toggle}
      >
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
          <line x1="8" y1="7.4" x2="8" y2="11.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="8" cy="4.7" r="0.95" fill="currentColor" stroke="none" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={bubbleRef}
            className="info-tip-bubble"
            role="tooltip"
            style={{ left: pos.left, top: pos.top, bottom: pos.bottom }}
          >
            {text}
          </div>,
          document.body,
        )}
    </>
  );
}
