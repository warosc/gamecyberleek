/** Contract for production-ready transparent layer exports. */
export const PLAYER_RIG_LAYERS = [
  'head',
  'hair-leaves',
  'glasses',
  'torso',
  'arm-left-upper',
  'arm-left-fore',
  'arm-right-upper',
  'arm-right-fore',
  'hand-left',
  'hand-right',
  'thigh-left',
  'thigh-right',
  'leg-left',
  'leg-right',
  'boot-left',
  'boot-right',
] as const;

export type PlayerRigLayer = (typeof PLAYER_RIG_LAYERS)[number];

export const PLAYER_RIG_STATES = ['idle', 'walk', 'attack', 'dash', 'hurt', 'death'] as const;
export type PlayerRigState = (typeof PLAYER_RIG_STATES)[number];

/** Expected export shape for the future layered renderer. */
export interface PlayerRigAssetManifest {
  version: 1;
  layers: Record<PlayerRigLayer, string>;
  animations: Partial<Record<PlayerRigState, string>>;
}
