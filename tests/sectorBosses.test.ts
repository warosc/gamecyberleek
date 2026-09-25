import { describe, expect, it, vi } from 'vitest';

// BossVisual extends a Phaser container; only its data exports are under test here.
vi.mock('phaser', () => ({ default: { GameObjects: { Container: class {} } } }));
const { BOSS_VARIANTS, bossVariant } = await import('../src/game/entities/enemies/BossVisual');
const { ENEMY_DEFS, EnemyType, FAMILY_RULES } = await import('../src/game/entities/enemies/EnemyTypes');

describe('sector commanders', () => {
  it('gives each sector a distinct commander that is tougher than the last', () => {
    expect(new Set(BOSS_VARIANTS.map(boss => boss.name)).size).toBe(3);
    BOSS_VARIANTS.forEach((boss, index) => {
      if (index) expect(boss.healthScale).toBeGreaterThan(BOSS_VARIANTS[index - 1].healthScale);
    });
    expect(BOSS_VARIANTS.map(boss => boss.signature)).toEqual(['none', 'bloom', 'cryo-lance']);
  });

  it('clamps unknown sectors to a valid commander', () => {
    expect(bossVariant(-1).name).toBe('BRÓK-9');
    expect(bossVariant(9).name).toBe('ROMA-X');
  });
});

describe('enemy families', () => {
  it('keeps the medic harmless on contact and the bulwark tanky and slow', () => {
    expect(ENEMY_DEFS[EnemyType.MEDIC].damage).toBe(0);
    expect(ENEMY_DEFS[EnemyType.MEDIC].behavior).toBe('support');
    expect(ENEMY_DEFS[EnemyType.BULWARK].hp).toBeGreaterThan(ENEMY_DEFS[EnemyType.TANK].hp);
    expect(ENEMY_DEFS[EnemyType.BULWARK].speed).toBeLessThan(ENEMY_DEFS[EnemyType.TANK].speed);
  });

  it('bounds the family rules', () => {
    expect(FAMILY_RULES.medic.healFraction).toBeLessThan(0.5);
    expect(FAMILY_RULES.bulwark.damageTaken).toBeGreaterThan(0.3);
    expect(FAMILY_RULES.brood.spawns).toBeLessThanOrEqual(3);
  });
});
