import type { PlayerStats } from '../entities/player/PlayerStats';
import type { StarterWeaponId } from '../weapons/WeaponRegistry';
import { CHILL_SLOW } from '../systems/StatusEffects';
import { randomFrom } from '../systems/RunRandom';
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
function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}
/**
 * A seeded draw of `count` cards. Cards in `avoid` (the offer a reroll replaces) go to the back,
 * so a reroll shows fresh cards first and repeats one only when the pool has nothing else left.
 */
function draw(pool: readonly Ability[], count: number, random: () => number, avoid: ReadonlySet<string>) {
  const order = shuffled(pool, random);
  return [...order.filter(a => !avoid.has(a.id)), ...order.filter(a => avoid.has(a.id))].slice(0, count);
}
const open = (levels: ReadonlyMap<string, number>) => (ability: Ability) => (levels.get(ability.id) ?? 0) < ability.maxLevel;
/** Kept out of the regular draw so the timed milestones always hold something the level-ups do not. */
const MILESTONE_EXCLUSIVE = ['fan', 'phase_dash'];
const regularPool = () => ABILITIES.filter(a => !MILESTONE_EXCLUSIVE.includes(a.id) && !isSignatureAbility(a.id));

export interface OfferOptions {
  /** The weapon's signature protocol, once the first milestone has offered it (see GameScene). */
  signature?: string;
  random?: () => number;
  /** The offer being rerolled; its cards are drawn last. */
  avoid?: ReadonlySet<string>;
}
/**
 * The regular level-up draw. The signature protocol joins it after the first milestone: it has
 * three levels and there are three milestones, so when it was offered only there, evolving the
 * weapon meant taking it every time and the milestone was no choice at all. Joining the regular
 * pool lets a player who skips it at a milestone still finish it from ordinary level-ups.
 */
export function chooseAbilities(levels: ReadonlyMap<string, number>, count = 3, options: OfferOptions = {}) {
  const { signature, random = randomFrom('upgrades'), avoid = new Set<string>() } = options;
  const pool = [...regularPool(), ...ABILITIES.filter(a => a.id === signature)].filter(open(levels));
  return draw(pool, count, random, avoid);
}
/**
 * A timed milestone: the weapon's signature protocol while it can still level, one of the
 * milestone-exclusive upgrades (ABANICO VERDE, PASO FANTASMA) and the rest drawn from everything
 * else. The exclusive slot is reserved because a uniform draw over the whole pool would show
 * each of them about one card in seven, and they appear nowhere but here. The signature is
 * always present so a milestone never hides the evolution; it is no longer forced, because the
 * regular draw also offers it after the first milestone.
 */
export function milestoneOffer(levels: ReadonlyMap<string, number>, weaponId: StarterWeaponId, options: Omit<OfferOptions, 'signature'> = {}) {
  const { random = randomFrom('upgrades'), avoid = new Set<string>() } = options;
  const available = open(levels);
  const signature = ABILITIES.filter(a => a.id === signatureAbilityId(weaponId) && available(a));
  const exclusive = draw(ABILITIES.filter(a => MILESTONE_EXCLUSIVE.includes(a.id) && available(a)), 1, random, avoid);
  const taken = new Set([...signature, ...exclusive].map(a => a.id));
  const rest = draw(ABILITIES.filter(a => !taken.has(a.id) && !isSignatureAbility(a.id) && available(a)),
    3 - taken.size, random, avoid);
  return [...signature, ...exclusive, ...rest];
}
/**
 * What GameScene offers for a level-up or a milestone. A reroll calls it again with the offer it
 * replaces as `avoid`, from the same seeded stream, so a daily reroll lands on the same cards for
 * everyone who rerolled at that point.
 */
export function upgradeOffer(
  levels: ReadonlyMap<string, number>,
  weaponId: StarterWeaponId,
  context: { milestone: boolean; milestonesReached: number },
  options: Omit<OfferOptions, 'signature'> = {},
) {
  if (context.milestone) return milestoneOffer(levels, weaponId, options);
  const signature = context.milestonesReached > 0 ? signatureAbilityId(weaponId) : undefined;
  return chooseAbilities(levels, 3, { ...options, signature });
}
export const getAbilityById = (id: string) => ABILITIES.find((ability) => ability.id === id);
