import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLAYER_RIG_LAYERS, PLAYER_RIG_STATES } from '../src/game/entities/player/PlayerRigManifest';

const root = resolve(process.cwd(), 'public/assets/character/leek/rig/animations');

describe('player rig animation manifests', () => {
  for (const state of PLAYER_RIG_STATES) {
    it(`${state} has ordered keyframes within its duration`, () => {
      const animation = JSON.parse(readFileSync(resolve(root, `${state}.json`), 'utf8')) as {
        durationMs: number;
        keyframes: Array<{ timeMs: number; layers?: Record<string, unknown> }>;
      };
      expect(animation.durationMs).toBeGreaterThan(0);
      expect(animation.keyframes.length).toBeGreaterThan(1);
      let previous = -1;
      for (const frame of animation.keyframes) {
        expect(frame.timeMs).toBeGreaterThan(previous);
        expect(frame.timeMs).toBeLessThanOrEqual(animation.durationMs);
        for (const layer of Object.keys(frame.layers ?? {}))
          expect(PLAYER_RIG_LAYERS).toContain(layer);
        previous = frame.timeMs;
      }
      expect(previous).toBe(animation.durationMs);
    });
  }
});
