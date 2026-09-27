import { createPlayerStats, type PlayerStats } from '../entities/player/PlayerStats';

export type EquipmentKind = 'weapon' | 'armor' | 'module';
export type EquipmentRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

export interface EquipmentModifier {
  key: keyof PlayerStats;
  operation: 'add' | 'multiply' | 'set';
  value: number | string;
}

export interface Equipment {
  id: string;
  modifiers: readonly EquipmentModifier[];
  name: string;
  kind: EquipmentKind;
  rarity: EquipmentRarity;
  description: string;
  color: number;
  itemLevel: number;
  power: number;
  /** @deprecated Compatibility bridge for callers outside the loot pipeline. */
  apply: (stats: PlayerStats) => void;
}

/** Centralized drop weights; tuning does not require editing item behavior. */
export const RARITY_WEIGHTS: Record<EquipmentRarity, number> = {
  COMMON: 0.48,
  RARE: 0.34,
  EPIC: 0.16,
  LEGENDARY: 0.02,
};

export function applyEquipmentModifiers(
  stats: PlayerStats,
  modifiers: readonly EquipmentModifier[],
) {
  for (const modifier of modifiers) {
    const current = stats[modifier.key];
    if (modifier.operation === 'set') {
      (stats[modifier.key] as unknown) = modifier.value;
    } else if (typeof current === 'number' && typeof modifier.value === 'number') {
      (stats[modifier.key] as unknown) =
        modifier.operation === 'add'
          ? current + modifier.value
          : current * modifier.value;
    }
  }
}

/** Removes additive and multiplicative bonuses when an equipped weapon is replaced. */
export function removeEquipmentModifiers(
  stats: PlayerStats,
  modifiers: readonly EquipmentModifier[],
) {
  for (const modifier of [...modifiers].reverse()) {
    const current = stats[modifier.key];
    if (modifier.operation === 'set') continue;
    if (typeof current !== 'number' || typeof modifier.value !== 'number') continue;
    (stats[modifier.key] as unknown) = modifier.operation === 'add'
      ? current - modifier.value
      : current / modifier.value;
  }
}

const NUMERIC_KEYS: readonly (keyof PlayerStats)[] = [
  'maxHp', 'moveSpeed', 'dashSpeed', 'dashDuration', 'dashCooldown', 'attackDamage',
  'attackCooldown', 'projectileSpeed', 'criticalChance', 'xpMultiplier', 'projectileCount',
  'magnetRadius', 'damageReduction', 'projectileScale', 'projectilePiercing', 'splashRadius',
  'chainTargets', 'chainRange',
];

function structuredModifiers(apply: (stats: PlayerStats) => void): EquipmentModifier[] {
  const before = createPlayerStats();
  const after = createPlayerStats();
  apply(after);
  const modifiers: EquipmentModifier[] = [];
  for (const key of NUMERIC_KEYS) {
    const previous = before[key] as number;
    const next = after[key] as number;
    if (next === previous) continue;
    const operation = key === 'attackCooldown' || key === 'dashCooldown' ? 'multiply' : 'add';
    modifiers.push({ key, operation, value: operation === 'multiply' ? next / previous : next - previous });
  }
  for (const key of ['weaponName', 'projectileColor', 'weaponMode'] as const) {
    if (after[key] !== before[key]) modifiers.push({ key, operation: 'set', value: after[key] });
  }
  return modifiers;
}

const rarityData: Record<EquipmentRarity, { multiplier: number; color: number }> = {
  COMMON: { multiplier: 1, color: 0xd7e5ea },
  RARE: { multiplier: 1.45, color: 0x21a9ff },
  EPIC: { multiplier: 2, color: 0xb75cff },
  LEGENDARY: { multiplier: 2.8, color: 0xffb52e },
};

function rollRarity(level: number, random: () => number): EquipmentRarity {
  const bonus = Math.min(0.18, level * 0.008);
  const roll = random() * (1 + bonus);
  if (roll >= RARITY_WEIGHTS.COMMON + RARITY_WEIGHTS.RARE + RARITY_WEIGHTS.EPIC) return 'LEGENDARY';
  if (roll >= RARITY_WEIGHTS.COMMON + RARITY_WEIGHTS.RARE) return 'EPIC';
  if (roll >= RARITY_WEIGHTS.COMMON) return 'RARE';
  return 'COMMON';
}

