import { describe, expect, it } from 'vitest';
import { createPlayerStats, type PlayerStats } from '../src/game/entities/player/PlayerStats';
import { applyStarterWeapon, type StarterWeaponId } from '../src/game/weapons/WeaponRegistry';
import { getAbilityById, signatureAbilityId } from '../src/game/abilities/AbilityRegistry';
import { applyEquipmentModifiers, removeEquipmentModifiers, rollEquipment, type Equipment } from '../src/game/loot/Equipment';
import { RunInventory } from '../src/game/systems/RunInventory';
import { activeBuildSynergy, SYNERGIES } from '../src/game/systems/BuildProgression';

function sequence(values: number[]) {
  let index = 0;
  return () => values[index++] ?? 0;
}

// rollEquipment draws rarity, kind, then which base item; these rolls pin each one at level 1.
const RARITY_ROLLS = { COMMON: 0.1, RARE: 0.6, EPIC: 0.85, LEGENDARY: 0.99 } as const;
const MOD_ROLLS = { 'pistola-de-pulso': 0.1, 'bláster-arc': 0.3, 'láser-iónico': 0.6, 'cañón-de-plasma': 0.9 } as const;
const mod = (name: keyof typeof MOD_ROLLS, rarity: keyof typeof RARITY_ROLLS = 'COMMON') =>
  rollEquipment(1, sequence([RARITY_ROLLS[rarity], 0.1, MOD_ROLLS[name]]));
const armor = (roll: number) => rollEquipment(1, sequence([0.1, 0.9, roll]));
const module = (roll: number) => rollEquipment(1, sequence([0.1, 0.6, roll]));
const ALL_MODS = (Object.keys(MOD_ROLLS) as (keyof typeof MOD_ROLLS)[]).flatMap(name =>
  (Object.keys(RARITY_ROLLS) as (keyof typeof RARITY_ROLLS)[]).map(rarity => mod(name, rarity)));

function starter(id: StarterWeaponId) {
  const stats = createPlayerStats();
  applyStarterWeapon(stats, id);
  return stats;
}

const identity = (stats: PlayerStats) => ({
  weaponMode: stats.weaponMode, weaponName: stats.weaponName, projectileColor: stats.projectileColor,
  projectileScale: stats.projectileScale,
});

/** Mirrors GameScene: drop the replaced mod's modifiers, then apply the new one's. */
function equip(stats: PlayerStats, inventory: RunInventory, item: Equipment) {
  const swap = inventory.equipWeapon(item);
  if (swap.replaced) removeEquipmentModifiers(stats, swap.replaced.modifiers);
  applyEquipmentModifiers(stats, item.modifiers);
}

