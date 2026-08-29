import { beforeEach, describe, expect, it, vi } from 'vitest';

// The node test environment has no localStorage. A minimal in-memory stand-in exercises the
// real persistence path, including the quota failure the store has to survive.
function installStorage(failWrites = false) {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (failWrites) throw new Error('QuotaExceededError');
      data.set(key, value);
    },
    removeItem: (key: string) => void data.delete(key),
  };
  vi.stubGlobal('localStorage', storage);
  return data;
}

const load = async () => await import('../src/game/systems/RunTelemetry');

describe('run telemetry', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('accumulates a run and appends it to the local history', async () => {
    installStorage();
    const { RunTelemetry, loadRunHistory } = await load();
    const telemetry = new RunTelemetry();
    telemetry.shotFired();
    telemetry.shotFired();
    telemetry.dealtDamage(30);
    telemetry.dealtDamage(12.4);
    telemetry.tookDamage(8);
    telemetry.killed();
    telemetry.usedAbility('nova');
    telemetry.usedAbility('nova');
    telemetry.choseUpgrade('power');
    telemetry.choseUpgrade('rapid');
    telemetry.finish(64_200, 4, 'death');

    const [record] = loadRunHistory();
    expect(record.shotsFired).toBe(2);
    expect(record.damageDealt).toBe(42);
    expect(record.damageTaken).toBe(8);
    expect(record.kills).toBe(1);
    expect(record.abilityUses.nova).toBe(2);
    expect(record.upgrades).toEqual(['power', 'rapid']);
    expect(record.durationMs).toBe(64_200);
    expect(record.level).toBe(4);
    expect(record.outcome).toBe('death');
    expect(record.restarted).toBe(false);
  });

  it('finishes a run only once, so a victory racing a death cannot double-count', async () => {
    installStorage();
    const { RunTelemetry, loadRunHistory } = await load();
    const telemetry = new RunTelemetry();
    telemetry.finish(1000, 2, 'victory');
    telemetry.finish(9999, 7, 'death');
    const history = loadRunHistory();
    expect(history).toHaveLength(1);
    expect(history[0].outcome).toBe('victory');
    expect(history[0].level).toBe(2);
  });

  it('marks the finished run when the player chooses to go again', async () => {
    installStorage();
    const { RunTelemetry, loadRunHistory, recordRestart } = await load();
    new RunTelemetry().finish(5000, 2, 'death');
    recordRestart();
    expect(loadRunHistory()[0].restarted).toBe(true);
  });

  it('never lets a storage failure escape into the run', async () => {
    // Safari private browsing throws on setItem, and this runs on the death transition — a
    // path the player cannot avoid. An escaping error would kill the game loop.
    installStorage(true);
    const { RunTelemetry, loadRunHistory, recordRestart } = await load();
    expect(() => new RunTelemetry().finish(5000, 2, 'death')).not.toThrow();
    expect(() => recordRestart()).not.toThrow();
    expect(loadRunHistory()).toEqual([]);
  });

  it('summarises restart rate and whether players ever saw a level-up', async () => {
    installStorage();
    const { RunTelemetry, summariseRuns, recordRestart } = await load();
    new RunTelemetry().finish(10_000, 1, 'death');
    recordRestart();
    new RunTelemetry().finish(30_000, 5, 'death');
    new RunTelemetry().finish(20_000, 3, 'death');

    const summary = summariseRuns();
    expect(summary.runs).toBe(3);
    expect(summary.restartRate).toBeCloseTo(1 / 3);
    expect(summary.medianDurationMs).toBe(20_000);
    // Two of the three runs got past level 1, which is the onboarding question that matters.
    expect(summary.reachedLevelUp).toBeCloseTo(2 / 3);
  });

  it('reports an empty history without dividing by zero', async () => {
    installStorage();
    const { summariseRuns } = await load();
    expect(summariseRuns()).toEqual({
      runs: 0,
      restartRate: 0,
      medianDurationMs: 0,
      reachedLevelUp: 0,
      bossReached: 0,
      bossDefeated: 0,
    });
  });

  it('bounds the stored history so a long session cannot grow without limit', async () => {
    installStorage();
    const { RunTelemetry, loadRunHistory } = await load();
    for (let run = 0; run < 40; run++) new RunTelemetry().finish(1000 + run, 1, 'death');
    const history = loadRunHistory();
    expect(history.length).toBeLessThanOrEqual(25);
    // The most recent runs are the ones kept.
    expect(history[history.length - 1].durationMs).toBe(1039);
  });
});
