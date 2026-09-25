import { describe, expect, it } from 'vitest';
import { createPlayerStats } from '../src/game/entities/player/PlayerStats';
import { applyStarterWeapon } from '../src/game/weapons/WeaponRegistry';
import { applyWeaponMastery, masteryEarnedForRun, masteryRank } from '../src/game/weapons/WeaponMastery';

describe('weapon mastery', () => {
  it('uses stable rank thresholds and bounded run rewards', () => {
    expect([0, 9, 10, 29, 30, 59, 60].map(masteryRank)).toEqual([0, 0, 1, 1, 2, 2, 3]);
    expect(masteryEarnedForRun(4, false)).toBe(4);
    expect(masteryEarnedForRun(8, true)).toBe(13);
  });

  it.each(['pulse', 'spore', 'arc'] as const)('applies shared and unique rank bonuses to %s', weaponId => {
    const stats = createPlayerStats();
    applyStarterWeapon(stats, weaponId);
    const baseDamage = stats.attackDamage;
    const baseCooldown = stats.attackCooldown;
    expect(applyWeaponMastery(stats, weaponId, 60)).toBe(3);
    expect(stats.attackDamage).toBe(baseDamage + 3);
    expect(stats.attackCooldown).toBeCloseTo(baseCooldown * 0.95);
    if (weaponId === 'pulse') expect(stats.criticalChance).toBe(0.11);
    if (weaponId === 'spore') expect(stats.splashRadius).toBe(120);
    if (weaponId === 'arc') expect(stats.chainRange).toBe(210);
  });
});
