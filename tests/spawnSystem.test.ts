import { beforeEach, describe, expect, it, vi } from 'vitest';

// Phaser needs a DOM and cannot be imported in the node test environment. SpawnSystem only
// reaches for Phaser.Math.Clamp, so a minimal stand-in keeps the real spawn logic under test.
vi.mock('phaser', () => ({
  default: { Math: { Clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)) } },
}));

const { SpawnSystem, SECTOR_FAMILIES, FAMILY_START_MS } = await import('../src/game/systems/SpawnSystem');
const { GAMEPLAY } = await import('../src/game/config/Constants');
const { EnemyType } = await import('../src/game/entities/enemies/EnemyTypes');

interface FakeEnemy {
  enemyType: unknown;
  eliteAffix: string;
  elite: boolean;
  makeElite(): FakeEnemy;
}

function harness(sector = 0) {
  const spawned: FakeEnemy[] = [];
  const factory = {
    create(type: unknown) {
      const enemy: FakeEnemy = {
        enemyType: type,
        eliteAffix: 'OVERCHARGED',
        elite: false,
        makeElite() {
          this.elite = true;
          return this;
        },
      };
      spawned.push(enemy);
      return enemy;
    },
  };
  const group = { children: [] as FakeEnemy[], add(e: FakeEnemy) { this.children.push(e); }, countActive: () => 0 };
  // The constructor is typed against the real Phaser group and EnemyFactory; the stubs above
  // implement exactly the surface SpawnSystem uses.
  const system = new SpawnSystem(
    factory as unknown as ConstructorParameters<typeof SpawnSystem>[0],
    group as unknown as ConstructorParameters<typeof SpawnSystem>[1],
    sector,
  );
  const run = (steps: number, delta = 1000) => {
    for (let step = 0; step < steps; step++) system.update(delta, { x: 500, y: 500 });
  };
  return { spawned, run };
}

describe('spawn system elite gating', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('never makes an enemy elite before the elite window opens', () => {
    // Regression: a missing brace left `makeElite()` outside the elite branch, so every
    // enemy spawned from the first second was an elite with a crown, an affix label and up
    // to 2.8x health. Elites stopped being readable and difficulty was inflated for the
    // whole run. Forcing the roll to always succeed proves the time gate is what holds.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { spawned, run } = harness();
    run(Math.floor(GAMEPLAY.eliteStartMs / 1000));
    expect(spawned.length).toBeGreaterThan(0);
    expect(spawned.every((enemy) => !enemy.elite)).toBe(true);
  });

  it('keeps elites rare once the window is open', () => {
    // A roll of 0.99 is above eliteMaxChance (0.12), so no spawn may be promoted even
    // deep into a run.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const { spawned, run } = harness();
    run(240);
    expect(spawned.length).toBeGreaterThan(0);
    expect(spawned.filter((enemy) => enemy.elite)).toHaveLength(0);
  });

  it('still promotes an enemy when the roll succeeds inside the window', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { spawned, run } = harness();
    run(240);
    const elites = spawned.filter((enemy) => enemy.elite);
    expect(elites.length).toBeGreaterThan(0);
    expect(elites.every((enemy) => enemy.enemyType !== EnemyType.BOSS)).toBe(true);
  });
});

describe('sector enemy families', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('adds no family enemy before the family window opens', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { spawned, run } = harness(2);
    run(Math.floor(FAMILY_START_MS / 1000) - 1);
    const families = new Set(SECTOR_FAMILIES.flat());
    expect(spawned.some((enemy) => families.has(enemy.enemyType as never))).toBe(false);
  });

  it('mixes in only the current sector\'s families afterwards', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    for (const sector of [0, 1, 2]) {
      const { spawned, run } = harness(sector);
      run(200);
      const allowed = new Set([EnemyType.GRUNT, EnemyType.RUNNER, EnemyType.SHOOTER, EnemyType.TANK, ...SECTOR_FAMILIES[sector]]);
      expect(spawned.every((enemy) => allowed.has(enemy.enemyType as never))).toBe(true);
      expect(spawned.some((enemy) => SECTOR_FAMILIES[sector].includes(enemy.enemyType as never))).toBe(true);
    }
  });
});
