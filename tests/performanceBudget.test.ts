import { GAMEPLAY } from '../src/game/config/Constants';
import { describe, expect, it } from 'vitest';

describe('runtime performance budgets', () => {
  it('keeps pooled and transient capacities within the supported slice budget', () => {
    expect(GAMEPLAY.maxEnemies).toBeLessThanOrEqual(80);
    expect(GAMEPLAY.maxPlayerProjectiles).toBeLessThanOrEqual(90);
    expect(GAMEPLAY.maxEnemyProjectiles).toBeLessThanOrEqual(100);
    expect(GAMEPLAY.maxXpOrbs).toBeLessThanOrEqual(160);
    expect(GAMEPLAY.maxTransientEffects).toBeLessThanOrEqual(180);
  });
});
