import { describe, expect, it } from 'vitest';
import { createPlayerStats } from '../src/game/entities/player/PlayerStats';
import { rollEquipment } from '../src/game/loot/Equipment';

function sequence(values: number[]) {
  let index = 0;
  return () => values[index++] ?? 0;
}

describe('equipment progression', () => {
  it('applies a weapon drop to combat stats', () => {
    const stats = createPlayerStats();
    const item = rollEquipment(3, sequence([0.1, 0.1, 0.1]));
    item.apply(stats);
    expect(item.kind).toBe('weapon');
    expect(stats.attackDamage).toBeGreaterThan(20);
    expect(stats.weaponName).not.toBe('PULSEGUN-01');
    expect(item.id).toMatch(/^weapon\./);
    expect(item.modifiers.length).toBeGreaterThan(0);
  });

  it('applies armor without exceeding the mitigation cap', () => {
    const stats = createPlayerStats();
    const item = rollEquipment(30, sequence([0.1, 0.9, 0.1]));
    item.apply(stats);
    expect(item.kind).toBe('armor');
    expect(stats.maxHp).toBeGreaterThan(100);
    expect(stats.damageReduction).toBeLessThanOrEqual(0.55);
    expect(item.id).toMatch(/^armor\./);
    expect(item.modifiers.some((modifier) => modifier.key === 'maxHp')).toBe(true);
  });
});
