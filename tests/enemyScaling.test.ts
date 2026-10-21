import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bossHealth,
  enemyHealthMultiplier,
  minibossHealth,
  scaleHealthPool,
  sectorDamageMultiplier,
  sectorHealthFactor,
  timeHealthFactor,
} from '../src/game/config/EnemyScaling';
import { HealthComponent } from '../src/game/components/HealthComponent';
import { ELITE_AFFIX_DEFS, ENEMY_DEFS, EnemyType } from '../src/game/entities/enemies/EnemyTypes';

// Phaser cannot load in the node environment. The systems below only need Clamp and a base class
// for the visuals they import; Enemy is replaced by a stand-in whose health and scaling use the
// same HealthComponent and scaleHealthPool as the real one, so the pools under test are real.
vi.mock('phaser', () => ({
  default: {
    Math: { Clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)) },
    GameObjects: { Container: class {} },
  },
}));
vi.mock('../src/game/systems/RuntimeSettings', () => ({ shakeCamera: () => {} }));
vi.mock('../src/game/entities/enemies/Enemy', async () => {
  const { HealthComponent: Health } = await import('../src/game/components/HealthComponent');
  const { ENEMY_DEFS: defs } = await import('../src/game/entities/enemies/EnemyTypes');
  const { scaleHealthPool: scale } = await import('../src/game/config/EnemyScaling');
  class Enemy {
    readonly health: InstanceType<typeof Health>;
    damageScale = 1;
    active = true;
    constructor(_scene: unknown, public x: number, public y: number, public enemyType: keyof typeof defs) {
      this.health = new Health(defs[enemyType].hp);
    }
    applyScaling(health: number, damage = 1) {
      scale(this.health, health);
      this.damageScale = damage;
      return this;
    }
  }
  return { Enemy };
});

const { createScaledEnemy, EnemyFactory } = await import('../src/game/entities/enemies/EnemyFactory');
const { SpawnSystem } = await import('../src/game/systems/SpawnSystem');
const { EncounterSystem } = await import('../src/game/systems/EncounterSystem');
const { BossPhaseDirector } = await import('../src/game/systems/BossPhaseDirector');
const { BOSS_REINFORCEMENTS } = await import('../src/game/config/BossPhases');

type FakeEnemy = { enemyType: EnemyType; health: HealthComponent; damageScale: number };

describe('enemy health formulas', () => {
  it('grows 40 % per minute of run time and stops at the commander', () => {
    expect(timeHealthFactor(0)).toBe(1);
    expect(timeHealthFactor(60000)).toBeCloseTo(1.4);
    expect(timeHealthFactor(240000)).toBeCloseTo(2.6);
    // Boss reinforcements and late brood splits do not keep inflating during a long fight.
    expect(timeHealthFactor(360000)).toBeCloseTo(2.6);
    expect(timeHealthFactor(-5000)).toBe(1);
  });

  it('uses fixed sector factors and clamps unknown sectors', () => {
    expect([0, 1, 2].map(sectorHealthFactor)).toEqual([1, 1.25, 1.55]);
    expect(sectorHealthFactor(-1)).toBe(1);
    expect(sectorHealthFactor(7)).toBe(1.55);
    expect([0, 1, 2].map(sectorDamageMultiplier)).toEqual([1, 1.1, 1.2]);
    expect(sectorDamageMultiplier(9)).toBe(1.2);
  });

  it('multiplies time and sector for regular enemies', () => {
    expect(enemyHealthMultiplier(0, 0)).toBe(1);
    expect(enemyHealthMultiplier(60000, 1)).toBeCloseTo(1.75);
    expect(enemyHealthMultiplier(240000, 2)).toBeCloseTo(4.03);
  });

  it('scales the miniboss with its sector and the wave it arrives with', () => {
    const base = ENEMY_DEFS[EnemyType.MINIBOSS].hp;
    expect([0, 1, 2].map(sector => minibossHealth(base, sector))).toEqual([1120, 1400, 1736]);
  });

  it('sizes the commander to ~15 s of sustained DPS between a floor and a 6x cap', () => {
    const base = ENEMY_DEFS[EnemyType.BOSS].hp;
    // Floor: a weak build still faces at least the sector base.
    expect(bossHealth(base, 0, 0)).toBe(1800);
    expect(bossHealth(base, 2, 50)).toBe(2790);
    expect(bossHealth(base, 0, 300)).toBe(4500);
    expect(bossHealth(base, 1, 500)).toBe(7500);
    // Cap: a degenerate build cannot make the fight endless.
    expect(bossHealth(base, 0, 1500)).toBe(10800);
    expect(bossHealth(base, 2, 1e6)).toBe(16740);
    expect(bossHealth(base, 0, Number.NaN)).toBe(1800);
  });

  it('refills the pool and keeps elite affixes multiplying on top', () => {
    const health = scaleHealthPool(new HealthComponent(40), enemyHealthMultiplier(120000, 2));
    expect(health.max).toBe(112);
    expect(health.current).toBe(health.max);
    // The same order makeElite uses: scaled pool first, then the affix.
    const elite = Math.round(health.max * ELITE_AFFIX_DEFS.ARMORED.healthMultiplier);
    expect(elite).toBe(314);
  });
});

