import type { PlayerStats } from '../entities/player/PlayerStats';
import type { StarterWeaponId } from '../weapons/WeaponRegistry';
import { CHILL_SLOW } from '../systems/StatusEffects';
import { runRandom } from '../systems/RunRandom';
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
    description: '+30% attack damage',
    icon: '✦',
    maxLevel: 5,
    // Proportional, not flat: +8 was +44 % for the pulse gun (18) but +21 % for the spore cannon
    // (38). Compounding ×1.3 keeps level 3 (×2.2) where +24 left the pulse gun with mastery.
    apply: (s) => {
      s.attackDamage *= 1.3;
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
    description: '+1 projectile · each extra adds 50% damage',
    icon: '☷',
    maxLevel: 3,
    // Extra projectiles deal `extraProjectileDamage` (50 %) of a shot, applied in ProjectileManager.
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
    description: '+55 pickup radius and +10% XP',
    icon: '◉',
    maxLevel: 4,
    // Radius alone was the weakest pick; the XP share makes it a real investment in levels. Four
    // levels (+0.4) stay well inside the online level ceiling's 3× XP allowance.
    apply: (s) => {
      s.magnetRadius += 55;
      s.xpMultiplier += 0.1;
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
    name: 'LEEK OVERCLOCK',
    description: 'Q/E/R recharge 12% faster',
    icon: '⚡',
    maxLevel: 3,
    // Was a one-off 12–16 s Overdrive: a whole level-up spent on a buff that ended before the next
    // wave. A permanent cut to the special cooldowns keeps paying for the rest of the run.
    apply: (s) => {
      s.specialCooldownMultiplier *= 0.88;
    },
  },
  { id: 'ignite', name: 'MUNICIÓN INCENDIARIA', description: 'Los impactos queman: +4 daño cada 0,5 s', icon: '♨', maxLevel: 3,
    apply: s => { s.burnDamage += 4; } },
  // Level 2 slows harder as well as longer; a second level that only added duration was a dead pick.
  { id: 'cryo', name: 'NÚCLEO CRIO', description: 'Los impactos ralentizan un 35% (1,5 s) · Nivel 2: 50% (3 s)', icon: '❄', maxLevel: 2,
    apply: (s, level) => { s.chillDurationMs += 1500; s.chillSlow = level >= 2 ? 0.5 : CHILL_SLOW; } },
  { id: 'toxin', name: 'SAVIA TÓXICA', description: 'Toxina acumulable: +2 daño por dosis (máx. 5)', icon: '☣', maxLevel: 3,
    apply: s => { s.toxinDamage += 2; } },
  { id: 'breach', name: 'AGUJA DE PLASMA', description: '+1 enemigo atravesado por disparo', icon: '↠', maxLevel: 3,
    apply: s => { s.bonusPiercing++; } },
  { id: 'fan', name: 'ABANICO VERDE', description: '+1 proyectil por disparo · cada extra suma un 50% de daño', icon: '⋔', maxLevel: 3,
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
    const swap = Math.floor(runRandom('upgrades') * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}
/** Offered only at the timed milestones (see GameScene.openLevelUp), never in the random draw. */
const MILESTONE_ONLY = ['fan', 'phase_dash', ...Object.values(SIGNATURE_ABILITIES)];
export function chooseAbilities(levels: Map<string, number>, count = 3) {
  return shuffled(ABILITIES.filter((a) => !MILESTONE_ONLY.includes(a.id) && (levels.get(a.id) ?? 0) < a.maxLevel)).slice(0, count);
}
export const getAbilityById = (id: string) => ABILITIES.find((ability) => ability.id === id);
