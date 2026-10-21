import { afterEach, describe, expect, it } from 'vitest';
import { runRandom, setRunSeed } from '../src/game/systems/RunRandom';

const draw = (stream: Parameters<typeof runRandom>[0], count: number) =>
  Array.from({ length: count }, () => runRandom(stream));

describe('run randomness', () => {
  afterEach(() => setRunSeed(undefined));

  it('replays the same rolls for the same daily seed', () => {
    setRunSeed('2026-10-21:fortified');
    const first = draw('spawn', 20);
    setRunSeed('2026-10-21:fortified');
    expect(draw('spawn', 20)).toEqual(first);
    setRunSeed('2026-10-22:fortified');
    expect(draw('spawn', 20)).not.toEqual(first);
  });

  // Different loot picks draw a different number of loot rolls; that must not shift the waves.
  it('keeps each stream independent of how much the others were used', () => {
    setRunSeed('daily');
    const waves = draw('spawn', 10);
    setRunSeed('daily');
    draw('loot', 37);
    draw('upgrades', 5);
    expect(draw('spawn', 10)).toEqual(waves);
  });

  it('stays in [0, 1) and falls back to Math.random when unseeded', () => {
    setRunSeed('range');
    for (const value of draw('contracts', 500)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
    setRunSeed(undefined);
    expect(new Set(draw('spawn', 10)).size).toBe(10);
  });
});
