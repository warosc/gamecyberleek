import type { PlayerStats } from '../entities/player/PlayerStats';
import type { StarterWeaponId } from './WeaponRegistry';

export type WeaponMastery = Record<StarterWeaponId, number>;

export const EMPTY_WEAPON_MASTERY: WeaponMastery = { pulse: 0, spore: 0, arc: 0 };
export const MASTERY_THRESHOLDS = [0, 10, 30, 60] as const;

export function masteryRank(points: number) {
  let rank = 0;
  for (let index = 1; index < MASTERY_THRESHOLDS.length; index++)
    if (points >= MASTERY_THRESHOLDS[index]) rank = index;
  return rank;
}

export function masteryEarnedForRun(level: number, victory: boolean) {
  return Math.max(1, Math.floor(level)) + (victory ? 5 : 0);
}

/** Small permanent bonuses reward commitment without overpowering a fresh save. */
export function applyWeaponMastery(stats: PlayerStats, weaponId: StarterWeaponId, points: number) {
  const rank = masteryRank(points);
  if (rank >= 1) stats.attackDamage += 3;
  if (rank >= 2) stats.attackCooldown *= 0.95;
  if (rank >= 3) {
    if (weaponId === 'pulse') stats.criticalChance += 0.03;
    if (weaponId === 'spore') stats.splashRadius += 12;
    if (weaponId === 'arc') stats.chainRange += 20;
  }
  return rank;
}
