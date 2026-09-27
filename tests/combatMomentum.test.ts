import { describe, expect, it } from 'vitest';
import { CombatMomentum, MOMENTUM_WINDOW_MS } from '../src/game/systems/CombatMomentum';

describe('combat momentum', () => {
  it('raises a bounded XP bonus every three chained kills', () => {
    const momentum = new CombatMomentum();
    expect(momentum.kill(0).xpMultiplier).toBe(1);
    expect(momentum.kill(500).chain).toBe(2);
    expect(momentum.kill(1000)).toMatchObject({ chain: 3, tier: 1, xpMultiplier: 1.1 });
    for (let kill = 4; kill <= 15; kill++) momentum.kill(kill * 100);
    expect(momentum.state).toMatchObject({ tier: 3, xpMultiplier: 1.3 });
  });

  it('expires after the response window and breaks when the player takes damage', () => {
    const momentum = new CombatMomentum();
    momentum.kill(100);
    momentum.kill(200);
    expect(momentum.update(200 + MOMENTUM_WINDOW_MS)).toBeUndefined();
    expect(momentum.update(201 + MOMENTUM_WINDOW_MS)?.chain).toBe(0);
    momentum.kill(3000);
    expect(momentum.break()?.chain).toBe(0);
    expect(momentum.break()).toBeUndefined();
  });
});
