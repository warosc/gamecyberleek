export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const ARENA = { width: 2000, height: 1200 } as const;
export const RUN_DURATION_MS = 5 * 60 * 1000;
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
  GAME_OVER = 'GAME_OVER',
}
export const Events = {
  PLAYER_DAMAGED: 'player-damaged',
  PLAYER_DIED: 'player-died',
  ENEMY_DIED: 'enemy-died',
  XP_COLLECTED: 'xp-collected',
  PLAYER_LEVEL_UP: 'player-level-up',
  ABILITY_SELECTED: 'ability-selected',
  STATE_CHANGED: 'state-changed',
  BOSS_SPAWNED: 'boss-spawned',
  BOSS_HEALTH: 'boss-health',
  CHEST_OPENED: 'chest-opened',
  LOOT_COLLECTED: 'loot-collected',
  EQUIPMENT_CHANGED: 'equipment-changed',
} as const;
