import { describe, expect, it } from 'vitest';
import { INVENTORY_CAPACITY, RunInventory } from '../src/game/systems/RunInventory';
import { rollEquipment } from '../src/game/loot/Equipment';

describe('run inventory', () => {
  it('installs pieces and enforces six slots', () => {
    const inventory = new RunInventory();
    for (let index = 0; index < INVENTORY_CAPACITY; index++)
      expect(inventory.install(rollEquipment(1, () => 0.1))).toBe(true);
    expect(inventory.full).toBe(true);
    expect(inventory.count).toBe(6);
    expect(inventory.install(rollEquipment(1, () => 0.1))).toBe(false);
    expect(inventory.contents).toHaveLength(6);
  });
});
