import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { WeatherPreset } from '@weatherchaser/core';
import { useAppStore } from '../../stores/appStore.ts';
import { BeachIcon, HikingIcon, SightseeingIcon } from '../finder/FinderIcons.tsx';
import './MobileSearchBar.css';

const PRESET_ICONS: Record<WeatherPreset, React.ComponentType<{ size?: number }>> = {
  beach: BeachIcon,
  hiking: HikingIcon,
  sightseeing: SightseeingIcon,
};

interface MobileSearchBarProps {
  isExpanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  hidden?: boolean; // Plan 03 sets true when sheet is at full → bar animates out
  /**
   * Expanded-state content. index.tsx passes the real <EntryPanel/>, which owns the
   * full entry+launch flow (mode CTAs, RouteConfigStep/WeatherFinderStep, and the hoisted
   * useOptimizer launch). This makes the search launchable from the top and is the SINGLE
   * search surface on mobile — there is no duplicate EntryPanel in the bottom sheet.
   */
  children?: ReactNode;
}

/**
 * Collapsed pill (compact selection summary) + inline-expanded search surface.
 *
 * OWNERSHIP BOUNDARY: This component owns ONLY the collapsed pill summary
 * (location + dates + criterion icon) and the expanded container chrome
 * (header + close). The actual search inputs and launch flow live in the
 * EntryPanel passed as `children` — the pill no longer renders its own
 * mode-toggle / inputs form, which removes the duplicate-menu problem.
 */
export function MobileSearchBar({ isExpanded, onExpandedChange, hidden = false, children }: MobileSearchBarProps) {
  const { t, i18n } = useTranslation('common');
  const { searchAreas, tripConfig, weatherPrefs } = useAppStore();

  // ── Derive collapsed pill label from store state ─────────────────────────────
  const locationName = searchAreas[0]?.type === 'place'
    ? searchAreas[0].name
    : searchAreas[0]?.type === 'radius'
      ? (searchAreas[0].name ?? null)
      : null;

  function formatDateFragment(): string | null {
    const { startDate, endDate } = tripConfig;
    if (!startDate) return null;

    const locale = i18n.language.startsWith('de') ? 'de-DE' : 'en-GB';
    const fmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });

    const start = new Date(startDate + 'T00:00:00');
    if (!endDate) return fmt.format(start);

    const end = new Date(endDate + 'T00:00:00');
    return `${fmt.format(start)}–${fmt.format(end)}`;
  }

  const dateFragment = formatDateFragment();
  const PresetIcon = PRESET_ICONS[weatherPrefs.preset];
  const criterionIcon = <PresetIcon size={14} />;

  function buildPillLabel(): string {
    const parts: string[] = [];
    if (locationName) parts.push(locationName);
    if (dateFragment) parts.push(dateFragment);
    return parts.length > 0 ? parts.join(' · ') : t('mobile.search_placeholder');
  }

  const pillLabel = buildPillLabel();

  return (
    <div
      className={[
        'mobile-search-bar',
        isExpanded ? 'mobile-search-bar--expanded' : '',
        hidden ? 'mobile-search-bar--hidden' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* ── Collapsed pill ───────────────────────────────────────────────────── */}
      {!isExpanded && (
        <button
          type="button"
          className="mobile-search-pill"
          aria-label={t('mobile.search_bar_open')}
          onClick={() => onExpandedChange(true)}
        >
          <span className="mobile-search-pill__label">{pillLabel}</span>
          {criterionIcon && (
            <span className="mobile-search-pill__icon" aria-hidden="true">
              {criterionIcon}
            </span>
          )}
        </button>
      )}

      {/* ── Expanded search surface ───────────────────────────────────────────── */}
      {isExpanded && (
        <div className="mobile-search-expanded">
          {/* Header row: title + close */}
          <div className="mobile-search-expanded__header">
            <span className="mobile-search-expanded__title">
              {t('mobile.search_bar_open')}
            </span>
            <button
              type="button"
              className="mobile-search-expanded__close"
              aria-label={t('mobile.search_bar_close')}
              onClick={() => onExpandedChange(false)}
            >
              {t('mobile.search_bar_close')}
            </button>
          </div>

          {/* Full entry + launch flow (EntryPanel), scrolls internally.
              This is the SINGLE search surface on mobile. */}
          <div className="mobile-search-body">{children}</div>
        </div>
      )}
    </div>
  );
}