describe('enemy creation sites apply the scaling', () => {
  beforeEach(() => vi.restoreAllMocks());
  const scene = {} as never;

  it('creates scaled enemies through the shared helper and the factory', () => {
    const runner = createScaledEnemy(scene, EnemyType.RUNNER, 0, 0, 210000, 1) as unknown as FakeEnemy;
    expect(runner.health.max).toBe(Math.round(24 * enemyHealthMultiplier(210000, 1)));
    expect(runner.health.current).toBe(runner.health.max);
    expect(runner.damageScale).toBe(1.1);
    // Unscaled by default, so direct test scenes keep base stats.
    const plain = new EnemyFactory(scene).create(EnemyType.GRUNT, 0, 0) as unknown as FakeEnemy;
    expect(plain.health.max).toBe(40);
    expect(plain.damageScale).toBe(1);
  });

  it('spawns waves with the gameplay clock and the sector', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const spawned: FakeEnemy[] = [];
    const factory = new EnemyFactory(scene);
    const group = { add: (enemy: FakeEnemy) => spawned.push(enemy), countActive: () => 0 };
    const system = new SpawnSystem(factory, group as never, 2);
    // The spawn clock says 1 s, the scene says 3:00: the scene's clock wins.
    system.update(1000, { x: 500, y: 500 }, 180000);
    expect(spawned).toHaveLength(1);
    const [enemy] = spawned;
    const expected = Math.round(ENEMY_DEFS[enemy.enemyType].hp * enemyHealthMultiplier(180000, 2));
    expect(enemy.health.max).toBe(expected);
    expect(enemy.damageScale).toBe(1.2);
  });

  it('scales the miniboss and sizes the commander from the player DPS', () => {
    const events: unknown[][] = [];
    const fakeScene = {
      events: { emit: (...args: unknown[]) => events.push(args) },
      cameras: { main: {} },
    };
    const enemies: FakeEnemy[] = [];
    const group = { add: (enemy: FakeEnemy) => enemies.push(enemy), getChildren: () => enemies, clear: () => { enemies.length = 0; } };
    // 50 damage × 1.5 (a second projectile adds half) × 4 shots/s = 300 DPS → 4500 HP, inside the
    // 1800..10800 band.
    const player = { x: 500, y: 500, stats: { attackDamage: 50, projectileCount: 2, extraProjectileDamage: 0.5, attackCooldown: 250 } };
    const encounters = new EncounterSystem(fakeScene as never, group as never, player as never, 0);
    encounters.spawnMiniboss();
    expect(enemies[0].health.max).toBe(1120);
    encounters.spawnBoss();
    expect(enemies[0].enemyType).toBe(EnemyType.BOSS);
    expect(enemies[0].health.max).toBe(4500);
    expect(enemies[0].health.current).toBe(4500);
    // The boss panel is told the scaled maximum, or its bar would start overfilled.
    expect(events.at(-1)?.slice(1)).toEqual(['BRÓK-9', 4500]);
  });

  it('gives boss reinforcements the capped wave scaling', () => {
    const enemies: FakeEnemy[] = [];
    const ring = { setStrokeStyle: () => ring, setDepth: () => ring };
    const fakeScene = {
      events: { emit: () => {} },
      add: { circle: () => ring },
      tweens: { add: () => {} },
    };
    const group = { add: (enemy: FakeEnemy) => enemies.push(enemy), countActive: () => 1 };
    const director = new BossPhaseDirector(fakeScene as never, group as never, 1);
    director.enter(2, { x: 1000, y: 1000 } as never);
    expect(enemies).toHaveLength(BOSS_REINFORCEMENTS[1].phase2.length);
    for (const enemy of enemies)
      expect(enemy.health.max).toBe(Math.round(ENEMY_DEFS[enemy.enemyType].hp * 2.6 * 1.25));
  });
});
