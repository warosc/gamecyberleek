import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VEGETABLE_ART, VEGETABLE_ROSTER, vegetableAsset, type VegetableType } from '../src/game/entities/enemies/VegetableRoster';
import { webpInfo } from './webpInfo';

describe('Cyberleek enemy roster assets', () => {
  const types = Object.keys(VEGETABLE_ROSTER) as VegetableType[];
  it.each(types)('%s has a bounded transparent production sprite', type => {
    // Drawn at ~120 px in combat and ~180 px in the bestiary: 640 px keeps them sharp on a
    // high-density phone at a fraction of the old 1.4-1.8 MB PNG download.
    const file = readFileSync(`public/${vegetableAsset(type)}`);
    const info = webpInfo(file);
    expect(info.alpha).toBe(true);
    expect(Math.max(info.width, info.height)).toBeLessThanOrEqual(640);
    expect(file.length).toBeLessThan(200_000);
  });
  it('covers every role within a shared texture budget, loading each sprite once', () => {
    expect(types.sort()).toEqual(['BROOD', 'BULWARK', 'GRUNT', 'MEDIC', 'RUNNER', 'SHOOTER', 'TANK']);
    // Graded variants reuse a sprite, so the decoded budget counts distinct art only.
    expect(VEGETABLE_ART.sort()).toEqual(['carrot', 'eggplant', 'radish', 'tomato']);
    const total = VEGETABLE_ART.reduce((sum, art) => {
      const info = webpInfo(readFileSync(`public/assets/enemies/vegetables/${art}.webp`));
      return sum + info.width * info.height * 4;
    }, 0);
    expect(total).toBeLessThan(8 * 1024 * 1024);
  });
});

describe('dedicated sprite manifest', () => {
  const manifest = JSON.parse(readFileSync('public/assets/enemies/art-manifest.json', 'utf8')) as { sprites: { key: string; path: string }[] };
  it.each(manifest.sprites.map(sprite => [sprite.key, sprite.path]))('%s is a bounded RGBA sprite on disk', (_key, path) => {
    const png = readFileSync(`public/${path}`);
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect([3, 6]).toContain(png[25]);
    expect(png.readUInt32BE(16)).toBeLessThanOrEqual(2048);
    expect(png.readUInt32BE(20)).toBeLessThanOrEqual(2048);
    expect(png.length).toBeLessThan(2_000_000);
  });
  it('lists unique keys', () => {
    expect(new Set(manifest.sprites.map(sprite => sprite.key)).size).toBe(manifest.sprites.length);
  });
});
