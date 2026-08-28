export type QualityTier = 'high' | 'balanced' | 'low';

export interface QualityProfile {
  tier: QualityTier;
  transientBudgetScale: number;
  impactParticles: number;
}

export function detectQualityProfile(): QualityProfile {
  const memory = typeof navigator !== 'undefined' ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory : undefined;
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined;
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduced || (typeof memory === 'number' && memory <= 2) || (typeof cores === 'number' && cores <= 2))
    return { tier: 'low', transientBudgetScale: 0.5, impactParticles: 2 };
  if ((typeof memory === 'number' && memory >= 8) && (typeof cores !== 'number' || cores >= 8))
    return { tier: 'high', transientBudgetScale: 1, impactParticles: 5 };
  return { tier: 'balanced', transientBudgetScale: 0.75, impactParticles: 3 };
}
