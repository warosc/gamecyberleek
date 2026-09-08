import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VEGETABLE_ROSTER, vegetableAsset, type VegetableType } from '../src/game/entities/enemies/VegetableRoster';

describe('Cyberleek enemy roster assets', () => {
  const types = Object.keys(VEGETABLE_ROSTER) as VegetableType[];
  it.each(types)('%s has a bounded RGBA production sprite', type => {
    const png = readFileSync(`public/${vegetableAsset(type)}`);
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png[25]).toBe(6);
    expect(png.readUInt32BE(16)).toBeLessThanOrEqual(2048);
    expect(png.readUInt32BE(20)).toBeLessThanOrEqual(2048);
    expect(png.length).toBeLessThan(2_000_000);
  });
  it('covers every common role within a shared texture budget', () => {
    expect(types.sort()).toEqual(['GRUNT', 'RUNNER', 'SHOOTER', 'TANK']);
    const total = types.reduce((sum, type) => {
      const png = readFileSync(`public/${vegetableAsset(type)}`);
      return sum + png.readUInt32BE(16) * png.readUInt32BE(20) * 4;
    }, 0);
    expect(total).toBeLessThan(32 * 1024 * 1024);
  });
});
