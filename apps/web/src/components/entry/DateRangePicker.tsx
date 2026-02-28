import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/appStore.ts';

export function DateRangePicker() {
  const { t } = useTranslation('common');
  const { tripConfig, setTripConfig } = useAppStore();

  const today = new Date().toISOString().split('T')[0];

  function handleFromChange(e: React.ChangeEvent<HTMLInputElement>) {
    const startDate = e.target.value || null;
    const endDate = tripConfig.endDate;

    // Clamp endDate to be >= startDate
    const clampedEnd =
      startDate && endDate && endDate < startDate ? startDate : endDate;

    const totalDays = computeTotalDays(startDate, clampedEnd);
    setTripConfig({ startDate, endDate: clampedEnd, totalDays });
  }

  function handleToChange(e: React.ChangeEvent<HTMLInputElement>) {
    const endDate = e.target.value || null;
    const startDate = tripConfig.startDate;
    const totalDays = computeTotalDays(startDate, endDate);
    setTripConfig({ endDate, totalDays });
  }

  function computeTotalDays(start: string | null, end: string | null): number {
    if (!start || !end) return 7;
    const msPerDay = 86400000;
    const diff = new Date(end).getTime() - new Date(start).getTime();
    return Math.max(1, Math.round(diff / msPerDay) + 1);
  }

  return (
    <div className="date-range-picker">
      <label className="input-label">{t('entry.dates')}</label>
      <div className="date-inputs-row">
        <input
          type="date"
          className="date-input"
          min={today}
          value={tripConfig.startDate ?? ''}
          onChange={handleFromChange}
          aria-label="From date"
        />
        <span className="date-separator">–</span>
        <input
          type="date"
          className="date-input"
          min={tripConfig.startDate ?? today}
          value={tripConfig.endDate ?? ''}
          onChange={handleToChange}
          aria-label="To date"
        />
      </div>
    </div>
  );
}
