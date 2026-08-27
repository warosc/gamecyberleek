import { describe, expect, it, vi } from 'vitest';
import { resolveDamage } from '../src/game/systems/CombatSystem';
import { EnemyDeathResolver } from '../src/game/systems/EnemyDeathResolver';
import { EnemyType } from '../src/game/entities/enemies/EnemyTypes';

describe('typed combat pipeline', () => {
  it('applies critical, armor and resistance in a deterministic order', () => {
    const hit = resolveDamage({
      baseAmount: 100,
      type: 'plasma',
      source: 'player',
      criticalChance: 0.5,
      armorReduction: 0.2,
      resistance: 0.25,
    }, 0.1);
    expect(hit).toEqual({ amount: 120, critical: true, type: 'plasma' });
  });

  it('clamps invalid mitigation and never returns negative damage', () => {
    expect(resolveDamage({
      baseAmount: 100,
      type: 'kinetic',
      source: 'enemy',
      armorReduction: 4,
      resistance: 4,
    }, 1).amount).toBe(0);
  });

  it('resolves rewards and destruction only once per enemy', () => {
    const destroy = vi.fn();
    const enemy = {
      x: 12,
      y: 34,
      xpReward: 90,
      enemyType: EnemyType.BOSS,
      health: { max: 1800 },
      destroy,
    };
    const resolver = new EnemyDeathResolver();
    expect(resolver.resolve(enemy)).toEqual({ x: 12, y: 34, xp: 90, boss: true, maxHealth: 1800 });
    expect(resolver.resolve(enemy)).toBeNull();
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
