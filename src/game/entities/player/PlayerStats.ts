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
  bonusPiercing: number;
  splashRadius: number;
  chainTargets: number;
  chainRange: number;
  /** Burn damage per tick applied on hit; 0 disables. */
  burnDamage: number;
  /** Chill duration applied on hit; 0 disables. */
  chillDurationMs: number;
  /** Toxin damage per tick per stack applied on hit; 0 disables. */
  toxinDamage: number;
  /**
   * Fraction of movement removed by this build's chill (0.35 = 35 % slower). Carried as the chill
   * payload's potency so a second CRIO level can slow harder instead of only lasting longer.
   */
  chillSlow: number;
  /**
   * Damage each projectile beyond the first adds to a volley, as a share of one full shot. Full
   * damage per extra projectile made MULTI SHOT's first level +100 % DPS and, stacked with
   * ABANICO VERDE, a 7× volley that outclassed every other pick.
   */
  extraProjectileDamage: number;
  /** Scales the Q/E/R cooldowns; LEEK OVERCLOCK lowers it permanently. */
  specialCooldownMultiplier: number;
}
/**
 * Total damage of one volley relative to a single full shot: the first projectile counts in
 * full, every extra one adds `extraProjectileDamage`. Use it wherever DPS is estimated
 * (combat rating, boss health) so the estimate matches what the projectiles really deal.
 */
export const volleyDamageFactor = (stats: Pick<PlayerStats, 'projectileCount' | 'extraProjectileDamage'>) =>
  1 + Math.max(0, stats.projectileCount - 1) * stats.extraProjectileDamage;
/**
 * Damage factor carried by each projectile of a volley. The volley's total is spread evenly
 * rather than keeping a full-damage "first" shot: the spread fans every projectile off the aim
 * line (an even count has no centre one), so no single projectile is reliably the one that hits.
 */
export const projectileDamageShare = (stats: Pick<PlayerStats, 'projectileCount' | 'extraProjectileDamage'>) =>
  volleyDamageFactor(stats) / Math.max(1, stats.projectileCount);
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
  bonusPiercing: 0,
  splashRadius: 0,
  chainTargets: 0,
  chainRange: 0,
  burnDamage: 0,
  chillDurationMs: 0,
  toxinDamage: 0,
  chillSlow: 0,
  extraProjectileDamage: 0.5,
  specialCooldownMultiplier: 1,
});
