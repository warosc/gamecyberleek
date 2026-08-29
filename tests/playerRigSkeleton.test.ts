import { describe, expect, it } from 'vitest';
import { PLAYER_RIG_LAYERS, type PlayerRigLayer } from '../src/game/entities/player/PlayerRigManifest';
import {
  PLAYER_RIG_SKELETON,
  RIG_TEXTURE_SIZE,
  rigOrigin,
  rigRestPosition,
  rigSolveOrder,
} from '../src/game/entities/player/PlayerRigSkeleton';

describe('player rig skeleton', () => {
  it('gives every exported layer a joint', () => {
    expect(Object.keys(PLAYER_RIG_SKELETON).sort()).toEqual([...PLAYER_RIG_LAYERS].sort());
  });

  it('is a single tree rooted at the torso', () => {
    const roots = PLAYER_RIG_LAYERS.filter((layer) => !PLAYER_RIG_SKELETON[layer].parent);
    expect(roots).toEqual(['torso']);
    // Walking up from every layer must terminate at the root, so no joint can be orphaned or
    // sit in a cycle that would make the forward-kinematics pass read a stale transform.
    for (const layer of PLAYER_RIG_LAYERS) {
      let cursor: PlayerRigLayer | undefined = layer;
      let hops = 0;
      while (cursor && hops <= PLAYER_RIG_LAYERS.length) {
        cursor = PLAYER_RIG_SKELETON[cursor].parent;
        hops++;
      }
      expect(hops).toBeLessThanOrEqual(PLAYER_RIG_LAYERS.length);
    }
  });

  it('orders the solve so a parent is always posed before its children', () => {
    const order = rigSolveOrder(PLAYER_RIG_LAYERS);
    expect(new Set(order).size).toBe(PLAYER_RIG_LAYERS.length);
    for (const layer of PLAYER_RIG_LAYERS) {
      const parent = PLAYER_RIG_SKELETON[layer].parent;
      if (parent) expect(order.indexOf(parent)).toBeLessThan(order.indexOf(layer));
    }
  });

  it('keeps every pivot inside the shared export canvas', () => {
    for (const layer of PLAYER_RIG_LAYERS) {
      const [x, y] = PLAYER_RIG_SKELETON[layer].pivot;
      expect(x).toBeGreaterThan(0);
      expect(y).toBeGreaterThan(0);
      expect(x).toBeLessThan(RIG_TEXTURE_SIZE);
      expect(y).toBeLessThan(RIG_TEXTURE_SIZE);
      const origin = rigOrigin(layer);
      expect(origin.x).toBeGreaterThan(0);
      expect(origin.x).toBeLessThan(1);
      expect(origin.y).toBeGreaterThan(0);
      expect(origin.y).toBeLessThan(1);
    }
  });

  it('places limb joints where the body actually bends', () => {
    // Guards against a pivot regression that would leave rotations swinging a limb around the
    // middle of the body: shoulders sit above elbows, elbows above wrists, hips above knees.
    const y = (layer: PlayerRigLayer) => PLAYER_RIG_SKELETON[layer].pivot[1];
    expect(y('arm-left-upper')).toBeLessThan(y('arm-left-fore'));
    expect(y('arm-left-fore')).toBeLessThan(y('hand-left'));
    expect(y('arm-right-upper')).toBeLessThan(y('arm-right-fore'));
    expect(y('arm-right-fore')).toBeLessThan(y('hand-right'));
    expect(y('thigh-left')).toBeLessThan(y('leg-left'));
    expect(y('leg-left')).toBeLessThan(y('boot-left'));
    expect(y('thigh-right')).toBeLessThan(y('leg-right'));
    expect(y('leg-right')).toBeLessThan(y('boot-right'));
    // The neck is above the waist, so the head hangs off the top of the torso.
    expect(y('head')).toBeLessThan(y('torso'));
  });

  it('mirrors left and right joints about the body centre line', () => {
    const pairs: Array<[PlayerRigLayer, PlayerRigLayer]> = [
      ['arm-left-upper', 'arm-right-upper'],
      ['thigh-left', 'thigh-right'],
      ['leg-left', 'leg-right'],
    ];
    for (const [left, right] of pairs) {
      expect(rigRestPosition(left).x).toBeLessThan(0);
      expect(rigRestPosition(right).x).toBeGreaterThan(0);
    }
  });
});
