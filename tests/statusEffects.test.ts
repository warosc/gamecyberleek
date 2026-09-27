import { describe, expect, it } from 'vitest';
import { BOSS_STATUS_SCALE, CHILL_SLOW, STATUS_TICK_MS, StatusEffects, TOXIN_MAX_STACKS } from '../src/game/systems/StatusEffects';

describe('status effects', () => {
  it('burns once per tick for its duration and then expires', () => {
    const status = new StatusEffects();
    status.apply({ kind: 'burn', potency: 4, durationMs: 2000 }, 0);
    expect(status.tick(STATUS_TICK_MS - 1)).toBe(0);
    expect(status.tick(2000)).toBe(16);
    expect(status.tick(5000)).toBe(0);
    expect(status.has('burn', 5000)).toBe(false);
  });

  it('refreshes burn to the strongest application instead of stacking', () => {
    const status = new StatusEffects();
    status.apply({ kind: 'burn', potency: 4, durationMs: 1000 }, 0);
    status.apply({ kind: 'burn', potency: 2, durationMs: 1000 }, 200);
    expect(status.tick(1000)).toBe(8);
  });

  it('stacks toxin up to its cap', () => {
    const status = new StatusEffects();
    for (let index = 0; index < 8; index++) status.apply({ kind: 'toxin', potency: 1, durationMs: 3000 }, index);
    expect(status.tick(STATUS_TICK_MS + 10)).toBe(TOXIN_MAX_STACKS);
  });

  it('slows with chill and scales every effect down on bosses', () => {
    const normal = new StatusEffects();
    normal.apply({ kind: 'chill', potency: 0, durationMs: 1000 }, 0);
    expect(normal.speedFactor(500)).toBeCloseTo(1 - CHILL_SLOW);
    expect(normal.speedFactor(1500)).toBe(1);
    const boss = new StatusEffects(true);
    boss.apply({ kind: 'chill', potency: 0, durationMs: 1000 }, 0);
    expect(boss.speedFactor(100)).toBeCloseTo(1 - CHILL_SLOW * BOSS_STATUS_SCALE);
    expect(boss.has('chill', 1000 * BOSS_STATUS_SCALE + 1)).toBe(false);
  });

  it('reports the dominant status for tinting', () => {
    const status = new StatusEffects();
    status.apply({ kind: 'chill', potency: 0, durationMs: 1000 }, 0);
    expect(status.dominant(10)).toBe('chill');
    status.apply({ kind: 'burn', potency: 1, durationMs: 1000 }, 0);
    expect(status.dominant(10)).toBe('burn');
  });
});
