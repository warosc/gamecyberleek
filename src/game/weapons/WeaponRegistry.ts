import type { PlayerStats } from '../entities/player/PlayerStats';

export type StarterWeaponId = 'pulse' | 'spore' | 'arc';

export interface StarterWeapon {
  id: StarterWeaponId;
  name: string;
  role: string;
  description: string;
  color: number;
  apply: (stats: PlayerStats) => void;
}

export const STARTER_WEAPONS: readonly StarterWeapon[] = [
  {
    id: 'pulse', name: 'PULSEGUN-01', role: 'PRECISION',
    description: 'Fast shots · High critical chance', color: 0x21e6ff,
    apply: stats => Object.assign(stats, {
      weaponName: 'PULSEGUN-01', weaponMode: 'pulse', attackDamage: 18, attackCooldown: 230,
      projectileSpeed: 780, criticalChance: 0.08, projectileColor: 0x21e6ff,
      projectileScale: 1, projectilePiercing: 0, splashRadius: 0, chainTargets: 0, chainRange: 0,
    }),
  },
  {
    id: 'spore', name: 'SPORE CANNON', role: 'DEMOLITION',
    description: 'Slow shells · Area explosions', color: 0xd566ff,
    apply: stats => Object.assign(stats, {
      weaponName: 'SPORE CANNON', weaponMode: 'plasma', attackDamage: 38, attackCooldown: 650,
      projectileSpeed: 430, criticalChance: 0.04, projectileColor: 0xd566ff,
      projectileScale: 1.85, projectilePiercing: 0, splashRadius: 108, chainTargets: 0, chainRange: 0,
    }),
  },
  {
    id: 'arc', name: 'ARC LEEK', role: 'CROWD CONTROL',
    description: 'Electric bolts · Chains to 2 targets', color: 0x73ef62,
    apply: stats => Object.assign(stats, {
      weaponName: 'ARC LEEK', weaponMode: 'arc', attackDamage: 15, attackCooldown: 380,
      projectileSpeed: 650, criticalChance: 0.05, projectileColor: 0x73ef62,
      projectileScale: 1.2, projectilePiercing: 0, splashRadius: 0, chainTargets: 2, chainRange: 190,
    }),
  },
] as const;

export function starterWeapon(id: string | undefined) {
  return STARTER_WEAPONS.find(weapon => weapon.id === id) ?? STARTER_WEAPONS[0];
}

export function applyStarterWeapon(stats: PlayerStats, id: string | undefined) {
  const weapon = starterWeapon(id);
  weapon.apply(stats);
  return weapon;
}
