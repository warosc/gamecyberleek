export enum EnemyType {
  GRUNT = 'GRUNT',
  RUNNER = 'RUNNER',
  TANK = 'TANK',
  SHOOTER = 'SHOOTER',
  BOSS = 'BOSS',
}
export type EnemyBehavior = 'chase' | 'kite' | 'commander';
export type EliteAffix = 'OVERCHARGED' | 'ARMORED' | 'SWIFT';
export const ELITE_AFFIX_DEFS = {
  OVERCHARGED: { speedMultiplier: 1.28, healthMultiplier: 2.2, damageMultiplier: 1.45, color: 0xffb52e },
  ARMORED: { speedMultiplier: 1, healthMultiplier: 2.8, damageMultiplier: 1.1, color: 0x8ba5b8 },
  SWIFT: { speedMultiplier: 1.55, healthMultiplier: 1.5, damageMultiplier: 1.15, color: 0x21e6ff },
} as const;
export const ENEMY_DEFS = {
  [EnemyType.GRUNT]: { behavior: 'chase', speed: 80, hp: 40, damage: 8, size: 18, color: 0x5acb76, xp: 12 },
  [EnemyType.RUNNER]: { behavior: 'chase', speed: 145, hp: 24, damage: 6, size: 13, color: 0xf6d35e, xp: 10 },
  [EnemyType.TANK]: { behavior: 'chase', speed: 52, hp: 110, damage: 16, size: 27, color: 0xb476dd, xp: 28 },
  [EnemyType.SHOOTER]: { behavior: 'kite', speed: 68, hp: 55, damage: 10, size: 20, color: 0xff7b55, xp: 20 },
  [EnemyType.BOSS]: { behavior: 'commander', speed: 44, hp: 1800, damage: 24, size: 58, color: 0x8d3bd1, xp: 500 },
} as const;
