import type { PlayerStats } from '../entities/player/PlayerStats';
export interface Ability {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
  apply: (stats: PlayerStats, level: number) => void;
}
export const ABILITIES: Ability[] = [
  {
    id: 'rapid',
    name: 'RAPID FIRE',
    description: 'Fire 12% faster',
    maxLevel: 5,
    apply: (s) => {
      s.attackCooldown *= 0.88;
    },
  },
  {
    id: 'power',
    name: 'POWER SHOT',
    description: '+8 attack damage',
    maxLevel: 5,
    apply: (s) => {
      s.attackDamage += 8;
    },
  },
  {
    id: 'boots',
    name: 'TURBO BOOTS',
    description: '+25 movement speed',
    maxLevel: 4,
    apply: (s) => {
      s.moveSpeed += 25;
    },
  },
  {
    id: 'multi',
    name: 'MULTI SHOT',
    description: '+1 projectile',
    maxLevel: 3,
    apply: (s) => {
      s.projectileCount++;
    },
  },
  {
    id: 'core',
    name: 'ENERGY CORE',
    description: '+25 max HP and heal',
    maxLevel: 4,
    apply: (s) => {
      s.maxHp += 25;
    },
  },
  {
    id: 'magnet',
    name: 'MAGNET',
    description: '+55 pickup radius',
    maxLevel: 4,
    apply: (s) => {
      s.magnetRadius += 55;
    },
  },
  {
    id: 'crit',
    name: 'CRITICAL OPTICS',
    description: '+8% critical chance',
    maxLevel: 5,
    apply: (s) => {
      s.criticalChance += 0.08;
    },
  },
  {
    id: 'overdrive',
    name: 'LEEK OVERDRIVE',
    description: '10s: +50% damage and fire rate',
    maxLevel: 3,
    apply: () => {},
  },
];
export function chooseAbilities(levels: Map<string, number>, count = 3) {
  return Phaser.Utils.Array.Shuffle(
    ABILITIES.filter((a) => (levels.get(a.id) ?? 0) < a.maxLevel),
  ).slice(0, count);
}
export const getAbilityById = (id: string) => ABILITIES.find((ability) => ability.id === id);
