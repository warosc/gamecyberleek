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
    expect(profile.schemaVersion).toBe(4);
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
    expect(profile.schemaVersion).toBe(4);
    expect(profile.runs).toBe(4);
    expect(profile.bioCredits).toBe(140);
    expect(profile.unlocks).toEqual(['sector-2']);
    expect(profile.weaponMastery.pulse).toBe(60);
    // The fields this run introduces default safely instead of failing the whole load.
    expect(profile.contractsCompleted).toBe(0);
    expect(profile.perfectContracts).toBe(0);
    // The migrated profile is persisted back under the current key.
    expect(JSON.parse(storage.getItem('leek-ops-profile-v4')!).schemaVersion).toBe(4);
  });

  it('ignores corrupt contract fields rather than failing the whole profile', async () => {
    storage.setItem(
      'leek-ops-profile-v4',
      JSON.stringify({ schemaVersion: 4, contractsCompleted: 'not-a-number', perfectContracts: -3 }),
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
