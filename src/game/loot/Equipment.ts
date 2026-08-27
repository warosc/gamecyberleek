import type { PlayerStats } from '../entities/player/PlayerStats';

export type EquipmentKind = 'weapon' | 'armor';
export type EquipmentRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

export interface Equipment {
  name: string;
  kind: EquipmentKind;
  rarity: EquipmentRarity;
  description: string;
  color: number;
  apply: (stats: PlayerStats) => void;
}

const rarityData: Record<EquipmentRarity, { multiplier: number; color: number }> = {
  COMMON: { multiplier: 1, color: 0xd7e5ea },
  RARE: { multiplier: 1.45, color: 0x21a9ff },
  EPIC: { multiplier: 2, color: 0xb75cff },
  LEGENDARY: { multiplier: 2.8, color: 0xffb52e },
};

function rollRarity(level: number, random: () => number): EquipmentRarity {
  const roll = random() + Math.min(0.18, level * 0.008);
  if (roll > 1.08) return 'LEGENDARY';
  if (roll > 0.82) return 'EPIC';
  if (roll > 0.48) return 'RARE';
  return 'COMMON';
}

export function rollEquipment(level: number, random = Math.random): Equipment {
  const rarity = rollRarity(level, random);
  const { multiplier, color } = rarityData[rarity];
  const weapon = random() < 0.62;
  const tier = Math.max(1, Math.ceil(level / 3));
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
        },
      },
    ];
    const choice = choices[Math.floor(random() * choices.length)];
    return { ...choice, name: `${choice.name} MK-${tier}`, kind: 'weapon', rarity, color };
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
  return { ...choice, name: `${choice.name} MK-${tier}`, kind: 'armor', rarity, color };
}
