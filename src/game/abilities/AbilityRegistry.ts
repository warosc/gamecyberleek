import type { PlayerStats } from '../entities/player/PlayerStats';
import type { StarterWeaponId } from '../weapons/WeaponRegistry';
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
  { id: 'breach', name: 'AGUJA DE PLASMA', description: '+1 enemigo atravesado por disparo', icon: '↠', maxLevel: 3,
    apply: s => { s.bonusPiercing++; } },
  { id: 'fan', name: 'ABANICO VERDE', description: '+1 proyectil por disparo', icon: '⋔', maxLevel: 3,
    apply: s => { s.projectileCount++; } },
  { id: 'phase_dash', name: 'PASO FANTASMA', description: 'Dash 20% más frecuente y +20 velocidad', icon: '»', maxLevel: 3,
    apply: s => { s.dashCooldown *= 0.8; s.moveSpeed += 20; } },
  { id: 'pulse_protocol', name: 'PROTOCOLO RAIL', description: '+4 dano y 10% mas cadencia · Nivel 3 evoluciona', icon: 'P', maxLevel: 3,
    apply: (s, level) => {
      s.attackDamage += 4; s.attackCooldown *= 0.9;
      if (level === 3) { s.weaponName = 'RAIL SPROUT'; s.projectilePiercing += 2; s.projectileScale = 1.35; s.projectileColor = 0xfff27a; }
    } },
  { id: 'spore_protocol', name: 'PROTOCOLO PLAGA', description: '+7 dano y +14 area · Nivel 3 evoluciona', icon: 'S', maxLevel: 3,
    apply: (s, level) => {
      s.attackDamage += 7; s.splashRadius += 14;
      if (level === 3) { s.weaponName = 'PLAGUE BLOOM'; s.splashRadius += 45; s.projectileScale = 2.2; s.projectileColor = 0xff7bdf; }
    } },
  { id: 'arc_protocol', name: 'PROTOCOLO TORMENTA', description: '+4 dano y +1 salto · Nivel 3 evoluciona', icon: 'A', maxLevel: 3,
    apply: (s, level) => {
      s.attackDamage += 4; s.chainTargets += 1; s.chainRange += 25;
      if (level === 3) { s.weaponName = 'THUNDER ROOT'; s.chainTargets += 1; s.projectileScale = 1.5; s.projectileColor = 0xb8ff70; }
    } },
];
const SIGNATURE_ABILITIES: Record<StarterWeaponId, string> = {
  pulse: 'pulse_protocol', spore: 'spore_protocol', arc: 'arc_protocol',
};
export const signatureAbilityId = (weaponId: StarterWeaponId) => SIGNATURE_ABILITIES[weaponId];
export const isSignatureAbility = (id: string) => Object.values(SIGNATURE_ABILITIES).includes(id);
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
  return shuffled(ABILITIES.filter((a) => !['breach', 'fan', 'phase_dash', ...Object.values(SIGNATURE_ABILITIES)].includes(a.id) && (levels.get(a.id) ?? 0) < a.maxLevel)).slice(0, count);
}
export const getAbilityById = (id: string) => ABILITIES.find((ability) => ability.id === id);
