import { volleyDamageFactor, type PlayerStats } from '../entities/player/PlayerStats';
import type { Equipment, EquipmentModifier } from '../loot/Equipment';

export interface BuildSynergy {
  id: string;
  name: string;
  description: string;
  color: number;
  modifiers: readonly EquipmentModifier[];
}

/**
 * A synergy pairs the equipped weapon mod with an installed armor or module, both by stable item
 * id. It used to key on the weaponMode the weapon drop switched to, which tied set bonuses to
 * losing the starter's identity. Mods no longer change mode, so every bonus here has to pay off
 * for pulse, spore and arc alike: splash and chain stats, which only one starter uses, were
 * swapped for damage, toxin, pierce, crit and cadence.
 */
export const SYNERGIES: readonly (BuildSynergy & { weaponItem: string; requiredItem: string })[] = [
  { id: 'plague-bastion', name: 'BASTIÓN DE PLAGA', description: '+18 daño y +2 toxina',
    color: 0xff7bdf, weaponItem: 'weapon.cañón-de-plasma', requiredItem: 'armor.placa-bioacero', modifiers: [
      { key: 'attackDamage', operation: 'add', value: 18 },
      { key: 'toxinDamage', operation: 'add', value: 2 },
    ] },
  { id: 'storm-shell', name: 'CAPARAZÓN DE TORMENTA', description: '10% más cadencia y dash más rápido',
    color: 0xb8ff70, weaponItem: 'weapon.bláster-arc', requiredItem: 'armor.núcleo-deflector', modifiers: [
      { key: 'attackCooldown', operation: 'multiply', value: 0.9 },
      { key: 'dashCooldown', operation: 'multiply', value: 0.85 },
    ] },
  { id: 'velocity-loop', name: 'CIRCUITO DE VELOCIDAD', description: '12% más cadencia y +30 movimiento',
    color: 0x6ffcff, weaponItem: 'weapon.láser-iónico', requiredItem: 'armor.exoarmadura-puerro', modifiers: [
      { key: 'attackCooldown', operation: 'multiply', value: 0.88 },
      { key: 'moveSpeed', operation: 'add', value: 30 },
    ] },
  { id: 'precision-loop', name: 'PROTOCOLO DE PRECISIÓN', description: '+12% crítico y +1 perforación',
    color: 0xfff27a, weaponItem: 'weapon.pistola-de-pulso', requiredItem: 'armor.exoarmadura-puerro', modifiers: [
      { key: 'criticalChance', operation: 'add', value: 0.12 },
      { key: 'bonusPiercing', operation: 'add', value: 1 },
    ] },
  { id: 'living-ammunition', name: 'MUNICIÓN VIVIENTE', description: '+14 daño y +1 perforación',
    color: 0xff67c8, weaponItem: 'weapon.cañón-de-plasma', requiredItem: 'module.matriz-micelial', modifiers: [
      { key: 'attackDamage', operation: 'add', value: 14 },
      { key: 'bonusPiercing', operation: 'add', value: 1 },
    ] },
  { id: 'sap-overload', name: 'SOBRECARGA DE SAVIA', description: '+8 daño y +10% crítico',
    color: 0x8cff65, weaponItem: 'weapon.bláster-arc', requiredItem: 'module.conductor-de-savia', modifiers: [
      { key: 'attackDamage', operation: 'add', value: 8 },
      { key: 'criticalChance', operation: 'add', value: 0.1 },
    ] },
  { id: 'solar-rail', name: 'RIEL SOLAR', description: '15% más cadencia y +1 perforación',
    color: 0xfff27a, weaponItem: 'weapon.láser-iónico', requiredItem: 'module.óptica-fotosintética', modifiers: [
      { key: 'attackCooldown', operation: 'multiply', value: 0.85 },
      { key: 'bonusPiercing', operation: 'add', value: 1 },
    ] },
] as const;

/** The synergy of the equipped weapon mod, if a matching armor or module is installed. */
export function activeBuildSynergy(items: readonly Equipment[], weapon?: Equipment) {
  if (!weapon) return undefined;
  return SYNERGIES.find(synergy => synergy.weaponItem === weapon.id &&
    items.some(item => item.id === synergy.requiredItem));
}

export function combatRating(stats: PlayerStats) {
  const shotsPerSecond = 1000 / Math.max(50, stats.attackCooldown);
  return {
    damage: Math.round(stats.attackDamage),
    cadence: Number(shotsPerSecond.toFixed(1)),
    // The volley factor, not the projectile count: extra projectiles carry reduced damage.
    dps: Math.round(stats.attackDamage * volleyDamageFactor(stats) * shotsPerSecond),
    critical: Math.round(stats.criticalChance * 100),
    armor: Math.round(stats.damageReduction * 100),
    speed: Math.round(stats.moveSpeed),
  };
}
