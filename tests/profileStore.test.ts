import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ProfileStore talks to `localStorage` directly (see its own comment on why persistence must
 * never throw into the game loop). Vitest runs in Node with no DOM, so this stands in a minimal
 * synchronous Storage rather than pulling in jsdom for one module.
 */
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number) {
    return [...this.store.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal('localStorage', storage);
  vi.resetModules();
});

describe('profile schema migration', () => {
  it('starts a fresh profile with zeroed contract stats', async () => {
    const { loadProfile } = await import('../src/game/systems/ProfileStore');
    const profile = loadProfile();
    expect(profile.schemaVersion).toBe(5);
    expect(profile.contractsCompleted).toBe(0);
    expect(profile.perfectContracts).toBe(0);
  });

  it('migrates a pre-contracts (schema v3) profile without losing existing progress', async () => {
    storage.setItem(
      'leek-ops-profile-v3',
      JSON.stringify({
        schemaVersion: 3,
        runs: 4,
        bestLevel: 7,
        victories: 1,
        bioCredits: 140,
        vibration: true,
        autoFire: false,
        unlocks: ['sector-2'],
        weaponMastery: { pulse: 60, spore: 0, arc: 0 },
      }),
    );
    const { loadProfile } = await import('../src/game/systems/ProfileStore');
    const profile = loadProfile();
    expect(profile.schemaVersion).toBe(5);
    expect(profile.runs).toBe(4);
    expect(profile.bioCredits).toBe(140);
    expect(profile.unlocks).toEqual(['sector-2']);
    expect(profile.weaponMastery.pulse).toBe(60);
    // The fields this run introduces default safely instead of failing the whole load.
    expect(profile.contractsCompleted).toBe(0);
    expect(profile.perfectContracts).toBe(0);
    // The migrated profile is persisted back under the current key.
    expect(JSON.parse(storage.getItem('leek-ops-profile-v5')!).schemaVersion).toBe(5);
  });

  it('ignores corrupt contract fields rather than failing the whole profile', async () => {
    storage.setItem(
      'leek-ops-profile-v5',
      JSON.stringify({ schemaVersion: 5, contractsCompleted: 'not-a-number', perfectContracts: -3 }),
    );
    const { loadProfile } = await import('../src/game/systems/ProfileStore');
    const profile = loadProfile();
    expect(profile.contractsCompleted).toBe(0);
    expect(profile.perfectContracts).toBe(0);
  });
});

describe('saveRun contract rewards', () => {
  it('adds contract credits on top of the base run reward and tracks completions', async () => {
    const { saveRun } = await import('../src/game/systems/ProfileStore');
    const profile = saveRun(5, false, 'pulse', { creditsEarned: 165, completedCount: 2, perfect: false });
    expect(profile.bioCredits).toBe(5 * 5 + 165);
    expect(profile.contractsCompleted).toBe(2);
    expect(profile.perfectContracts).toBe(0);
  });

  it('increments perfectContracts only when all three contracts were completed', async () => {
    const { saveRun } = await import('../src/game/systems/ProfileStore');
    saveRun(3, true, 'arc', { creditsEarned: 295, completedCount: 3, perfect: true });
    const profile = saveRun(4, false, 'arc', { creditsEarned: 0, completedCount: 0, perfect: false });
    expect(profile.perfectContracts).toBe(1);
    expect(profile.contractsCompleted).toBe(3);
  });

  it('defaults to no contract reward when the caller omits one', async () => {
    const { saveRun } = await import('../src/game/systems/ProfileStore');
    const profile = saveRun(2, false);
    expect(profile.bioCredits).toBe(10);
    expect(profile.contractsCompleted).toBe(0);
    expect(profile.perfectContracts).toBe(0);
  });
});

