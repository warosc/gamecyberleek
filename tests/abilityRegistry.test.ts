import { describe, expect, it } from 'vitest';
import { ABILITIES, chooseAbilities, getAbilityById } from '../src/game/abilities/AbilityRegistry';
import { specialCooldownMs } from '../src/game/abilities/SpecialAbilities';
import {
  createPlayerStats,
  projectileDamageShare,
  volleyDamageFactor,
} from '../src/game/entities/player/PlayerStats';
import { CHILL_SLOW } from '../src/game/systems/StatusEffects';
import { STARTER_WEAPONS } from '../src/game/weapons/WeaponRegistry';

/** Applies `id` levels 1..`levels` to a fresh stat block, the way GameScene.selectAbility does. */
function picked(id: string, levels: number, stats = createPlayerStats()) {
  const ability = getAbilityById(id)!;
  for (let level = 1; level <= levels; level++) ability.apply(stats, level);
  return stats;
}

// Regression guard: chooseAbilities once reached for a global `Phaser`, which compiles
// cleanly (Phaser's types declare a global namespace) but throws "Phaser is not defined"
// under ESM at runtime. Nothing executed it, so tsc, eslint and the suite all stayed green
// while the first level-up killed the game loop. These tests call it for real.

describe('ability registry', () => {
  it('offers three level-up choices without throwing', () => {
    const options = chooseAbilities(new Map());
    expect(options).toHaveLength(3);
    expect(new Set(options.map((option) => option.id)).size).toBe(3);
  });

  it('excludes abilities already at their maximum level', () => {
    const maxed = new Map(ABILITIES.map((ability) => [ability.id, ability.maxLevel]));
    expect(chooseAbilities(maxed)).toEqual([]);

    const allButOne = new Map(maxed);
    allButOne.set('power', 0);
    expect(chooseAbilities(allButOne).map((option) => option.id)).toEqual(['power']);
  });

  it('returns fewer options than requested when the pool is small', () => {
    const levels = new Map(
      ABILITIES.slice(2).map((ability) => [ability.id, ability.maxLevel] as const),
    );
    expect(chooseAbilities(levels)).toHaveLength(2);
  });

  // AGUJA DE PLASMA was a milestone option; when the weapon protocol took its milestone slot it
  // stayed excluded from the random draw too, so it could never be offered again.
  it('can offer every ability that is not reserved for the timed milestones', () => {
    const milestoneOnly = ['fan', 'phase_dash', 'pulse_protocol', 'spore_protocol', 'arc_protocol'];
    const maxed = new Map(ABILITIES.map((ability) => [ability.id, ability.maxLevel]));
    for (const ability of ABILITIES) {
      const levels = new Map(maxed);
      levels.set(ability.id, 0);
      const offered = chooseAbilities(levels).map((option) => option.id);
      expect(offered, ability.id).toEqual(milestoneOnly.includes(ability.id) ? [] : [ability.id]);
    }
  });
});

describe('level-up upgrade balance', () => {
  it('gives every starter weapon the same share from POWER SHOT', () => {
    const gains = STARTER_WEAPONS.map((weapon) => {
      const stats = createPlayerStats();
      weapon.apply(stats);
      const base = stats.attackDamage;
      return picked('power', 3, stats).attackDamage / base;
    });
    for (const gain of gains) expect(gain).toBeCloseTo(1.3 ** 3, 6);
    // Level 3 stays near the old +24 on the pulse gun (18 base, 21 with mastery): ×2.14–2.33.
    expect(STARTER_WEAPONS[0].id).toBe('pulse');
    expect(gains[0]).toBeGreaterThan(2.1);
    expect(gains[0]).toBeLessThan(2.35);
  });

  it('makes extra projectiles add half a shot each instead of a full one', () => {
    const one = createPlayerStats();
    expect(volleyDamageFactor(one)).toBe(1);
    expect(projectileDamageShare(one)).toBe(1);
    const multi = picked('multi', 1);
    expect(multi.projectileCount).toBe(2);
    expect(volleyDamageFactor(multi)).toBe(1.5);
    expect(projectileDamageShare(multi)).toBe(0.75);
    // MULTI 3 + ABANICO 3: seven projectiles used to be a 7x volley.
    const stacked = picked('fan', 3, picked('multi', 3));
    expect(stacked.projectileCount).toBe(7);
    expect(volleyDamageFactor(stacked)).toBe(4);
  });

  it('turns LEEK OVERCLOCK into a permanent cut to the special cooldowns', () => {
    const stats = picked('overdrive', 3);
    expect(stats.specialCooldownMultiplier).toBeCloseTo(0.88 ** 3, 10);
    expect(specialCooldownMs('nova', stats.specialCooldownMultiplier)).toBeCloseTo(8000 * 0.88 ** 3, 6);
    expect(specialCooldownMs('overdrive')).toBe(18000);
  });

  it('adds XP gain to MAGNET alongside the pickup radius', () => {
    const stats = picked('magnet', 4);
    expect(stats.magnetRadius).toBe(createPlayerStats().magnetRadius + 220);
    expect(stats.xpMultiplier).toBeCloseTo(1.4, 10);
  });

  it('makes the second CRIO level slow harder as well as longer', () => {
    const first = picked('cryo', 1);
    expect(first).toMatchObject({ chillDurationMs: 1500, chillSlow: CHILL_SLOW });
    expect(picked('cryo', 2)).toMatchObject({ chillDurationMs: 3000, chillSlow: 0.5 });
  });
});
