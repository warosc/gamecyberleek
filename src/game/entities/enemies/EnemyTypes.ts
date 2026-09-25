export enum EnemyType {
  GRUNT = 'GRUNT',
  RUNNER = 'RUNNER',
  TANK = 'TANK',
  SHOOTER = 'SHOOTER',
  MEDIC = 'MEDIC',
  BULWARK = 'BULWARK',
  BROOD = 'BROOD',
  MINIBOSS = 'MINIBOSS',
  BOSS = 'BOSS',
}
export type EnemyBehavior = 'chase' | 'kite' | 'support' | 'warden' | 'commander';
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
  [EnemyType.MEDIC]: { behavior: 'support', speed: 72, hp: 48, damage: 0, size: 18, color: 0x5dffb0, xp: 24 },
  [EnemyType.BULWARK]: { behavior: 'chase', speed: 46, hp: 150, damage: 14, size: 26, color: 0x7fb2ff, xp: 32 },
  [EnemyType.BROOD]: { behavior: 'chase', speed: 70, hp: 62, damage: 8, size: 21, color: 0xf2e36b, xp: 16 },
  [EnemyType.MINIBOSS]: { behavior: 'warden', speed: 58, hp: 560, damage: 18, size: 40, color: 0xd92b68, xp: 180 },
  [EnemyType.BOSS]: { behavior: 'commander', speed: 44, hp: 1800, damage: 24, size: 58, color: 0x8d3bd1, xp: 500 },
} as const;

/** Support and aura rules for the three families added after the core four. */
export const FAMILY_RULES = {
  /** Medic: telegraphed pulse that restores a share of nearby allies' health. */
  medic: { intervalMs: 3600, leadMs: 700, radius: 190, healFraction: 0.22 },
  /** Bulwark: allies inside the aura take reduced damage. Bosses are never shielded. */
  bulwark: { radius: 170, damageTaken: 0.55 },
  /** Brood: splits into runners on death, bounded by the enemy cap. */
  brood: { spawns: 2, spread: 34 },
} as const;
