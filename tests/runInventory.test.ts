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

  it('replaces the active weapon without consuming another slot', () => {
    const inventory = new RunInventory();
    const first = rollEquipment(1, () => 0.1);
    const second = rollEquipment(4, () => 0.1);
    expect(inventory.equipWeapon(first)).toEqual({ accepted: true, replaced: undefined });
    expect(inventory.equipWeapon(second)).toEqual({ accepted: true, replaced: first });
    expect(inventory.count).toBe(2);
    expect(inventory.equippedWeapon).toBe(second);
    expect(inventory.contents).toEqual([first, second]);
    expect(inventory.activateWeapon(0)).toEqual({ accepted: true, previous: second, current: first });
    expect(inventory.recycle(1)).toBe(second);
    expect(inventory.count).toBe(1);
  });
});
