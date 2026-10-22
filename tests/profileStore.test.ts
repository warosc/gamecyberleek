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

  it('pays threat levels on top of the sector and records the clear', async () => {
    const { runCredits, saveRun, loadProfile } = await import('../src/game/systems/ProfileStore');
    const { EMPTY_WORKSHOP } = await import('../src/game/progression/Workshop');
    // 14*5 + 100 + 110 contracts = 280; x1.5 sector 3 = 420; x1.75 at AMENAZA III = 735.
    expect(runCredits(14, true, 110, 2, EMPTY_WORKSHOP)).toBe(420);
    expect(runCredits(14, true, 110, 2, EMPTY_WORKSHOP, 3)).toBe(735);
    expect(runCredits(14, true, 110, 2, { ...EMPTY_WORKSHOP, salvage: 3 }, 5)).toBe(1229);
    const run = { sector: 0, durationMs: 300_000, kills: 10, damageDealt: 0, damageTaken: 500, shotsFired: 0, hits: 0, bossDefeated: true };
    expect(loadProfile().threatCleared).toEqual([-1, -1, -1]);
    // A threat not yet open is paid and recorded as the highest open one (normal, here).
    const first = saveRun(10, true, 'pulse', undefined, run, undefined, { threat: 3 });
    expect(first.threatCleared).toEqual([0, -1, -1]);
    const second = saveRun(10, true, 'pulse', undefined, run, undefined, { threat: 1 });
    // 150 x1.25 at AMENAZA I.
    expect(second.bioCredits - first.bioCredits).toBe(188);
    expect(second.threatCleared).toEqual([1, -1, -1]);
    // A defeat clears nothing.
    expect(saveRun(10, false, 'pulse', undefined, run, undefined, { threat: 2 }).threatCleared).toEqual([1, -1, -1]);
  });

  it('opens AMENAZA I in sectors an older save already won', async () => {
    storage.setItem('leek-ops-profile-v5', JSON.stringify({ victories: 2, lifetime: { victoriesBySector: [1, 0, 1] } }));
    const { loadProfile } = await import('../src/game/systems/ProfileStore');
    expect(loadProfile().threatCleared).toEqual([0, -1, 0]);
    expect(loadProfile().daily).toMatchObject({ streak: 0, lastPlayedDate: '' });
  });

  it('pays the daily bonus once per day, grows it with the streak and keeps the daily at the normal threat', async () => {
    const { saveRun, loadProfile } = await import('../src/game/systems/ProfileStore');
    const run = { sector: 0, durationMs: 60_000, kills: 0, damageDealt: 0, damageTaken: 500, shotsFired: 0, hits: 0, bossDefeated: false };
    // Level 2 defeat: 10 credits + 100 bonus on day one.
    const day1 = saveRun(2, false, 'pulse', undefined, run, { date: '2026-10-20', score: 300 });
    expect(day1.bioCredits).toBe(110);
    expect(day1.daily).toMatchObject({ streak: 1, lastPlayedDate: '2026-10-20', attempts: 1 });
    expect(day1.history.at(-1)?.credits).toBe(110);
    const retry = saveRun(2, false, 'pulse', undefined, run, { date: '2026-10-20', score: 500 });
    expect(retry.bioCredits - day1.bioCredits).toBe(10);
    expect(retry.daily).toMatchObject({ streak: 1, attempts: 2, bestScore: 500 });
    const day2 = saveRun(2, false, 'pulse', undefined, run, { date: '2026-10-21', score: 100 }, { threat: 4 });
    expect(day2.bioCredits - retry.bioCredits).toBe(10 + 120);
    expect(loadProfile().daily).toMatchObject({ date: '2026-10-21', streak: 2, attempts: 1 });
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

describe('damaged save recovery', () => {
  const corruptKeys = () => [...Array(storage.length).keys()]
    .map(index => storage.key(index)!)
    .filter(key => key.startsWith('leek-ops-profile-v5-corrupt-'));

  it('keeps the unparseable text aside and recovers the previous good write', async () => {
    const { saveRun } = await import('../src/game/systems/ProfileStore');
    saveRun(4, false);
    saveRun(6, false);
    // The rotation keeps the save as it was before the latest write.
    expect(JSON.parse(storage.getItem('leek-ops-profile-v5-prev')!).runs).toBe(1);
    storage.setItem('leek-ops-profile-v5', '{"runs": 2, "bioCr');
    vi.resetModules();
    const { loadProfile } = await import('../src/game/systems/ProfileStore');
    expect(loadProfile()).toMatchObject({ runs: 1, bestLevel: 4 });
    const copies = corruptKeys();
    expect(copies).toHaveLength(1);
    expect(storage.getItem(copies[0])).toBe('{"runs": 2, "bioCr');
    expect(JSON.parse(storage.getItem('leek-ops-profile-v5')!).runs).toBe(1);
    // The good previous copy was not replaced by the damaged text.
    expect(JSON.parse(storage.getItem('leek-ops-profile-v5-prev')!).runs).toBe(1);
  });

  it('falls back to the newest readable legacy key when there is no previous copy', async () => {
    storage.setItem('leek-ops-profile-v5', 'garbage');
    storage.setItem('leek-ops-profile-v4', '{not json');
    storage.setItem('leek-ops-profile-v3', JSON.stringify({ runs: 7, bioCredits: 90 }));
    const { loadProfile } = await import('../src/game/systems/ProfileStore');
    expect(loadProfile()).toMatchObject({ runs: 7, bioCredits: 90 });
    expect(corruptKeys()).toHaveLength(1);
  });

  it('keeps at most two corrupt copies', async () => {
    let now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now++);
    const { loadProfile } = await import('../src/game/systems/ProfileStore');
    for (const text of ['bad-1', 'bad-2', 'bad-3']) {
      storage.setItem('leek-ops-profile-v5', text);
      loadProfile();
    }
    vi.restoreAllMocks();
    expect(corruptKeys().map(key => storage.getItem(key)).sort()).toEqual(['bad-2', 'bad-3']);
  });
});

/** Storage that can be switched into the state of a full quota or Safari private mode. */
class FailingStorage extends MemoryStorage {
  failWrites = false;
  setItem(key: string, value: string) {
    if (this.failWrites) throw new DOMException('quota', 'QuotaExceededError');
    super.setItem(key, value);
  }
}

describe('storage write failures', () => {
  let failing: FailingStorage;
  beforeEach(() => {
    failing = new FailingStorage();
    vi.stubGlobal('localStorage', failing);
  });

  it('keeps progress in memory across saves and reports storage as unhealthy', async () => {
    const { saveRun, loadProfile, storageHealthy } = await import('../src/game/systems/ProfileStore');
    expect(storageHealthy()).toBe(true);
    failing.failWrites = true;
    saveRun(2, false);
    const second = saveRun(3, false);
    expect(second.runs).toBe(2);
    expect(second.bioCredits).toBe(10 + 15);
    expect(loadProfile().runs).toBe(2);
    expect(storageHealthy()).toBe(false);
    // Once writes work again the next save lands in storage with everything kept in memory.
    failing.failWrites = false;
    saveRun(1, false);
    expect(storageHealthy()).toBe(true);
    expect(JSON.parse(failing.getItem('leek-ops-profile-v5')!).runs).toBe(3);
  });

  it('never overwrites a damaged save it could not copy aside', async () => {
    failing.setItem('leek-ops-profile-v5', 'half-written');
    failing.failWrites = true;
    const { loadProfile, saveRun, storageHealthy } = await import('../src/game/systems/ProfileStore');
    expect(loadProfile().runs).toBe(0);
    expect(saveRun(5, false).runs).toBe(1);
    expect(storageHealthy()).toBe(false);
    expect(failing.getItem('leek-ops-profile-v5')).toBe('half-written');
  });

  it('survives storage that throws on every access', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
    });
    const { saveRun, storageHealthy } = await import('../src/game/systems/ProfileStore');
    saveRun(2, false);
    expect(saveRun(2, false).runs).toBe(2);
    expect(storageHealthy()).toBe(false);
  });
});

