import { describe, expect, it } from 'vitest';
import { PlayerStatusController } from '../src/game/entities/player/PlayerStatusController';

describe('player status controller', () => {
  it('extends shield and overdrive from the later of now and the current end', () => {
    const status = new PlayerStatusController();
    status.shield(1000, 3000);
    status.shield(2000, 3000);
    expect(status.isShielded(6999)).toBe(true);
    expect(status.isShielded(7000)).toBe(false);
    status.overdrive(10000, 1000);
    expect(status.damageMultiplier(10500)).toBe(1.5);
    expect(status.fireCooldownScale(10500)).toBe(0.5);
    expect(status.damageMultiplier(11000)).toBe(1);
  });

  it('refreshes chill to the longest remaining duration and slows movement', () => {
    const status = new PlayerStatusController();
    status.chill(0, 2000);
    status.chill(500, 500);
    expect(status.isChilled(1900)).toBe(true);
    expect(status.moveSpeedScale(1900)).toBeLessThan(1);
    expect(status.moveSpeedScale(2000)).toBe(1);
  });

  it('opens a short grace window after a hit', () => {
    const status = new PlayerStatusController();
    status.grace(100, 350);
    expect(status.inGrace(449)).toBe(true);
    expect(status.inGrace(450)).toBe(false);
  });
});
