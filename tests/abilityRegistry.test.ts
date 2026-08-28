import { describe, expect, it } from 'vitest';
import { ABILITIES, chooseAbilities } from '../src/game/abilities/AbilityRegistry';

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
});
