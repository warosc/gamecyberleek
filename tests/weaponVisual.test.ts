import { describe, expect, it } from 'vitest';
import { WEAPON_SILHOUETTES } from '../src/game/entities/player/WeaponSilhouettes';

describe('weapon silhouettes', () => {
  it('gives every weapon family a distinct profile and muzzle', () => {
    const specs = Object.values(WEAPON_SILHOUETTES);
    expect(specs).toHaveLength(4);
    expect(new Set(specs.map(spec => spec.accent)).size).toBe(4);
    expect(new Set(specs.map(spec => `${spec.bodyLength}x${spec.bodyHeight}`)).size).toBe(4);
    for (const spec of specs) expect(spec.muzzleDistance).toBeGreaterThanOrEqual(spec.bodyLength);
  });
});
