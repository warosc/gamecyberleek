import type { PlayerRigLayer } from './PlayerRigManifest';

/**
 * Joint anchors for the separated layer exports.
 *
 * Every layer is a full-canvas 499x499 transparent export with its part already in place, so a
 * layer's texture centre is the middle of the *body*, not the middle of the part. Rotating an
 * image around that centre swings a thigh around the character's chest instead of bending it at
 * the hip, which is why the shipped keyframes could only afford rotations of a few hundredths of
 * a radian before the silhouette fell apart.
 *
 * The pivots below are measured from the alpha of each exported layer: the alpha-weighted centre
 * of the joint end of the part (the top band for a hanging limb, the bottom band for the head and
 * torso). With the image origin moved onto its joint, a rotation bends the limb where a limb
 * actually bends, and the parent links let a shoulder rotation carry the forearm and hand with it.
 */
export interface PlayerRigJoint {
  /** Layer this one hangs from. Undefined marks the root. */
  parent?: PlayerRigLayer;
  /** Joint position in texture pixels on the shared 499x499 export canvas. */
  pivot: readonly [number, number];
}

/** Every rig layer is exported on this square canvas; asserted by `tests/playerRigAssets.test.ts`. */
export const RIG_TEXTURE_SIZE = 499;

/**
 * The character's centre line in texture space. Layers are centred on the canvas, but the body is
 * drawn 13.5px right of it, so mirroring around the canvas centre shifted the character sideways
 * on every turn. Measuring local space from the body's own centre line makes the flip symmetric.
 */
export const RIG_BODY_CENTER_X = 263;

/** Vertical reference: the canvas centre, so the rig keeps the vertical placement it shipped with. */
export const RIG_BODY_CENTER_Y = RIG_TEXTURE_SIZE / 2;

/** Display scale applied to every layer image. */
export const RIG_LAYER_SCALE = 0.2;

export const PLAYER_RIG_SKELETON: Record<PlayerRigLayer, PlayerRigJoint> = {
  // Root. Rotating the torso at the waist carries the entire character.
  torso: { pivot: [263, 339] },
  head: { parent: 'torso', pivot: [266, 243] },
  // Glasses and leaves hang off the head, so forward kinematics already carries every head
  // rotation into them. Their own pivots are therefore the points they bend about on their
  // own: the bridge of the glasses, and the root where the leaves leave the scalp. Giving the
  // leaves the neck pivot instead put a 160px lever arm under their sway and threw them clear
  // of the head as soon as the character moved.
  glasses: { parent: 'head', pivot: [265, 170] },
  'hair-leaves': { parent: 'head', pivot: [252, 152] },
  'arm-left-upper': { parent: 'torso', pivot: [217, 220] },
  'arm-left-fore': { parent: 'arm-left-upper', pivot: [188, 285] },
  'hand-left': { parent: 'arm-left-fore', pivot: [185, 335] },
  'arm-right-upper': { parent: 'torso', pivot: [315, 220] },
  'arm-right-fore': { parent: 'arm-right-upper', pivot: [346, 286] },
  'hand-right': { parent: 'arm-right-fore', pivot: [352, 335] },
  'thigh-left': { parent: 'torso', pivot: [240, 329] },
  'leg-left': { parent: 'thigh-left', pivot: [227, 385] },
  'boot-left': { parent: 'leg-left', pivot: [222, 437] },
  'thigh-right': { parent: 'torso', pivot: [291, 330] },
  'leg-right': { parent: 'thigh-right', pivot: [308, 385] },
  'boot-right': { parent: 'leg-right', pivot: [317, 441] },
};

/** A joint's rest position in rig-local units, relative to the body centre line. */
export function rigRestPosition(layer: PlayerRigLayer) {
  const [x, y] = PLAYER_RIG_SKELETON[layer].pivot;
  return {
    x: (x - RIG_BODY_CENTER_X) * RIG_LAYER_SCALE,
    y: (y - RIG_BODY_CENTER_Y) * RIG_LAYER_SCALE,
  };
}

/** The joint expressed as a Phaser origin, so rotation happens at the joint itself. */
export function rigOrigin(layer: PlayerRigLayer) {
  const [x, y] = PLAYER_RIG_SKELETON[layer].pivot;
  return { x: x / RIG_TEXTURE_SIZE, y: y / RIG_TEXTURE_SIZE };
}

/**
 * Layers ordered so a parent is always solved before its children. Derived rather than written
 * out so adding a joint cannot silently produce a frame that reads a stale parent transform.
 */
export function rigSolveOrder(layers: readonly PlayerRigLayer[]): PlayerRigLayer[] {
  const ordered: PlayerRigLayer[] = [];
  const placed = new Set<PlayerRigLayer>();
  const place = (layer: PlayerRigLayer) => {
    if (placed.has(layer)) return;
    placed.add(layer);
    const parent = PLAYER_RIG_SKELETON[layer].parent;
    if (parent) place(parent);
    ordered.push(layer);
  };
  for (const layer of layers) place(layer);
  return ordered;
}