describe('weapon mods', () => {
  it('rolls every base mod at every rarity', () => {
    expect(new Set(ALL_MODS.map(item => item.id))).toEqual(new Set(Object.keys(MOD_ROLLS).map(name => `weapon.${name}`)));
    expect(new Set(ALL_MODS.map(item => item.rarity))).toEqual(new Set(Object.keys(RARITY_ROLLS)));
    for (const item of ALL_MODS) {
      expect(item.kind).toBe('weapon');
      expect(item.modifiers.every(modifier => modifier.operation !== 'set'), item.id).toBe(true);
    }
  });

  it.each(['pulse', 'spore', 'arc'] as const)('keeps the %s starter identity through every install and swap', id => {
    const stats = starter(id);
    const before = { ...stats };
    const inventory = new RunInventory();
    for (const item of ALL_MODS) {
      equip(stats, inventory, item);
      expect(identity(stats), item.id).toEqual(identity(before));
      expect(stats.splashRadius).toBeGreaterThanOrEqual(before.splashRadius);
      expect(stats.chainTargets).toBe(before.chainTargets);
    }
    removeEquipmentModifiers(stats, inventory.equippedWeapon!.modifiers);
    for (const key of Object.keys(before) as (keyof PlayerStats)[]) {
      if (typeof before[key] === 'number') expect(stats[key] as number, key).toBeCloseTo(before[key] as number, 6);
      else expect(stats[key], key).toBe(before[key]);
    }
  });

  it('keeps spore splash and arc chains whatever mod is installed', () => {
    for (const item of ALL_MODS) {
      const spore = starter('spore');
      applyEquipmentModifiers(spore, item.modifiers);
      expect(spore.weaponMode).toBe('plasma');
      expect(spore.splashRadius).toBeGreaterThanOrEqual(108);
      const arc = starter('arc');
      applyEquipmentModifiers(arc, item.modifiers);
      expect(arc.weaponMode).toBe('arc');
      expect(arc.chainTargets).toBe(2);
      expect(arc.chainRange).toBeGreaterThanOrEqual(190);
    }
  });

  it('swaps one stored mod for another cleanly through the inventory', () => {
    const stats = starter('arc');
    const base = { ...stats };
    const inventory = new RunInventory();
    const plasma = mod('cañón-de-plasma', 'EPIC');
    const blaster = mod('bláster-arc', 'RARE');
    equip(stats, inventory, plasma);
    equip(stats, inventory, blaster);
    const swap = inventory.activateWeapon(0);
    expect(swap.current).toBe(plasma);
    removeEquipmentModifiers(stats, swap.previous!.modifiers);
    applyEquipmentModifiers(stats, swap.current!.modifiers);
    const onlyPlasma = { ...base };
    applyEquipmentModifiers(onlyPlasma, plasma.modifiers);
    expect(stats.attackDamage).toBeCloseTo(onlyPlasma.attackDamage);
    expect(stats.attackCooldown).toBeCloseTo(base.attackCooldown);
    expect(stats.chainRange).toBeCloseTo(base.chainRange);
    expect(stats.splashRadius).toBeCloseTo(onlyPlasma.splashRadius);
    expect(stats.weaponMode).toBe('arc');
  });

  it('survives the signature evolution: removing a mod afterwards leaves the evolved weapon intact', () => {
    for (const id of ['pulse', 'spore', 'arc'] as const) {
      for (const item of ALL_MODS) {
        const stats = starter(id);
        applyEquipmentModifiers(stats, item.modifiers);
        const ability = getAbilityById(signatureAbilityId(id))!;
        for (let level = 1; level <= 3; level++) ability.apply(stats, level);
        const evolved = identity(stats);
        removeEquipmentModifiers(stats, item.modifiers);
        expect(identity(stats), `${id} ${item.id}`).toEqual(evolved);
      }
    }
  });

  it('scales the themed bonuses with rarity', () => {
    for (const name of Object.keys(MOD_ROLLS) as (keyof typeof MOD_ROLLS)[]) {
      const damage = (['COMMON', 'RARE', 'EPIC', 'LEGENDARY'] as const).map(rarity =>
        mod(name, rarity).modifiers.find(modifier => modifier.key === 'attackDamage')!.value as number);
      expect(damage, name).toEqual([...damage].sort((a, b) => a - b));
      expect(damage[3], name).toBeGreaterThan(damage[0] * 2);
    }
    const pierce = (rarity: keyof typeof RARITY_ROLLS) =>
      mod('láser-iónico', rarity).modifiers.find(modifier => modifier.key === 'projectilePiercing')!.value;
    expect([pierce('COMMON'), pierce('RARE'), pierce('EPIC'), pierce('LEGENDARY')]).toEqual([1, 1, 2, 2]);
  });
});

describe('build synergies with weapon mods', () => {
  const pieces = [armor(0.1), armor(0.5), armor(0.9), module(0.1), module(0.5), module(0.9)];

  it('points every synergy at item ids the loot table can roll', () => {
    const ids = new Set([...ALL_MODS, ...pieces].map(item => item.id));
    for (const synergy of SYNERGIES) {
      expect(ids.has(synergy.weaponItem), synergy.weaponItem).toBe(true);
      expect(ids.has(synergy.requiredItem), synergy.requiredItem).toBe(true);
      expect(synergy.modifiers.some(modifier => modifier.key === 'weaponMode' || modifier.operation === 'set')).toBe(false);
    }
  });

  it.each(SYNERGIES.map(synergy => [synergy.id, synergy] as const))('activates %s for any starter', (_, synergy) => {
    const weapon = ALL_MODS.find(item => item.id === synergy.weaponItem)!;
    const piece = pieces.find(item => item.id === synergy.requiredItem)!;
    expect(activeBuildSynergy([weapon, piece], weapon)?.id).toBe(synergy.id);
    for (const id of ['spore', 'arc'] as const) {
      const stats = starter(id);
      const before = identity(stats);
      applyEquipmentModifiers(stats, weapon.modifiers);
      applyEquipmentModifiers(stats, synergy.modifiers);
      expect(identity(stats)).toEqual(before);
    }
  });

  it('needs the matching mod to be the equipped one', () => {
    const plasma = mod('cañón-de-plasma');
    const pistol = mod('pistola-de-pulso');
    const bioSteel = armor(0.1);
    expect(activeBuildSynergy([plasma, pistol, bioSteel], pistol)).toBeUndefined();
    expect(activeBuildSynergy([plasma, pistol, bioSteel], plasma)?.id).toBe('plague-bastion');
    expect(activeBuildSynergy([plasma, bioSteel], undefined)).toBeUndefined();
  });
});
