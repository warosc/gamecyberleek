import type { PlayerStats } from '../entities/player/PlayerStats';
export interface Ability {
  id: string;
  name: string;
  description: string;
  /** One glyph shown on the level-up card. Read faster than a truncated name. */
  icon: string;
  maxLevel: number;
  apply: (stats: PlayerStats, level: number) => void;
}
export const ABILITIES: Ability[] = [
  {
    id: 'rapid',
    name: 'RAPID FIRE',
    description: 'Fire 12% faster',
    icon: '»',
    maxLevel: 5,
    apply: (s) => {
      s.attackCooldown *= 0.88;
    },
  },
  {
    id: 'power',
    name: 'POWER SHOT',
    description: '+8 attack damage',
    icon: '✦',
    maxLevel: 5,
    apply: (s) => {
      s.attackDamage += 8;
    },
  },
  {
    id: 'boots',
    name: 'TURBO BOOTS',
    description: '+25 movement speed',
    icon: '▲',
    maxLevel: 4,
    apply: (s) => {
      s.moveSpeed += 25;
    },
  },
  {
    id: 'multi',
    name: 'MULTI SHOT',
    description: '+1 projectile',
    icon: '☷',
    maxLevel: 3,
    apply: (s) => {
      s.projectileCount++;
    },
  },
  {
    id: 'core',
    name: 'ENERGY CORE',
    description: '+25 max HP and heal',
    icon: '♥',
    maxLevel: 4,
    apply: (s) => {
      s.maxHp += 25;
    },
  },
  {
    id: 'magnet',
    name: 'MAGNET',
    description: '+55 pickup radius',
    icon: '◉',
    maxLevel: 4,
    apply: (s) => {
      s.magnetRadius += 55;
    },
  },
  {
    id: 'crit',
    name: 'CRITICAL OPTICS',
    description: '+8% critical chance',
    icon: '☀',
    maxLevel: 5,
    apply: (s) => {
      s.criticalChance += 0.08;
    },
  },
  {
    id: 'overdrive',
    name: 'LEEK OVERDRIVE',
    description: '10s: +50% damage and fire rate',
    icon: '⚡',
    maxLevel: 3,
    apply: () => {},
  },
];
/** Fisher-Yates over a copy. Kept engine-free so this data module stays runtime-independent. */
function shuffled<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}
export function chooseAbilities(levels: Map<string, number>, count = 3) {
  return shuffled(ABILITIES.filter((a) => (levels.get(a.id) ?? 0) < a.maxLevel)).slice(0, count);
}
export const getAbilityById = (id: string) => ABILITIES.find((ability) => ability.id === id);
