import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWeatherLayerStore, type WeatherLayerChoice } from '../../stores/weatherLayerStore.ts';
import './WeatherControls.css';

const OPTIONS: WeatherLayerChoice[] = ['off', 'weather'];

/** "Wetterebenen" toggle + layer picker popover, sits among the floating map controls. */
export function WeatherControls() {
  const { t } = useTranslation('common');
  const layer = useWeatherLayerStore((s) => s.layer);
  const setLayer = useWeatherLayerStore((s) => s.setLayer);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const active = layer !== 'off';

  return (
    <div className="wx-control" ref={rootRef}>
      <button
        type="button"
        className={`draw-btn wx-toggle${active ? ' wx-toggle--active' : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4.5 10.5a2.5 2.5 0 0 1 .3-4.98A3.5 3.5 0 0 1 11.5 6a2.25 2.25 0 0 1 0 4.5z" />
          <path d="M5.5 12.5l-.6 1.5M8.5 12.5l-.6 1.5M11.5 12.5l-.6 1.5" />
        </svg>
        {active ? t(`weather.layer_${layer}`) : t('weather.toggle')}
      </button>
      {open && (
        <div className="wx-popover" role="radiogroup" aria-label={t('weather.toggle')}>
          {OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              role="radio"
              aria-checked={layer === opt}
              className={`wx-option${layer === opt ? ' wx-option--on' : ''}`}
              onClick={() => { setLayer(opt); setOpen(false); }}
            >
              {t(`weather.layer_${opt}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
