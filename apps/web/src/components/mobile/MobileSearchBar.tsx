import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/appStore.ts';
import { CRITERION_ICONS } from '../entry/criterionIcons.tsx';
import { DateRangePicker } from '../entry/DateRangePicker.tsx';
import { LocationInput } from '../entry/LocationInput.tsx';
import { CriteriaSelector } from '../entry/CriteriaSelector.tsx';
import './MobileSearchBar.css';

interface MobileSearchBarProps {
  isExpanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  hidden?: boolean; // Plan 03 sets true when sheet is at full → bar animates out
}

/**
 * Collapsed pill (compact selection) + inline-expanded selection form.
 *
 * OWNERSHIP BOUNDARY: This component owns ONLY the mode toggle + the three shared inputs
 * (DateRangePicker, LocationInput, CriteriaSelector). It does NOT render RouteConfigStep,
 * WeatherFinderStep, or call useOptimizer. The launch step stays in EntryPanel.
 */
export function MobileSearchBar({ isExpanded, onExpandedChange, hidden = false }: MobileSearchBarProps) {
  const { t, i18n } = useTranslation('common');
  const { searchAreas, tripConfig, mode, setMode } = useAppStore();

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
  const firstCriterion = tripConfig.criteria[0];
  const criterionIcon = firstCriterion ? CRITERION_ICONS[firstCriterion] : null;

  function buildPillLabel(): string {
    const parts: string[] = [];
    if (locationName) parts.push(locationName);
    if (dateFragment) parts.push(dateFragment);
    return parts.length > 0 ? parts.join(' · ') : t('mobile.search_placeholder');
  }

  const pillLabel = buildPillLabel();

  // ── Determine mode segment: route or finder ───────────────────────────────────
  const activeSegment: 'route' | 'finder' =
    mode === 'weather-finder' ? 'finder' : 'route';

  function handleSegmentClick(segment: 'route' | 'finder') {
    setMode(segment === 'finder' ? 'weather-finder' : 'route-config');
  }

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

      {/* ── Expanded selection form ───────────────────────────────────────────── */}
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

          {/* Mode toggle: two-segment control */}
          <div className="mobile-search-mode-toggle" role="group">
            <button
              type="button"
              className={[
                'mobile-search-mode-btn',
                activeSegment === 'route' ? 'mobile-search-mode-btn--active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => handleSegmentClick('route')}
            >
              {t('mobile.mode_route')}
            </button>
            <button
              type="button"
              className={[
                'mobile-search-mode-btn',
                activeSegment === 'finder' ? 'mobile-search-mode-btn--active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => handleSegmentClick('finder')}
            >
              {t('mobile.mode_finder')}
            </button>
          </div>

          {/* Three shared store-driven inputs — unchanged, no launch step */}
          <div className="mobile-search-inputs">
            <DateRangePicker />
            <LocationInput />
            <CriteriaSelector />
          </div>
        </div>
      )}
    </div>
  );
}
