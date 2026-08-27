import { describe, expect, it } from 'vitest';
import { calculateDamage } from '../src/game/systems/CombatSystem';
import { ExperienceSystem, xpForLevel } from '../src/game/systems/ExperienceSystem';
import { ABILITIES, getAbilityById } from '../src/game/abilities/AbilityRegistry';
import { createPlayerStats } from '../src/game/entities/player/PlayerStats';
import { HealthComponent } from '../src/game/components/HealthComponent';
describe('game logic', () => {
  it('calculates normal and critical damage', () => {
    expect(calculateDamage(20, 0.05, 0.5)).toEqual({ amount: 20, critical: false });
    expect(calculateDamage(20, 0.05, 0.01)).toEqual({ amount: 40, critical: true });
  });
  it('handles multiple level thresholds and remainder', () => {
    const xp = new ExperienceSystem();
    expect(xp.add(xpForLevel(1) + xpForLevel(2) + 5)).toBe(2);
    expect(xp.level).toBe(3);
    expect(xp.xp).toBe(5);
  });
  it('applies and resolves stat upgrades by stable id', () => {
    const stats = createPlayerStats();
    getAbilityById('power')!.apply(stats, 1);
    expect(stats.attackDamage).toBe(28);
    expect(getAbilityById('missing')).toBeUndefined();
    expect(ABILITIES.every((a) => a.maxLevel > 0)).toBe(true);
  });
  it('clamps damage and healing', () => {
    const health = new HealthComponent(100);
    expect(health.damage(130)).toBe(100);
    expect(health.dead).toBe(true);
    health.heal(500);
    expect(health.current).toBe(100);
  });
});
