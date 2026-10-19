import { describe, expect, it } from 'vitest';
import { orbPullSpeed } from '../src/game/systems/OrbMagnet';

describe('experience orb magnet', () => {
  it('leaves an orb outside the radius alone until it is captured', () => {
    expect(orbPullSpeed(200, 130, false, 220)).toBe(0);
  });

  // The old pull was 200 px/s at the radius edge, slower than the base 220 move speed: an orb
  // chasing a retreating player left the radius still moving and drifted off the arena.
  it('keeps homing a captured orb faster than the player can walk away', () => {
    expect(orbPullSpeed(500, 130, true, 220)).toBeGreaterThan(220);
    expect(orbPullSpeed(129, 130, false, 300)).toBeGreaterThan(300);
  });

  it('snaps in faster as the orb closes', () => {
    expect(orbPullSpeed(5, 130, true, 220)).toBeGreaterThan(orbPullSpeed(100, 130, true, 220));
  });
});
