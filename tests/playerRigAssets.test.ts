import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLAYER_RIG_LAYERS } from '../src/game/entities/player/PlayerRigManifest';

const root = resolve(process.cwd(), 'public/assets/character/leek/rig');

describe('player rig asset budget', () => {
  it('keeps every layer aligned, RGBA, and within the mobile download budget', () => {
    const dimensions = PLAYER_RIG_LAYERS.map((layer) => {
      const data = readFileSync(resolve(root, 'layers', `${layer}.png`));
      expect(data.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(data[25]).toBe(6); // PNG color type 6 = RGBA
      return { width: data.readUInt32BE(16), height: data.readUInt32BE(20), bytes: data.length };
    });
    expect(new Set(dimensions.map(({ width, height }) => `${width}x${height}`)).size).toBe(1);
    expect(dimensions.reduce((sum, value) => sum + value.bytes, 0)).toBeLessThan(400_000);
  });

  it('keeps all six animation manifests present and small', () => {
    const total = ['idle', 'walk', 'attack', 'dash', 'hurt', 'death']
      .map((state) => statSync(resolve(root, 'animations', `${state}.json`)).size)
      .reduce((sum, size) => sum + size, 0);
    expect(total).toBeLessThan(20_000);
  });
});
