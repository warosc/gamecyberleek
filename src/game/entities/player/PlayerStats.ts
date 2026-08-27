export interface PlayerStats {
  maxHp: number;
  moveSpeed: number;
  dashSpeed: number;
  dashDuration: number;
  dashCooldown: number;
  attackDamage: number;
  attackCooldown: number;
  projectileSpeed: number;
  criticalChance: number;
  xpMultiplier: number;
  projectileCount: number;
  magnetRadius: number;
  damageReduction: number;
  weaponName: string;
  projectileColor: number;
  projectileScale: number;
  weaponMode: 'pulse' | 'arc' | 'laser' | 'plasma';
  projectilePiercing: number;
  splashRadius: number;
}
export const createPlayerStats = (): PlayerStats => ({
  maxHp: 100,
  moveSpeed: 220,
  dashSpeed: 600,
  dashDuration: 150,
  dashCooldown: 1000,
  attackDamage: 20,
  attackCooldown: 300,
  projectileSpeed: 700,
  criticalChance: 0.05,
  xpMultiplier: 1,
  projectileCount: 1,
  magnetRadius: 130,
  damageReduction: 0,
  weaponName: 'PULSEGUN-01',
  projectileColor: 0x21e6ff,
  projectileScale: 1,
  weaponMode: 'pulse',
  projectilePiercing: 0,
  splashRadius: 0,
});
