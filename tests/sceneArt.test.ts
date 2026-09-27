import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
// SceneArt reads the quality tier, whose module chain imports Phaser; none of it runs here.
vi.mock('phaser', () => ({ default: {} }));

import { BACKDROPS, ICON_PATH } from '../src/game/config/SceneArt';
import { ARENA_THEMES } from '../src/game/config/ArenaDefinitions';
import { WORKSHOP_UPGRADES } from '../src/game/progression/Workshop';
import { STARTER_WEAPONS } from '../src/game/weapons/WeaponRegistry';
import { webpInfo } from './webpInfo';

const kb = (path: string) => statSync(`public/${path}`).size / 1024;
const isWebp = (path: string) => readFileSync(`public/${path}`).subarray(8, 12).toString('ascii') === 'WEBP';

describe('decorative scene art', () => {
  it.each(Object.entries(BACKDROPS))('backdrop %s is a small WebP', (_id, path) => {
    expect(isWebp(path)).toBe(true);
    expect(kb(path)).toBeLessThan(260);
  });

  it('every sector floor is a small WebP, and the lab floor stands in for sectors without one', () => {
    for (const theme of ARENA_THEMES) {
      if (!theme.floor) continue;
      expect(isWebp(theme.floor.path)).toBe(true);
      expect(kb(theme.floor.path)).toBeLessThan(420);
    }
    expect(existsSync('public/assets/maps/cyber-vegetable-lab-floor.webp')).toBe(true);
  });

  it('ships a transparent icon for every workshop upgrade and starter weapon', () => {
    const ids = [...WORKSHOP_UPGRADES.map(upgrade => `workshop-${upgrade.id}`), ...STARTER_WEAPONS.map(weapon => `weapon-${weapon.id}`)];
    for (const id of ids) {
      const path = ICON_PATH(id);
      const info = webpInfo(readFileSync(`public/${path}`));
      expect(info.alpha, id).toBe(true);
      expect(info.width, id).toBe(128);
      expect(kb(path), id).toBeLessThan(40);
    }
  });
});
