import type { PlayerStats } from '../entities/player/PlayerStats';
import type { Equipment, EquipmentModifier } from '../loot/Equipment';

export interface BuildSynergy {
  id: string;
  name: string;
  description: string;
  color: number;
  modifiers: readonly EquipmentModifier[];
}

const SYNERGIES: readonly (BuildSynergy & { weapon: PlayerStats['weaponMode']; requiredItem: string })[] = [
  { id: 'plague-bastion', name: 'BASTIÓN DE PLAGA', description: '+18 daño y +28 área de plasma',
    color: 0xff7bdf, weapon: 'plasma', requiredItem: 'placa-bioacero', modifiers: [
      { key: 'attackDamage', operation: 'add', value: 18 },
      { key: 'splashRadius', operation: 'add', value: 28 },
    ] },
  { id: 'storm-shell', name: 'CAPARAZÓN DE TORMENTA', description: '+1 salto y +45 alcance eléctrico',
    color: 0xb8ff70, weapon: 'arc', requiredItem: 'núcleo-deflector', modifiers: [
      { key: 'chainTargets', operation: 'add', value: 1 },
      { key: 'chainRange', operation: 'add', value: 45 },
    ] },
  { id: 'velocity-loop', name: 'CIRCUITO DE VELOCIDAD', description: '12% más cadencia y +30 movimiento',
    color: 0x6ffcff, weapon: 'laser', requiredItem: 'exoarmadura-puerro', modifiers: [
      { key: 'attackCooldown', operation: 'multiply', value: 0.88 },
      { key: 'moveSpeed', operation: 'add', value: 30 },
    ] },
  { id: 'precision-loop', name: 'PROTOCOLO DE PRECISIÓN', description: '+12% crítico y +1 perforación',
    color: 0xfff27a, weapon: 'pulse', requiredItem: 'exoarmadura-puerro', modifiers: [
      { key: 'criticalChance', operation: 'add', value: 0.12 },
      { key: 'bonusPiercing', operation: 'add', value: 1 },
  ] },
  { id: 'living-ammunition', name: 'MUNICIÓN VIVIENTE', description: '+14 daño y +20 área de plasma',
    color: 0xff67c8, weapon: 'plasma', requiredItem: 'matriz-micelial', modifiers: [
      { key: 'attackDamage', operation: 'add', value: 14 },
      { key: 'splashRadius', operation: 'add', value: 20 },
    ] },
  { id: 'sap-overload', name: 'SOBRECARGA DE SAVIA', description: '+1 salto y +10% crítico',
    color: 0x8cff65, weapon: 'arc', requiredItem: 'conductor-de-savia', modifiers: [
      { key: 'chainTargets', operation: 'add', value: 1 },
      { key: 'criticalChance', operation: 'add', value: 0.1 },
    ] },
  { id: 'solar-rail', name: 'RIEL SOLAR', description: '15% más cadencia y +1 perforación',
    color: 0xfff27a, weapon: 'laser', requiredItem: 'óptica-fotosintética', modifiers: [
      { key: 'attackCooldown', operation: 'multiply', value: 0.85 },
      { key: 'bonusPiercing', operation: 'add', value: 1 },
    ] },
] as const;

export function activeBuildSynergy(items: readonly Equipment[], weapon?: Equipment) {
  if (!weapon) return undefined;
  const mode = weapon.modifiers.find(modifier => modifier.key === 'weaponMode')?.value;
  return SYNERGIES.find(synergy => synergy.weapon === mode && items.some(item =>
    item.kind !== 'weapon' && item.id.includes(synergy.requiredItem)));
}

export function combatRating(stats: PlayerStats) {
  const shotsPerSecond = 1000 / Math.max(50, stats.attackCooldown);
  return {
    damage: Math.round(stats.attackDamage),
    cadence: Number(shotsPerSecond.toFixed(1)),
    dps: Math.round(stats.attackDamage * stats.projectileCount * shotsPerSecond),
    critical: Math.round(stats.criticalChance * 100),
    armor: Math.round(stats.damageReduction * 100),
    speed: Math.round(stats.moveSpeed),
  };
}
