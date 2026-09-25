import { reducedMotion, runtimeSettings } from '../systems/RuntimeSettings';

export type QualityTier = 'high' | 'balanced' | 'low';

export interface QualityProfile {
  tier: QualityTier;
  transientBudgetScale: number;
  impactParticles: number;
}

const PROFILES: Record<QualityTier, QualityProfile> = {
  high: { tier: 'high', transientBudgetScale: 1, impactParticles: 5 },
  balanced: { tier: 'balanced', transientBudgetScale: 0.75, impactParticles: 2 },
  low: { tier: 'low', transientBudgetScale: 0.5, impactParticles: 2 },
};

/** The player's explicit quality choice wins; `auto` falls back to device detection. */
export function detectQualityProfile(): QualityProfile {
  const preference = runtimeSettings().quality;
  if (preference !== 'auto') return PROFILES[preference];
  if (reducedMotion()) return PROFILES.low;
  const memory = typeof navigator !== 'undefined' ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory : undefined;
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined;
  if ((typeof memory === 'number' && memory <= 2) || (typeof cores === 'number' && cores <= 2)) return PROFILES.low;
  if ((typeof memory === 'number' && memory >= 8) && (typeof cores !== 'number' || cores >= 8)) return PROFILES.high;
  return PROFILES.balanced;
}
