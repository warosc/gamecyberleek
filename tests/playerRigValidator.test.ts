import { describe, expect, it } from 'vitest';
import { PLAYER_RIG_LAYERS, PLAYER_RIG_STATES } from '../src/game/entities/player/PlayerRigManifest';
import { validatePlayerRig } from '../src/game/entities/player/PlayerRigValidator';

describe('player rig validation', () => {
  it('rejects incomplete composite/reference exports', () => {
    const result = validatePlayerRig({ version: 1, layers: {}, animations: {} });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('missing layer: head');
    expect(result.errors).toContain('missing animation: death');
  });

  it('accepts a complete manifest contract', () => {
    const layers = Object.fromEntries(PLAYER_RIG_LAYERS.map((layer) => [layer, `layers/${layer}.png`]));
    const animations = Object.fromEntries(PLAYER_RIG_STATES.map((state) => [state, `animations/${state}`]));
    expect(validatePlayerRig({ version: 1, layers, animations }).valid).toBe(true);
  });
});
