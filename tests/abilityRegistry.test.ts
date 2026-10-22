import { afterEach, describe, expect, it } from 'vitest';
import {
  ABILITIES,
  chooseAbilities,
  getAbilityById,
  milestoneOffer,
  signatureAbilityId,
  upgradeOffer,
} from '../src/game/abilities/AbilityRegistry';
import { specialCooldownMs } from '../src/game/abilities/SpecialAbilities';
import {
  createPlayerStats,
  projectileDamageShare,
  volleyDamageFactor,
} from '../src/game/entities/player/PlayerStats';
import { setRunSeed } from '../src/game/systems/RunRandom';
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

  it('adds only the run weapon signature protocol to the regular draw when asked', () => {
    const maxed = new Map(ABILITIES.map((ability) => [ability.id, ability.maxLevel]));
    for (const id of ['pulse_protocol', 'spore_protocol', 'arc_protocol']) {
      const levels = new Map(maxed);
      levels.set(id, 0);
      expect(chooseAbilities(levels, 3, { signature: 'spore_protocol' }).map(option => option.id), id)
        .toEqual(id === 'spore_protocol' ? [id] : []);
    }
  });
});

describe('upgrade offers', () => {
  afterEach(() => setRunSeed(undefined));
  const ids = (offer: { id: string }[]) => offer.map(option => option.id);
  const exclusive = ['fan', 'phase_dash'];

  // The signature has three levels and there were exactly three milestones offering the same
  // three cards, so evolving the weapon meant taking it every time.
  it('leads each milestone with the signature, one exclusive card and a third from the rest', () => {
    for (let seed = 0; seed < 50; seed++) {
      setRunSeed(`milestone-${seed}`);
      const offer = ids(milestoneOffer(new Map(), 'spore'));
      expect(offer).toHaveLength(3);
      expect(new Set(offer).size).toBe(3);
      expect(offer[0]).toBe('spore_protocol');
      expect(exclusive).toContain(offer[1]);
      expect(offer[2]).not.toMatch(/_protocol$/);
    }
  });

  it('varies the milestone hand instead of always showing the same three cards', () => {
    const hands = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      setRunSeed(`variety-${seed}`);
      hands.add(ids(milestoneOffer(new Map(), 'pulse')).join(','));
    }
    expect(hands.size).toBeGreaterThan(5);
  });

  it('fills a milestone from the regular pool once the signature and exclusives are maxed', () => {
    const levels = new Map([['pulse_protocol', 3], ['fan', 3], ['phase_dash', 3]]);
    const offer = ids(milestoneOffer(levels, 'pulse'));
    expect(offer).toHaveLength(3);
    for (const id of offer) expect(['pulse_protocol', ...exclusive]).not.toContain(id);
  });

  it('never offers a maxed ability at a milestone', () => {
    const maxed = new Map(ABILITIES.map((ability) => [ability.id, ability.maxLevel]));
    expect(milestoneOffer(maxed, 'arc')).toEqual([]);
    maxed.set('crit', 0);
    expect(ids(milestoneOffer(maxed, 'arc'))).toEqual(['crit']);
  });

  it('lets regular level-ups offer the signature only after the first milestone', () => {
    const regularMaxed = new Map(ABILITIES.filter(a => !a.id.endsWith('_protocol')).map(a => [a.id, a.maxLevel]));
    expect(upgradeOffer(regularMaxed, 'arc', { milestone: false, milestonesReached: 0 })).toEqual([]);
    const after = upgradeOffer(regularMaxed, 'arc', { milestone: false, milestonesReached: 1 });
    expect(ids(after)).toEqual([signatureAbilityId('arc')]);
  });

  it('keeps the weapon evolvable after skipping the protocol at a milestone', () => {
    // Skipped at the first milestone: two regular level-ups and the last milestone still reach 3.
    const othersMaxed = new Map(ABILITIES.filter(a => a.id !== 'pulse_protocol').map(a => [a.id, a.maxLevel]));
    for (let level = 0; level < 3; level++) {
      const offer = level < 2
        ? upgradeOffer(othersMaxed, 'pulse', { milestone: false, milestonesReached: 1 })
        : upgradeOffer(othersMaxed, 'pulse', { milestone: true, milestonesReached: 3 });
      expect(ids(offer)).toEqual(['pulse_protocol']);
      othersMaxed.set('pulse_protocol', level + 1);
    }
    expect(upgradeOffer(othersMaxed, 'pulse', { milestone: true, milestonesReached: 3 })).toEqual([]);
  });

  it('rerolls into cards the previous hand did not show, keeping the milestone signature', () => {
    for (let seed = 0; seed < 30; seed++) {
      setRunSeed(`reroll-${seed}`);
      const first = ids(chooseAbilities(new Map()));
      const second = ids(chooseAbilities(new Map(), 3, { avoid: new Set(first) }));
      expect(second.filter(id => first.includes(id))).toEqual([]);

      const milestone = ids(milestoneOffer(new Map(), 'pulse'));
      const rerolled = ids(milestoneOffer(new Map(), 'pulse', { avoid: new Set(milestone) }));
      expect(rerolled[0]).toBe('pulse_protocol');
      // The exclusive slot swaps to the other exclusive unless the first hand already showed both
      // (the third card is drawn from everything else, exclusives included); the third is new.
      if (!exclusive.includes(milestone[2])) expect(rerolled[1]).not.toBe(milestone[1]);
      expect(milestone).not.toContain(rerolled[2]);
    }
  });

  it('repeats a card on reroll only when the pool has nothing fresh left', () => {
    const levels = new Map(ABILITIES.map((ability) => [ability.id, ability.maxLevel]));
    for (const id of ['rapid', 'power', 'boots', 'crit']) levels.set(id, 0);
    const offer = ids(chooseAbilities(levels, 3, { avoid: new Set(['rapid', 'power', 'boots']) }));
    expect(offer[0]).toBe('crit');
    expect(offer).toHaveLength(3);
  });

  it('draws the same offers and rerolls for the same daily seed', () => {
    const run = () => {
      setRunSeed('2026-10-22:fortified');
      const milestone = ids(milestoneOffer(new Map(), 'arc'));
      const reroll = ids(milestoneOffer(new Map(), 'arc', { avoid: new Set(milestone) }));
      const regular = ids(upgradeOffer(new Map(), 'arc', { milestone: false, milestonesReached: 1 }));
      return [milestone, reroll, regular];
    };
    expect(run()).toEqual(run());
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