describe('schema v5 progression', () => {
  it('migrates a v4 profile and defaults the new sections', async () => {
    storage.setItem('leek-ops-profile-v4', JSON.stringify({ schemaVersion: 4, runs: 9, bioCredits: 300, contractsCompleted: 5 }));
    const { loadProfile } = await import('../src/game/systems/ProfileStore');
    const profile = loadProfile();
    expect(profile).toMatchObject({ schemaVersion: 5, runs: 9, bioCredits: 300, contractsCompleted: 5, achievements: [], history: [] });
    expect(profile.workshop.plating).toBe(0);
    expect(profile.settings.locale).toBe('es');
  });

  it('pays more in later sectors and with the salvage upgrade', async () => {
    const { runCredits } = await import('../src/game/systems/ProfileStore');
    const { EMPTY_WORKSHOP } = await import('../src/game/progression/Workshop');
    expect(runCredits(10, false, 0, 0, EMPTY_WORKSHOP)).toBe(50);
    expect(runCredits(10, false, 0, 2, EMPTY_WORKSHOP)).toBe(75);
    expect(runCredits(10, false, 0, 2, { ...EMPTY_WORKSHOP, salvage: 3 })).toBe(98);
  });

  it('records lifetime stats, a bounded history and one-time achievement bonuses', async () => {
    const { saveRun } = await import('../src/game/systems/ProfileStore');
    const run = { sector: 2, durationMs: 290_000, kills: 120, damageDealt: 9000, damageTaken: 40, shotsFired: 100, hits: 60, bossDefeated: true };
    const first = saveRun(12, true, 'spore', undefined, run);
    // 12*5 + 100 = 160, x1.5 in sector 3 = 240, plus PRIMERA COSECHA 50, INTOCABLE 120, ROMPEHIELOS 150.
    expect(first.bioCredits).toBe(240 + 50 + 120 + 150);
    expect(first.achievements).toEqual(['first-harvest', 'untouchable', 'cryo-breaker']);
    expect(first.lifetime).toMatchObject({ kills: 120, bossKills: 1, fastestVictoryMs: 290_000, victoriesBySector: [0, 0, 1] });
    const second = saveRun(12, true, 'spore', undefined, run);
    expect(second.bioCredits - first.bioCredits).toBe(240);
    for (let index = 0; index < 20; index++) saveRun(1, false);
    const { loadProfile } = await import('../src/game/systems/ProfileStore');
    expect(loadProfile().history).toHaveLength(12);
  });

  it('spends credits in the workshop only when affordable', async () => {
    storage.setItem('leek-ops-profile-v5', JSON.stringify({ bioCredits: 70 }));
    const { purchaseWorkshopRank, loadProfile } = await import('../src/game/systems/ProfileStore');
    expect(purchaseWorkshopRank('plating')?.bioCredits).toBe(10);
    expect(purchaseWorkshopRank('plating')).toBeUndefined();
    expect(loadProfile().workshop.plating).toBe(1);
  });

  it('keeps the best daily score per date', async () => {
    const { saveRun, loadProfile } = await import('../src/game/systems/ProfileStore');
    saveRun(3, false, 'pulse', undefined, undefined, { date: '2026-09-23', score: 900 });
    saveRun(3, false, 'pulse', undefined, undefined, { date: '2026-09-23', score: 400 });
    expect(loadProfile().daily).toMatchObject({ date: '2026-09-23', bestScore: 900, attempts: 2, scores: [900, 400] });
  });
});

describe('save backup', () => {
  it('round-trips an exported save into a fresh browser', async () => {
    const first = await import('../src/game/systems/ProfileStore');
    first.saveRun(9, true, 'arc');
    const exported = first.exportProfileJson();
    storage.clear();
    vi.resetModules();
    const second = await import('../src/game/systems/ProfileStore');
    expect(second.loadProfile().runs).toBe(0);
    const restored = second.importProfileJson(exported);
    expect(restored).toMatchObject({ runs: 1, victories: 1, bestLevel: 9 });
    expect(second.loadProfile().runs).toBe(1);
  });

  it('rejects files that are not a LEEK OPS save and changes nothing', async () => {
    const { importProfileJson, loadProfile, saveRun } = await import('../src/game/systems/ProfileStore');
    saveRun(3, false);
    expect(importProfileJson('not json')).toBeUndefined();
    expect(importProfileJson(JSON.stringify({ game: 'other', profile: {} }))).toBeUndefined();
    expect(importProfileJson(JSON.stringify({ runs: 99 }))).toBeUndefined();
    expect(loadProfile().runs).toBe(1);
  });

  it('re-validates imported fields instead of trusting the file', async () => {
    const { importProfileJson } = await import('../src/game/systems/ProfileStore');
    const profile = importProfileJson(JSON.stringify({ game: 'leek-ops', profile: { bioCredits: -50, workshop: { plating: 99 } } }));
    expect(profile?.bioCredits).toBe(0);
    expect(profile?.workshop.plating).toBe(5);
  });
});
