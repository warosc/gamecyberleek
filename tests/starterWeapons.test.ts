import { describe, expect, it } from 'vitest';
import { createPlayerStats } from '../src/game/entities/player/PlayerStats';
import { applyStarterWeapon, STARTER_WEAPONS, starterWeapon } from '../src/game/weapons/WeaponRegistry';

describe('starter weapon loadouts', () => {
  it('offers three mechanically distinct weapons', () => {
    expect(STARTER_WEAPONS.map(weapon => weapon.id)).toEqual(['pulse', 'spore', 'arc']);
    const loadouts = STARTER_WEAPONS.map(weapon => {
      const stats = createPlayerStats();
      applyStarterWeapon(stats, weapon.id);
      return stats;
    });
    expect(loadouts[0].attackCooldown).toBeLessThan(loadouts[1].attackCooldown);
    expect(loadouts[1].splashRadius).toBeGreaterThan(0);
    expect(loadouts[2].chainTargets).toBe(2);
    expect(new Set(loadouts.map(stats => stats.weaponMode)).size).toBe(3);
  });

  it('falls back safely to Pulsegun for old or invalid run data', () => {
    expect(starterWeapon(undefined).id).toBe('pulse');
    expect(starterWeapon('old-save').id).toBe('pulse');
  });
});
