import type { AudioEventId } from '../audio/AudioEvents';

/**
 * Not every hit deserves the same reaction.
 *
 * Before this table every impact in the game produced one identical spark, one identical
 * 45ms camera shake and one identical damage number, so a critical on an elite felt exactly
 * like chipping a grunt. The tiers below scale camera, particles, text and audio together so
 * the player can feel the difference between a graze and a kill without reading anything.
 *
 * Everything here is presentation. Damage, health and rewards are decided by the combat
 * pipeline; a tier only decides how loudly the result is announced.
 */
export type ImpactTier =
  | 'normal'
  | 'critical'
  | 'enemyDeath'
  | 'eliteDeath'
  | 'bossHit'
  | 'bossDeath';

export interface ImpactProfile {
  /** Camera shake, in milliseconds and Phaser shake intensity. Zero disables the shake. */
  shakeMs: number;
  shakeIntensity: number;
  /** Particle count for the spark or burst, before the device quality scale is applied. */
  particles: number;
  /** Radius the spark scatters into. */
  spread: number;
  /** Floating damage text. */
  textSize: number;
  textColor: string;
  /** Full-screen flash, used sparingly so it stays meaningful. */
  flash?: { durationMs: number; r: number; g: number; b: number };
  audio: AudioEventId;
}

export const IMPACT_PROFILES: Record<ImpactTier, ImpactProfile> = {
  normal: {
    shakeMs: 40,
    shakeIntensity: 0.0012,
    particles: 3,
    spread: 22,
    textSize: 16,
    textColor: '#dffcff',
    audio: 'enemy_hit',
  },
  critical: {
    shakeMs: 70,
    shakeIntensity: 0.0032,
    particles: 6,
    spread: 38,
    textSize: 25,
    textColor: '#fff27a',
    audio: 'critical_hit',
  },
  enemyDeath: {
    shakeMs: 55,
    shakeIntensity: 0.002,
    particles: 6,
    spread: 38,
    textSize: 16,
    textColor: '#dffcff',
    audio: 'enemy_death',
  },
  eliteDeath: {
    shakeMs: 130,
    shakeIntensity: 0.005,
    particles: 11,
    spread: 62,
    textSize: 19,
    textColor: '#ffb52e',
    audio: 'elite_death',
  },
  bossHit: {
    shakeMs: 55,
    shakeIntensity: 0.0022,
    particles: 5,
    spread: 30,
    textSize: 20,
    textColor: '#f4d7ff',
    audio: 'enemy_hit',
  },
  bossDeath: {
    // The one moment in a run that earns a full-screen flash and a long shake.
    shakeMs: 620,
    shakeIntensity: 0.012,
    particles: 16,
    spread: 110,
    textSize: 30,
    textColor: '#d566ff',
    flash: { durationMs: 420, r: 213, g: 102, b: 255 },
    audio: 'boss_death',
  },
};

export interface ImpactContext {
  critical: boolean;
  boss: boolean;
  elite: boolean;
  fatal: boolean;
}

/**
 * Picks the tier for one resolved hit.
 *
 * Order matters: a killing blow is announced as a death rather than as a critical, because the
 * death is the more important thing that just happened. Boss hits outrank criticals for the
 * same reason — the player needs to read progress against the boss above all else.
 */
export function resolveImpactTier(context: ImpactContext): ImpactTier {
  if (context.fatal) {
    if (context.boss) return 'bossDeath';
    if (context.elite) return 'eliteDeath';
    return 'enemyDeath';
  }
  if (context.boss) return 'bossHit';
  return context.critical ? 'critical' : 'normal';
}

export const impactProfile = (tier: ImpactTier) => IMPACT_PROFILES[tier];
