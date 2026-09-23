import { afterEach, describe, expect, it, vi } from 'vitest';

// Phaser-backed modules are imported only for their data tables.
vi.mock('phaser', () => ({ default: { GameObjects: { Container: class {} } } }));

const { PHRASES_EN } = await import('../src/game/i18n/phrases');
const { es } = await import('../src/game/i18n/es');
const { en } = await import('../src/game/i18n/en');
const { setLocale, td, t } = await import('../src/game/i18n');
const { RUN_PHASES, RUN_PHASE_CALLOUTS } = await import('../src/game/config/RunPacing');
const { BOSS_PHASE_CALLOUTS } = await import('../src/game/config/BossPhases');
const { SECTOR_HAZARDS } = await import('../src/game/config/SectorHazards');
const { SECTOR_DEVICES } = await import('../src/game/config/SectorDevices');
const { SECTOR_OBJECTIVES } = await import('../src/game/systems/SectorObjectiveSystem');
const { ALL_CONTRACT_KINDS, contractTitle } = await import('../src/game/systems/ContractSystem');
const { SYNERGIES } = await import('../src/game/systems/BuildProgression');
const { MINIBOSS_VARIANTS } = await import('../src/game/entities/enemies/MinibossVisual');
const { BOSS_IDENTITY, BOSS_VARIANTS } = await import('../src/game/entities/enemies/BossVisual');
const { VEGETABLE_ROSTER } = await import('../src/game/entities/enemies/VegetableRoster');
const { WORKSHOP_UPGRADES } = await import('../src/game/progression/Workshop');
const { DAILY_MUTATORS } = await import('../src/game/progression/DailyOperation');
const { ACHIEVEMENTS } = await import('../src/game/progression/Achievements');
const { ABILITIES } = await import('../src/game/abilities/AbilityRegistry');
const { rollEquipment } = await import('../src/game/loot/Equipment');

const dataStrings = [
  ...RUN_PHASES.map(phase => phase.label),
  ...Object.values(RUN_PHASE_CALLOUTS).flatMap(callout => [callout.title, callout.brief]),
  ...Object.values(BOSS_PHASE_CALLOUTS).flatMap(callout => [callout.title, callout.brief]),
  ...SECTOR_HAZARDS.flatMap(hazard => [hazard.title, hazard.brief]),
  ...SECTOR_DEVICES.map(device => device.name),
  ...SECTOR_OBJECTIVES.flatMap(objective => [objective.title, objective.brief, objective.reward]),
  ...ALL_CONTRACT_KINDS.map(contractTitle),
  ...SYNERGIES.map(synergy => synergy.name),
  ...MINIBOSS_VARIANTS.map(variant => variant.title),
  ...BOSS_VARIANTS.map(variant => variant.title),
  ...BOSS_IDENTITY.phases,
  ...Object.values(VEGETABLE_ROSTER).map(spec => spec.role),
  ...WORKSHOP_UPGRADES.flatMap(upgrade => [upgrade.name, upgrade.effect]),
  ...DAILY_MUTATORS.flatMap(mutator => [mutator.name, mutator.description]),
  ...ACHIEVEMENTS.flatMap(achievement => [achievement.name, achievement.description]),
];

afterEach(() => setLocale('es'));

describe('English coverage', () => {
  it.each(dataStrings)('translates data string "%s"', text => {
    expect(PHRASES_EN[text], text).toBeTruthy();
  });

  it('defines every UI key in both languages with the same placeholders', () => {
    for (const key of Object.keys(es) as (keyof typeof es)[]) {
      const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
      expect(placeholders(en[key]), key).toEqual(placeholders(es[key]));
    }
  });

  it('has an English name and description for every level-up ability', () => {
    setLocale('en');
    for (const ability of ABILITIES) {
      expect(`ability.${ability.id}.name` in es, ability.id).toBe(true);
      expect(`ability.${ability.id}.desc` in es, ability.id).toBe(true);
    }
  });

  it('leaves no Spanish stat words in generated equipment text', () => {
    setLocale('en');
    const spanish = /daño|crítico|armadura|movimiento|perforación|velocidad|alcance|radio|más/;
    for (let seed = 0; seed < 200; seed++) {
      let state = seed + 1;
      const random = () => ((state = (state * 16807) % 2147483647) / 2147483647);
      const item = rollEquipment(1 + (seed % 15), random);
      expect(td(item.description), item.description).not.toMatch(spanish);
      expect(td(item.name), item.name).not.toBe(item.name);
    }
  });

  it('keeps Spanish untouched and fills placeholders', () => {
    expect(td('SABOTAJE')).toBe('SABOTAJE');
    setLocale('en');
    expect(td('SABOTAJE')).toBe('SABOTAGE');
    expect(t('hud.hp', { current: 5, max: 10 })).toBe('HP 5 / 10');
  });
});
