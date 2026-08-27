export enum EnemyType {
  GRUNT = 'GRUNT',
  RUNNER = 'RUNNER',
  TANK = 'TANK',
  SHOOTER = 'SHOOTER',
  BOSS = 'BOSS',
}
export const ENEMY_DEFS = {
  [EnemyType.GRUNT]: { speed: 80, hp: 40, damage: 8, size: 18, color: 0x5acb76, xp: 12 },
  [EnemyType.RUNNER]: { speed: 145, hp: 24, damage: 6, size: 13, color: 0xf6d35e, xp: 10 },
  [EnemyType.TANK]: { speed: 52, hp: 110, damage: 16, size: 27, color: 0xb476dd, xp: 28 },
  [EnemyType.SHOOTER]: { speed: 68, hp: 55, damage: 10, size: 20, color: 0xff7b55, xp: 20 },
  [EnemyType.BOSS]: { speed: 44, hp: 1800, damage: 24, size: 58, color: 0x8d3bd1, xp: 500 },
} as const;
