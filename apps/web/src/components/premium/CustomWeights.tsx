import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ScoringWeights } from '@weatherchaser/core';
import { PRESETS } from '@weatherchaser/core';
import { useAppStore } from '../../stores/appStore.ts';
import { useSubscriptionStore } from '../../stores/subscriptionStore.ts';
import { PREMIUM_FREE_BETA } from '../../lib/premiumBeta.ts';
import { UpgradeModal } from './UpgradeModal.tsx';
import './CustomWeights.css';

const DIMENSIONS = ['sunshine', 'precipitation', 'temperature', 'wind'] as const;

/** Normalizes raw slider values so the weights sum to 1 (optimizer contract). */
function normalizeWeights(raw: ScoringWeights): ScoringWeights {
  const sum = raw.sunshine + raw.precipitation + raw.temperature + raw.wind;
  if (sum <= 0) return { sunshine: 0.25, precipitation: 0.25, temperature: 0.25, wind: 0.25 };
  return {
    sunshine: raw.sunshine / sum,
    precipitation: raw.precipitation / sum,
    temperature: raw.temperature / sum,
    wind: raw.wind / sum,
  };
}

/**
 * Premium custom scoring weights (Phase 4).
 *
 * Free tier: sliders render locked (dimmed, non-interactive) with an upgrade
 * CTA — this is UX gating only; the server-side gate is /api/premium/validate.
 * Premium tier: sliders adjust weatherPrefs.customWeights (normalized to sum 1).
 */
export function CustomWeights() {
  const { t } = useTranslation('common');
  const { weatherPrefs, setWeatherPrefs } = useAppStore();
  const tier = useSubscriptionStore((s) => s.tier);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const isPremium = tier === 'premium';
  const enabled = weatherPrefs.customWeights !== null;
  // Slider display values: current custom weights or the active preset
  const weights = weatherPrefs.customWeights ?? PRESETS[weatherPrefs.preset] ?? PRESETS.sightseeing;

  function handleToggle() {
    if (!isPremium) {
      setShowUpgrade(true);
      return;
    }
    setWeatherPrefs({ customWeights: enabled ? null : { ...weights } });
  }

  function handleChange(dim: (typeof DIMENSIONS)[number], value: number) {
    const raw = { ...weights, [dim]: value / 100 };
    setWeatherPrefs({ customWeights: normalizeWeights(raw) });
  }

  return (
    <div className={`custom-weights${!isPremium ? ' custom-weights--locked' : ''}`}>
      <div className="custom-weights-header">
        <span className="custom-weights-title">
          {t('premium.weights_title')}
          <span className="custom-weights-badge">
            {PREMIUM_FREE_BETA ? t('premium.beta_badge') : t('premium.badge')}
          </span>
        </span>
        {isPremium && (
          <button type="button" className="custom-weights-toggle" onClick={handleToggle}>
            {enabled ? t('premium.weights_use_preset') : t('premium.weights_customize')}
          </button>
        )}
      </div>

      {DIMENSIONS.map((dim) => (
        <div className="custom-weights-row" key={dim}>
          <span className="custom-weights-label">{t(`entry.criteria_options.${dim}`)}</span>
          <input
            type="range"
            className="custom-weights-slider"
            min={0}
            max={100}
            step={5}
            value={Math.round(weights[dim] * 100)}
            disabled={!isPremium || !enabled}
            onChange={(e) => handleChange(dim, Number(e.target.value))}
            aria-label={t(`entry.criteria_options.${dim}`)}
          />
          <span className="custom-weights-value">{Math.round(weights[dim] * 100)}%</span>
        </div>
      ))}

      {!isPremium && (
        <div className="custom-weights-lock">
          <span className="custom-weights-lock-text">{t('premium.weights_locked')}</span>
          <button
            type="button"
            className="custom-weights-upgrade-btn"
            onClick={() => setShowUpgrade(true)}
          >
            {t('premium.upgrade_cta')}
          </button>
        </div>
      )}

      <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </div>
  );
}