export function rollEquipment(level: number, random = Math.random): Equipment {
  const rarity = rollRarity(level, random);
  const { multiplier, color } = rarityData[rarity];
  const kindRoll = random();
  const weapon = kindRoll < 0.55;
  const module = kindRoll >= 0.55 && kindRoll < 0.72;
  const tier = Math.max(1, Math.ceil(level / 3));
  const rarityPower: Record<EquipmentRarity, number> = { COMMON: 0, RARE: 8, EPIC: 18, LEGENDARY: 34 };
  if (weapon) {
    const choices = [
      {
        name: 'PISTOLA DE PULSO',
        description: `+${Math.round(5 * multiplier)} daño · +${Math.round(3 * multiplier)}% crítico`,
        apply: (stats: PlayerStats) => {
          stats.attackDamage += Math.round(5 * multiplier);
          stats.criticalChance += 0.03 * multiplier;
          stats.weaponName = 'PISTOLA DE PULSO';
          stats.projectileColor = 0x73ef62;
          stats.weaponMode = 'pulse';
          stats.projectilePiercing = 0;
          stats.splashRadius = 0;
        },
      },
      {
        name: 'BLÁSTER ARC',
        description: `+${Math.round(4 * multiplier)} daño · ${Math.round(6 * multiplier)}% más rápido`,
        apply: (stats: PlayerStats) => {
          stats.attackDamage += Math.round(4 * multiplier);
          stats.attackCooldown *= 1 - Math.min(0.22, 0.06 * multiplier);
          stats.weaponName = 'BLÁSTER ARC';
          stats.projectileColor = 0x21e6ff;
          stats.projectileScale = 1.15;
          stats.weaponMode = 'arc';
          stats.projectilePiercing = 1;
          stats.splashRadius = 0;
        },
      },
      {
        name: 'LÁSER IÓNICO',
        description: `+${Math.round(7 * multiplier)} daño · +${Math.round(90 * multiplier)} velocidad láser`,
        apply: (stats: PlayerStats) => {
          stats.attackDamage += Math.round(7 * multiplier);
          stats.projectileSpeed += Math.round(90 * multiplier);
          stats.weaponName = 'LÁSER IÓNICO';
          stats.projectileColor = 0x6ffcff;
          stats.projectileScale = 1.4;
          stats.weaponMode = 'laser';
          stats.projectilePiercing = 2;
          stats.splashRadius = 0;
        },
      },
      {
        name: 'CAÑÓN DE PLASMA',
        description: `+${Math.round(11 * multiplier)} daño · proyectil de plasma mayor`,
        apply: (stats: PlayerStats) => {
          stats.attackDamage += Math.round(11 * multiplier);
          stats.weaponName = 'CAÑÓN DE PLASMA';
          stats.projectileColor = 0xd566ff;
          stats.projectileScale = 1.8;
          stats.weaponMode = 'plasma';
          stats.projectilePiercing = 0;
          stats.splashRadius = 92;
        },
      },
    ];
    const choice = choices[Math.floor(random() * choices.length)];
    return { ...choice, id: `weapon.${choice.name.toLowerCase().replaceAll(' ', '-')}`, modifiers: structuredModifiers(choice.apply), name: `${choice.name} MK-${tier}`, kind: 'weapon', rarity, color,
      itemLevel: tier * 10 + rarityPower[rarity], power: Math.round(tier * 12 + multiplier * 10) };
  }
  if (module) {
    const moduleChoices = [
      { name: 'MATRIZ MICELIAL', description: `+${Math.round(5 * multiplier)} daño · +${Math.round(12 * multiplier)} radio de recolección`,
        apply: (stats: PlayerStats) => { stats.attackDamage += Math.round(5 * multiplier); stats.magnetRadius += Math.round(12 * multiplier); } },
      { name: 'CONDUCTOR DE SAVIA', description: `+${Math.round(3 * multiplier)}% crítico · +${Math.round(35 * multiplier)} alcance de cadena`,
        apply: (stats: PlayerStats) => { stats.criticalChance += 0.03 * multiplier; stats.chainRange += Math.round(35 * multiplier); } },
      { name: 'ÓPTICA FOTOSINTÉTICA', description: `+${Math.round(70 * multiplier)} velocidad de proyectil · +1 perforación`,
        apply: (stats: PlayerStats) => { stats.projectileSpeed += Math.round(70 * multiplier); stats.bonusPiercing += 1; } },
    ];
    const choice = moduleChoices[Math.floor(random() * moduleChoices.length)];
    return { ...choice, id: `module.${choice.name.toLowerCase().replaceAll(' ', '-')}`, modifiers: structuredModifiers(choice.apply),
      name: `${choice.name} MK-${tier}`, kind: 'module', rarity, color,
      itemLevel: tier * 10 + rarityPower[rarity], power: Math.round(tier * 11 + multiplier * 9) };
  }
  const armorChoices = [
    {
      name: 'PLACA BIOACERO',
      description: `+${Math.round(18 * multiplier)} HP · +${Math.round(2.5 * multiplier)}% armadura`,
      apply: (stats: PlayerStats) => {
        stats.maxHp += Math.round(18 * multiplier);
        stats.damageReduction = Math.min(0.55, stats.damageReduction + 0.025 * multiplier);
      },
    },
    {
      name: 'EXOARMADURA PUERRO',
      description: `+${Math.round(12 * multiplier)} HP · +${Math.round(9 * multiplier)} movimiento`,
      apply: (stats: PlayerStats) => {
        stats.maxHp += Math.round(12 * multiplier);
        stats.moveSpeed += Math.round(9 * multiplier);
      },
    },
    {
      name: 'NÚCLEO DEFLECTOR',
      description: `+${Math.round(4 * multiplier)}% armadura · dash más rápido`,
      apply: (stats: PlayerStats) => {
        stats.damageReduction = Math.min(0.55, stats.damageReduction + 0.04 * multiplier);
        stats.dashCooldown *= 1 - Math.min(0.2, 0.045 * multiplier);
      },
    },
  ];
  const choice = armorChoices[Math.floor(random() * armorChoices.length)];
  return { ...choice, id: `armor.${choice.name.toLowerCase().replaceAll(' ', '-')}`, modifiers: structuredModifiers(choice.apply), name: `${choice.name} MK-${tier}`, kind: 'armor', rarity, color,
    itemLevel: tier * 10 + rarityPower[rarity], power: Math.round(tier * 10 + multiplier * 9) };
}