describe('import safety', () => {
  const exported = (profile: object) => JSON.stringify({ game: 'leek-ops', profile });

  it('rejects oversized files before parsing and changes nothing', async () => {
    const { importProfileJson, loadProfile, saveRun, MAX_IMPORT_BYTES } = await import('../src/game/systems/ProfileStore');
    saveRun(3, false);
    const padded = exported({ runs: 50, padding: 'x'.repeat(MAX_IMPORT_BYTES) });
    expect(importProfileJson(padded)).toBeUndefined();
    expect(loadProfile().runs).toBe(1);
  });

  it('keeps the local operative identity over the one in the file', async () => {
    const { ensureOperative, importProfileJson, loadProfile } = await import('../src/game/systems/ProfileStore');
    const local = ensureOperative();
    const { generateCode } = await import('../src/game/online/OperativeIdentity');
    const restored = importProfileJson(exported({ runs: 8, operative: { code: generateCode(), callsign: 'OTHER' } }));
    expect(restored?.operative).toEqual(local);
    expect(loadProfile()).toMatchObject({ runs: 8, operative: local });
  });

  it('keeps the local operative when the file has none', async () => {
    const { ensureOperative, importProfileJson } = await import('../src/game/systems/ProfileStore');
    const local = ensureOperative();
    expect(importProfileJson(exported({ runs: 2 }))?.operative).toEqual(local);
  });

  it('adopts the file operative on a device that never went online', async () => {
    const { importProfileJson } = await import('../src/game/systems/ProfileStore');
    const { generateCode } = await import('../src/game/online/OperativeIdentity');
    const operative = { code: generateCode(), callsign: 'MOVER' };
    expect(importProfileJson(exported({ operative }))?.operative).toEqual(operative);
  });

  it('caps id lists so a crafted file cannot store megabytes', async () => {
    const { importProfileJson } = await import('../src/game/systems/ProfileStore');
    const ids = Array.from({ length: 5000 }, (_, index) => `id-${index}`);
    const profile = importProfileJson(exported({ unlocks: ids, achievements: ids }));
    expect(profile?.unlocks.length).toBeLessThanOrEqual(64);
    expect(profile?.achievements.length).toBeLessThanOrEqual(64);
  });
});
