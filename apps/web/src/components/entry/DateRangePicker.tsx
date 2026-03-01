import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/appStore.ts';

/* ── helpers ────────────────────────────────────────────── */

// Open-Meteo free tier: /v1/forecast supports up to 16 days ahead
const OPENMETEO_FORECAST_DAYS = 16;

function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isBefore(a: Date, b: Date): boolean {
  return a.getTime() < b.getTime();
}

function toIso(date: Date): string {
  return date.toISOString().split('T')[0];
}

function computeTotalDays(start: Date, end: Date): number {
  const msPerDay = 86400000;
  const diff = end.getTime() - start.getTime();
  return Math.max(1, Math.round(diff / msPerDay) + 1);
}

/** Format: "15. Mar – 22. Mar" or "15. Mar – 22. Mar 2026" */
function formatRange(start: Date | null, end: Date | null, locale: string): string {
  if (!start) return '';
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const startStr = start.toLocaleDateString(locale, opts);
  if (!end) return startStr;
  const endOpts: Intl.DateTimeFormatOptions = isSameYear(start, end)
    ? { day: 'numeric', month: 'short' }
    : { day: 'numeric', month: 'short', year: 'numeric' };
  return `${startStr} – ${end.toLocaleDateString(locale, endOpts)}`;
}

function isSameYear(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear();
}

/* ── CalendarMonth sub-component ───────────────────────── */

const WEEKDAYS_EN = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const WEEKDAYS_DE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

interface CalendarMonthProps {
  month: Date;       // First day of the month to render
  start: Date | null;
  end: Date | null;
  hovered: Date | null;
  onDayClick: (d: Date) => void;
  onDayHover: (d: Date | null) => void;
  minDate: Date;
  maxDate: Date;
  locale: string;
}

