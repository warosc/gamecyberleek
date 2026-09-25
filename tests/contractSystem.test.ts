import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ALL_CONTRACT_KINDS,
  CONTRACTS_PER_RUN,
  ContractSystem,
  PERFECT_BONUS_CREDITS,
  contractDescription,
  type ContractProgress,
} from '../src/game/systems/ContractSystem';

/** Builds one contract in its rolled-but-untouched state, matching what the constructor produces. */
function contract(kind: ContractProgress['kind'], target: number, reward: number): ContractProgress {
  const titles: Record<ContractProgress['kind'], string> = {
    ELIMINATIONS: 'ELIMINACIONES',
    KILL_STREAK: 'CADENA LETAL',
    DEVICE_KILLS: 'SABOTAJE',
    UNSCATHED: 'SIN RASGUÑOS',
    ELITE_HUNT: 'CAZA MAYOR',
  };
  return { kind, title: titles[kind], target, progress: 0, completed: false, reward };
}

describe('contract selection', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('always rolls three distinct contracts out of the five known kinds', () => {
    for (let trial = 0; trial < 25; trial++) {
      const system = new ContractSystem();
      expect(system.list).toHaveLength(CONTRACTS_PER_RUN);
      const kinds = system.list.map((c) => c.kind);
      expect(new Set(kinds).size).toBe(CONTRACTS_PER_RUN);
      for (const kind of kinds) expect(ALL_CONTRACT_KINDS).toContain(kind);
      for (const c of system.list) {
        expect(c.progress).toBe(0);
        expect(c.completed).toBe(false);
        expect(c.target).toBeGreaterThan(0);
      }
    }
  });

  it('deterministically shuffles and rolls targets from a fixed random source', () => {
    // A roll of 0 always swaps the current index with slot 0, which reverses everything but
    // the first element into ascending original order, then takes the low end of every target
    // range. Exact values here pin the RNG contract; a change to shuffle order or ranges
    // should be a deliberate, reviewed change to this test.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const system = new ContractSystem();
    expect(system.list.map((c) => c.kind)).toEqual(['KILL_STREAK', 'DEVICE_KILLS', 'UNSCATHED']);
    expect(system.list.map((c) => c.target)).toEqual([5, 2, 30000]);
  });

  it('describes a contract using its rolled target', () => {
    expect(contractDescription({ kind: 'ELIMINATIONS', target: 20 })).toBe('Elimina 20 enemigos');
    expect(contractDescription({ kind: 'UNSCATHED', target: 45000 })).toBe('Sobrevive 45s sin recibir daño');
  });
});

