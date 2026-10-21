import { useIsMobile } from './useIsMobile.ts';

const GUTTER_PX = 16; // panels sit --space-4 from the viewport edge; keep the same gap on the map side

/**
 * Horizontal space (px) that the floating side panel covers on the map's left edge.
 * 0 on mobile (the panel is a bottom sheet there). Used as MapLibre `padding.left`
 * and to centre map hints over the visible part of the map (D5).
 */
export function usePanelInset(): number {
  const isMobile = useIsMobile();
  if (isMobile || typeof document === 'undefined') return 0;
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--panel-width');
  const width = parseFloat(raw) || 390;
  return Math.round(width + 2 * GUTTER_PX);
}
