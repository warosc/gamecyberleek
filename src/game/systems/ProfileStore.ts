export interface PlayerProfile {
  schemaVersion: 2;
  runs: number;
  bestLevel: number;
  victories: number;
  bioCredits: number;
  vibration: boolean;
  autoFire: boolean;
  unlocks: string[];
}

const KEY = 'leek-ops-profile-v2';
const LEGACY_KEY = 'leek-ops-profile-v1';
const defaults: PlayerProfile = {
  schemaVersion: 2,
  runs: 0,
  bestLevel: 1,
  victories: 0,
  bioCredits: 0,
  vibration: true,
  autoFire: false,
  unlocks: [],
};

function validNonNegative(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function normalizeProfile(value: unknown): PlayerProfile {
  if (!value || typeof value !== 'object') return { ...defaults };
  const raw = value as Partial<PlayerProfile>;
  return {
    runs: Math.floor(validNonNegative(raw.runs, defaults.runs)),
    schemaVersion: 2,
    bestLevel: Math.max(1, Math.floor(validNonNegative(raw.bestLevel, defaults.bestLevel))),
    victories: Math.floor(validNonNegative(raw.victories, defaults.victories)),
    bioCredits: Math.floor(validNonNegative(raw.bioCredits, defaults.bioCredits)),
    vibration: typeof raw.vibration === 'boolean' ? raw.vibration : defaults.vibration,
    autoFire: typeof raw.autoFire === 'boolean' ? raw.autoFire : defaults.autoFire,
    unlocks: Array.isArray(raw.unlocks)
      ? [...new Set(raw.unlocks.filter((id): id is string => typeof id === 'string' && id.length < 64))]
      : defaults.unlocks,
  };
}

export function loadProfile(): PlayerProfile {
  try {
    const stored = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY) ?? '{}';
    const profile = normalizeProfile(JSON.parse(stored));
    if (!localStorage.getItem(KEY)) persist(profile);
    return profile;
  } catch {
    return { ...defaults };
  }
}

/**
 * Safari in private browsing throws on setItem, as does any browser over quota. Persistence is
 * a convenience here: losing it must never interrupt a run. `saveRun` is called from the death
 * transition and `updateProfile` from a mobile HUD tap, so an escaping error would kill the
 * game loop on exactly the paths a player cannot avoid.
 */
function persist(profile: PlayerProfile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // Ignored on purpose: the run continues with an in-memory profile.
  }
}

export function saveRun(level: number, victory: boolean) {
  const profile = loadProfile();
  profile.runs++;
  profile.bestLevel = Math.max(profile.bestLevel, level);
  profile.victories += Number(victory);
  profile.bioCredits += level * 5 + (victory ? 100 : 0);
  persist(profile);
  return profile;
}

export function updateProfile(patch: Partial<PlayerProfile>) {
  const profile = { ...loadProfile(), ...patch };
  persist(profile);
  return profile;
}

export function unlock(id: string) {
  const profile = loadProfile();
  if (!profile.unlocks.includes(id)) profile.unlocks.push(id);
  persist(profile);
  return profile;
}

export function isUnlocked(id: string) {
  return loadProfile().unlocks.includes(id);
}