describe('contract progress', () => {
  it('counts every elimination once, regardless of cause, until the target is met', () => {
    const system = new ContractSystem([contract('ELIMINATIONS', 3, 45)]);
    expect(system.onEnemyDefeated({ elite: false, boss: false, environment: false })).toBeUndefined();
    expect(system.list[0].progress).toBe(1);
    expect(system.onEnemyDefeated({ elite: true, boss: false, environment: true })).toBeUndefined();
    expect(system.list[0].progress).toBe(2);
    const completed = system.onEnemyDefeated({ elite: false, boss: false, environment: false });
    expect(completed?.kind).toBe('ELIMINATIONS');
    expect(system.list[0]).toMatchObject({ completed: true, progress: 3 });
    // Already complete: further kills must not push progress past the target or re-fire.
    expect(system.onEnemyDefeated({ elite: false, boss: false, environment: false })).toBeUndefined();
    expect(system.list[0].progress).toBe(3);
  });

  it('only counts device kills when the enemy died from the environment', () => {
    const system = new ContractSystem([contract('DEVICE_KILLS', 2, 60)]);
    system.onEnemyDefeated({ elite: false, boss: false, environment: false });
    expect(system.list[0].progress).toBe(0);
    system.onEnemyDefeated({ elite: false, boss: false, environment: true });
    expect(system.list[0].progress).toBe(1);
    const completed = system.onEnemyDefeated({ elite: false, boss: false, environment: true });
    expect(completed?.kind).toBe('DEVICE_KILLS');
  });

  it('still counts a kill toward every other open contract even when it also completes one', () => {
    // Regression: an early `return` out of the ELIMINATIONS branch used to skip the
    // environment/elite checks entirely whenever that same kill happened to be the one that
    // finished ELIMINATIONS, silently dropping the other contract's progress for that kill.
    const system = new ContractSystem([
      contract('ELIMINATIONS', 1, 45),
      contract('DEVICE_KILLS', 1, 60),
      contract('ELITE_HUNT', 1, 70),
    ]);
    // One kill that is simultaneously the last elimination, an environment kill, and an elite.
    const completed = system.onEnemyDefeated({ elite: true, boss: false, environment: true });
    expect(completed).toBeDefined();
    expect(system.list.every((c) => c.completed)).toBe(true);
    expect(system.summary().completedCount).toBe(3);
  });

  it('counts elites toward the hunt but a boss kill always finishes it outright', () => {
    const system = new ContractSystem([contract('ELITE_HUNT', 3, 70)]);
    system.onEnemyDefeated({ elite: true, boss: false, environment: false });
    expect(system.list[0]).toMatchObject({ progress: 1, completed: false });
    const completed = system.onEnemyDefeated({ elite: false, boss: true, environment: false });
    expect(completed?.kind).toBe('ELITE_HUNT');
    expect(system.list[0]).toMatchObject({ progress: 3, completed: true });
  });

  it('tracks the longest kill chain reached, not the current one', () => {
    const system = new ContractSystem([contract('KILL_STREAK', 5, 55)]);
    system.onMomentumChanged({ chain: 4, tier: 1, xpMultiplier: 1.1, expiresAt: 0 });
    expect(system.list[0].progress).toBe(4);
    // Chain resets after the response window; the contract must not lose earned progress.
    system.onMomentumChanged({ chain: 0, tier: 0, xpMultiplier: 1, expiresAt: 0 });
    expect(system.list[0].progress).toBe(4);
    const completed = system.onMomentumChanged({ chain: 5, tier: 1, xpMultiplier: 1.1, expiresAt: 0 });
    expect(completed?.kind).toBe('KILL_STREAK');
  });

  it('completes the unscathed contract only after a continuous clean interval', () => {
    const system = new ContractSystem([contract('UNSCATHED', 30000, 65)]);
    expect(system.update(20000)).toBeUndefined();
    expect(system.list[0].progress).toBe(20000);
    system.onPlayerDamaged(25000);
    expect(system.update(30000)).toBeUndefined(); // only 5s clean since the hit
    expect(system.list[0].progress).toBe(5000);
    const completed = system.update(55000);
    expect(completed?.kind).toBe('UNSCATHED');
    expect(system.list[0]).toMatchObject({ completed: true, progress: 30000 });
  });
});

describe('contract rewards', () => {
  it('sums only completed contracts and withholds the perfect bonus otherwise', () => {
    const system = new ContractSystem([
      contract('ELIMINATIONS', 1, 45),
      contract('DEVICE_KILLS', 5, 60),
      contract('KILL_STREAK', 5, 55),
    ]);
    system.onEnemyDefeated({ elite: false, boss: false, environment: false });
    const outcome = system.summary();
    expect(outcome.completedCount).toBe(1);
    expect(outcome.perfect).toBe(false);
    expect(outcome.creditsEarned).toBe(45);
  });

  it('adds the perfect-run bonus once all three contracts are done', () => {
    const system = new ContractSystem([
      contract('ELIMINATIONS', 1, 45),
      contract('DEVICE_KILLS', 1, 60),
      contract('ELITE_HUNT', 1, 70),
    ]);
    system.onEnemyDefeated({ elite: false, boss: false, environment: false }); // eliminations
    system.onEnemyDefeated({ elite: false, boss: false, environment: true }); // device kill
    system.onEnemyDefeated({ elite: true, boss: false, environment: false }); // elite hunt
    const outcome = system.summary();
    expect(outcome.completedCount).toBe(3);
    expect(outcome.perfect).toBe(true);
    expect(outcome.creditsEarned).toBe(45 + 60 + 70 + PERFECT_BONUS_CREDITS);
  });
});
