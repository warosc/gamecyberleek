import { describe, expect, it } from 'vitest';
import { activeBuildSynergy, combatRating } from '../src/game/systems/BuildProgression';
import { createPlayerStats } from '../src/game/entities/player/PlayerStats';
import { rollEquipment } from '../src/game/loot/Equipment';

function sequence(values: number[]) {
  let index = 0;
  return () => values[index++] ?? 0;
}

describe('RPG build progression', () => {
  it('assigns visible item level and power from tier and rarity', () => {
    const item = rollEquipment(7, sequence([0.9, 0.1, 0.1]));
    expect(item.itemLevel).toBeGreaterThan(30);
    expect(item.power).toBeGreaterThan(30);
  });

  it('detects a weapon and armor set synergy', () => {
    const plasma = rollEquipment(3, sequence([0.1, 0.1, 0.99]));
    const bioSteel = rollEquipment(3, sequence([0.1, 0.9, 0.1]));
    expect(activeBuildSynergy([plasma, bioSteel], plasma)?.id).toBe('plague-bastion');
  });

  it('rolls modules as a separate equipment category', () => {
    const module = rollEquipment(4, sequence([0.1, 0.65, 0.4]));
    expect(module.kind).toBe('module');
    expect(module.id).toMatch(/^module\./);
    expect(module.modifiers.length).toBeGreaterThan(0);
  });

  it('summarizes combat values for the inventory sheet', () => {
    expect(combatRating(createPlayerStats())).toEqual({
      damage: 20, cadence: 3.3, dps: 67, critical: 5, armor: 0, speed: 220,
    });
  });
});