function CalendarMonth({
  month,
  start,
  end,
  hovered,
  onDayClick,
  onDayHover,
  minDate,
  maxDate,
  locale,
}: CalendarMonthProps) {
  const year = month.getFullYear();
  const monthIdx = month.getMonth();
  const totalDays = daysInMonth(year, monthIdx);

  // Day of week of first day (0=Sun…6=Sat → convert to Mon-first 0-6)
  const firstDow = new Date(year, monthIdx, 1).getDay();
  const offset = (firstDow + 6) % 7; // Mon-first offset

  const monthName = month.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const weekdays = locale.startsWith('de') ? WEEKDAYS_DE : WEEKDAYS_EN;

  const cells: Array<{ day: number | null }> = [];
  for (let i = 0; i < offset; i++) cells.push({ day: null });
  for (let d = 1; d <= totalDays; d++) cells.push({ day: d });

  // Effective end for range highlight (use hovered if no end selected)
  const effectiveEnd = end ?? (start && hovered ? hovered : null);

  function classForDay(d: number): string {
    const date = new Date(year, monthIdx, d);
    if (isBefore(date, minDate) || isBefore(maxDate, date)) return 'drp-day drp-day--disabled';

    const isStart = start && isSameDay(date, start);
    const isEnd = end && isSameDay(date, end);

    let inRange = false;
    if (start && effectiveEnd) {
      const s = isBefore(start, effectiveEnd) ? start : effectiveEnd;
      const e = isBefore(start, effectiveEnd) ? effectiveEnd : start;
      inRange = !isBefore(date, s) && !isBefore(e, date);
    }

    let cls = 'drp-day';
    if (isStart || isEnd) cls += ' drp-day--cap';
    if (inRange && !isStart && !isEnd) cls += ' drp-day--range';
    return cls;
  }

  return (
    <div className="drp-month">
      <div className="drp-month-title">{monthName}</div>
      <div className="drp-grid">
        {weekdays.map((wd) => (
          <div key={wd} className="drp-weekday">{wd}</div>
        ))}
        {cells.map((cell, idx) => {
          if (!cell.day) return <div key={`e${idx}`} />;
          const d = cell.day;
          const date = new Date(year, monthIdx, d);
          const disabled = isBefore(date, minDate) || isBefore(maxDate, date);
          return (
            <button
              key={d}
              type="button"
              className={classForDay(d)}
              disabled={disabled}
              onClick={() => !disabled && onDayClick(date)}
              onMouseEnter={() => !disabled && onDayHover(date)}
              title={isBefore(maxDate, date) ? `Max. ${OPENMETEO_FORECAST_DAYS} days ahead` : undefined}
              onMouseLeave={() => onDayHover(null)}
              aria-label={date.toLocaleDateString(locale, { dateStyle: 'medium' })}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── DateRangePicker main component ─────────────────────── */

export function DateRangePicker() {
  const { i18n } = useTranslation('common');
  const { t } = useTranslation('common');
  const { tripConfig, setTripConfig } = useAppStore();

  const [open, setOpen] = useState(false);
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [hovered, setHovered] = useState<Date | null>(null);
  const [viewMonth, setViewMonth] = useState<Date>(() => startOfMonth(today()));

  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const startDate = tripConfig.startDate ? new Date(tripConfig.startDate + 'T00:00:00') : null;
  const endDate = tripConfig.endDate ? new Date(tripConfig.endDate + 'T00:00:00') : null;

  const minDate = today();
  // Open-Meteo free tier supports up to OPENMETEO_FORECAST_DAYS days ahead
  const maxDate = addDays(today(), OPENMETEO_FORECAST_DAYS - 1);
  const locale = i18n.language ?? 'en';

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  function handleDayClick(date: Date) {
    if (!selectingEnd) {
      // Pick start, clear end, now wait for end
      setTripConfig({ startDate: toIso(date), endDate: null, totalDays: 7 });
      setSelectingEnd(true);
    } else {
      // Pick end
      const s = startDate!;
      const e = date;
      const [finalStart, finalEnd] = isBefore(s, e) ? [s, e] : [e, s];
      const totalDays = computeTotalDays(finalStart, finalEnd);
      setTripConfig({ startDate: toIso(finalStart), endDate: toIso(finalEnd), totalDays });
      setSelectingEnd(false);
      setOpen(false);
    }
  }

  function handleOpen() {
    setOpen(!open);
    // If opening fresh, reset selection state
    if (!open) {
      setSelectingEnd(Boolean(startDate && !endDate));
    }
  }

  const nextMonth = addMonths(viewMonth, 1);
  const label = startDate
    ? formatRange(startDate, endDate, locale)
    : t('entry.dates_placeholder');

  const showHint = open && selectingEnd;

  return (
    <div className="date-range-picker">
      <label className="input-label">{t('entry.dates')}</label>
      <button
        ref={triggerRef}
        type="button"
        className={`drp-trigger${open ? ' drp-trigger--open' : ''}${startDate ? ' drp-trigger--filled' : ''}`}
        onClick={handleOpen}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="drp-trigger-icon" aria-hidden="true">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="2.5" width="14" height="12.5" rx="2" stroke="currentColor" strokeWidth="1.4"/>
            <line x1="5" y1="1" x2="5" y2="4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="11" y1="1" x2="11" y2="4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="1" y1="7" x2="15" y2="7" stroke="currentColor" strokeWidth="1.2"/>
          </svg>
        </span>
        <span className={`drp-trigger-label${!startDate ? ' drp-trigger-label--placeholder' : ''}`}>
          {label}
        </span>
        {startDate && endDate && (
          <span className="drp-trigger-days">
            {tripConfig.totalDays}&nbsp;{t('route_config.days_suffix')}
          </span>
        )}
      </button>

      {open && (
        <div ref={panelRef} className="drp-popover" role="dialog" aria-modal="true" aria-label="Date range picker">
          {showHint && (
            <div className="drp-hint">{t('entry.dates_select_end')}</div>
          )}
          <div className="drp-months-row">
            <div className="drp-nav">
              <button
                type="button"
                className="drp-nav-btn"
                onClick={() => setViewMonth(addMonths(viewMonth, -1))}
                aria-label="Previous month"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <polyline points="9,2 4,7 9,12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <button
                type="button"
                className="drp-nav-btn"
                onClick={() => setViewMonth(addMonths(viewMonth, 1))}
                aria-label="Next month"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <polyline points="5,2 10,7 5,12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <CalendarMonth
              month={viewMonth}
              start={startDate}
              end={endDate}
              hovered={hovered}
              onDayClick={handleDayClick}
              onDayHover={setHovered}
              minDate={minDate}
              maxDate={maxDate}
              locale={locale}
            />
            <CalendarMonth
              month={nextMonth}
              start={startDate}
              end={endDate}
              hovered={hovered}
              onDayClick={handleDayClick}
              onDayHover={setHovered}
              minDate={minDate}
              maxDate={maxDate}
              locale={locale}
            />
          </div>
          {startDate && endDate && (
            <div className="drp-footer">
              <button
                type="button"
                className="drp-clear-btn"
                onClick={() => {
                  setTripConfig({ startDate: null, endDate: null, totalDays: 7 });
                  setSelectingEnd(false);
                }}
              >
                Clear
              </button>
              <span className="drp-footer-range">
                {formatRange(startDate, endDate, locale)} &middot; {tripConfig.totalDays} {t('route_config.days_suffix')}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
