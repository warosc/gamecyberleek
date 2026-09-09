import { currentViewportShape, DESIGN_HEIGHT, logicalWidthForViewport } from './ViewportLayout';

export const GAME_HEIGHT = DESIGN_HEIGHT;
export const GAME_WIDTH = logicalWidthForViewport(currentViewportShape());
export const ARENA = { width: 2000, height: 1200 } as const;
export const RUN_DURATION_MS = 5 * 60 * 1000;
export const GAMEPLAY = {
  chestFirstMs: 30000,
  chestIntervalMs: 45000,
  equipmentEveryLevels: 3,
  maxEnemies: 32,
  maxConcurrentAttacks: 3,
  maxPlayerProjectiles: 90,
  maxEnemyProjectiles: 100,
  maxXpOrbs: 160,
  maxTransientEffects: 96,
  spawnBaseIntervalMs: 900,
  spawnMinimumIntervalMs: 260,
  // Warning shown before a shot actually leaves the enemy. Section 13 of the product brief:
  // a dangerous attack has to communicate before it damages, and the lead has to stay tunable.
  telegraphLeadMs: { shooter: 650, miniboss: 800, boss: 550 },
  eliteStartMs: 120000,
  eliteMaxChance: 0.12,
  eliteAffixWeights: { OVERCHARGED: 55, ARMORED: 25, SWIFT: 20 },
  eliteAffixWeightsBySector: [
    { OVERCHARGED: 55, ARMORED: 25, SWIFT: 20 },
    { OVERCHARGED: 45, ARMORED: 30, SWIFT: 25 },
    { OVERCHARGED: 35, ARMORED: 35, SWIFT: 30 },
  ],
} as const;
export const COLORS = {
  navy: 0x07111f,
  cyan: 0x21e6ff,
  green: 0x73ef62,
  white: 0xeaffff,
  red: 0xff476f,
} as const;
export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  LEVEL_UP = 'LEVEL_UP',
  INVENTORY = 'INVENTORY',
  BOSS = 'BOSS',
  VICTORY = 'VICTORY',
  GAME_OVER = 'GAME_OVER',
}
export const Events = {
  PLAYER_DAMAGED: 'player-damaged',
  PLAYER_DIED: 'player-died',
  PLAYER_DASHED: 'player-dashed',
  ENEMY_DIED: 'enemy-died',
  XP_COLLECTED: 'xp-collected',
  XP_DISCOVERED: 'xp-discovered',
  PLAYER_LEVEL_UP: 'player-level-up',
  ABILITY_SELECTED: 'ability-selected',
  STATE_CHANGED: 'state-changed',
  BOSS_SPAWNED: 'boss-spawned',
  BOSS_HEALTH: 'boss-health',
  MINIBOSS_SPAWNED: 'miniboss-spawned',
  MINIBOSS_HEALTH: 'miniboss-health',
  MINIBOSS_DEFEATED: 'miniboss-defeated',
  CHEST_OPENED: 'chest-opened',
  LOOT_COLLECTED: 'loot-collected',
  LOOT_FOUND: 'loot-found',
  EQUIPMENT_CHANGED: 'equipment-changed',
  RUN_PHASE_CHANGED: 'run-phase-changed',
  WEAPON_EVOLVED: 'weapon-evolved',
  MOMENTUM_CHANGED: 'momentum-changed',
} as const;
