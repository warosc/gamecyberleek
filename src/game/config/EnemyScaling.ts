import { BOSS_START_MS, MINIBOSS_START_MS } from './RunPacing';

/**
 * Enemy toughness over a run. Engine-free so the numbers can be unit tested.
 *
 * Why it exists: ENEMY_DEFS is fixed, while the player stacks flat damage. A typical level-12
 * build deals ~500–1600 DPS, so without scaling the late waves melt on contact, the 1800 HP
 * commander dies in 2–5 s (its phases 2 and 3 are almost never seen) and sector 3, which pays
 * ×1.5 credits, fields the same grunts as sector 1.
 */

/** +40 % health per minute of run time, linear: ×1.4 at 1:00, ×2.6 at the commander (4:00). */
export const HEALTH_GROWTH_PER_MINUTE = 0.4;
/**
 * Time stops counting at the commander's arrival. Reinforcements and brood splits during a long
 * boss fight would otherwise keep inflating (×3.0 at 5:00) while the player cannot level.
 */
export const TIME_SCALING_CAP_MS = BOSS_START_MS;
/** Sector 1 / 2 / 3 health. Sector 3 pays ×1.5 credits, so it should also hit about that hard. */
export const SECTOR_HEALTH_FACTORS = [1, 1.25, 1.55] as const;
/**
 * Contact damage per sector. Deliberately gentle and time-independent: health already makes the
 * late run longer, and player health does not scale, so damage growth compounds quickly.
 */
export const SECTOR_DAMAGE_FACTORS = [1, 1.1, 1.2] as const;
/** The commander should survive about this long against the player's sustained DPS. */
export const BOSS_TARGET_SECONDS = 15;
/** Ceiling relative to the sector base, so a degenerate build cannot make the fight endless. */
export const BOSS_HEALTH_CAP_MULTIPLIER = 6;
/** Highest threat level (AMENAZA V). Threat 0 is the normal operation every sector starts at. */
export const MAX_THREAT = 5;
/**
 * +15 % health per threat level, on top of time and sector: ×1.75 at AMENAZA V. Health only, like
 * the time scaling: contact damage already compounds against a player whose health does not scale.
 */
export const THREAT_HEALTH_STEP = 0.15;

function sectorIndex(sector: number) {
  return Math.min(Math.max(Math.floor(sector) || 0, 0), SECTOR_HEALTH_FACTORS.length - 1);
}

/** A threat level clamped to [0, MAX_THREAT]; anything unreadable is the normal operation. */
export function clampThreat(threat: number) {
  return Math.min(Math.max(Math.floor(threat) || 0, 0), MAX_THREAT);
}

/** ×1 at threat 0, +0.15 per level up to ×1.75 at AMENAZA V. */
export function threatHealthFactor(threat: number) {
  return 1 + THREAT_HEALTH_STEP * clampThreat(threat);
}

/** 1 + 0.4·minutes, clamped to [0, 4:00]. */
export function timeHealthFactor(survivalMs: number) {
  const ms = Math.min(Math.max(survivalMs, 0), TIME_SCALING_CAP_MS);
  return 1 + HEALTH_GROWTH_PER_MINUTE * (ms / 60000);
}

/** ×1 / ×1.25 / ×1.55; unknown sectors clamp to the nearest one. */
export function sectorHealthFactor(sector: number) {
  return SECTOR_HEALTH_FACTORS[sectorIndex(sector)];
}

/** ×1 / ×1.1 / ×1.2 contact damage; never scales with time. */
export function sectorDamageMultiplier(sector: number) {
  return SECTOR_DAMAGE_FACTORS[sectorIndex(sector)];
}

/**
 * Health multiplier for regular enemies created at `survivalMs` in `sector` at `threat`. Elite
 * affixes multiply on top of the scaled pool, so an elite stays ~2× its peers at any point of the run.
 */
export function enemyHealthMultiplier(survivalMs: number, sector: number, threat = 0) {
  return timeHealthFactor(survivalMs) * sectorHealthFactor(sector) * threatHealthFactor(threat);
}

/**
 * Miniboss health: base × sector × the time factor at its scheduled arrival (2:30 → ×2.0), so it
 * keeps pace with the wave around it. 560 base → 1120 / 1400 / 1736 by sector.
 */
export function minibossHealth(baseHp: number, sector: number, spawnMs = MINIBOSS_START_MS, threat = 0) {
  return Math.round(baseHp * enemyHealthMultiplier(spawnMs, sector, threat));
}

/**
 * Commander health: at least the sector base (1800 × sector factor), raised to last
 * ~15 s against the player's sustained DPS at spawn, and capped at 6× the sector base.
 * Time does not apply: the DPS term already measures how far the build has come. Threat multiplies
 * the result, floor and cap included: applied to the base alone it would vanish behind the DPS
 * term for exactly the strong builds that climb the threat levels.
 */
export function bossHealth(baseHp: number, sector: number, sustainedDps: number, threat = 0) {
  const base = baseHp * sectorHealthFactor(sector);
  const dps = Number.isFinite(sustainedDps) ? Math.max(0, sustainedDps) : 0;
  const target = Math.max(base, BOSS_TARGET_SECONDS * dps);
  return Math.round(Math.min(target, base * BOSS_HEALTH_CAP_MULTIPLIER) * threatHealthFactor(threat));
}

/**
 * Multiplies a health pool and refills it. Kept here rather than on Enemy so the rounding rule is
 * shared and testable: both `max` and `current` must move, or a fresh spawn reads as wounded.
 */
export function scaleHealthPool(health: { max: number; current: number }, multiplier: number) {
  health.max = Math.max(1, Math.round(health.max * multiplier));
  health.current = health.max;
  return health;
}
