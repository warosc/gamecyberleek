import { UNLOCKS } from './UnlockRegistry';
import { EMPTY_WEAPON_MASTERY, masteryEarnedForRun, type WeaponMastery } from '../weapons/WeaponMastery';
import type { StarterWeaponId } from '../weapons/WeaponRegistry';

export interface PlayerProfile {
  schemaVersion: 4;
  runs: number;
  bestLevel: number;
  victories: number;
  bioCredits: number;
  vibration: boolean;
  autoFire: boolean;
  unlocks: string[];
  weaponMastery: WeaponMastery;
  /** Lifetime contract completions, tracked purely for future UI; never gates anything. */
  contractsCompleted: number;
  /** Runs where all three rolled contracts were completed. */
  perfectContracts: number;
}

const KEY = 'leek-ops-profile-v4';
const LEGACY_KEYS = ['leek-ops-profile-v3', 'leek-ops-profile-v2', 'leek-ops-profile-v1'] as const;
const defaults: PlayerProfile = {
  schemaVersion: 4,
  runs: 0,
  bestLevel: 1,
  victories: 0,
  bioCredits: 0,
  vibration: true,
  autoFire: false,
  unlocks: [],
  weaponMastery: { ...EMPTY_WEAPON_MASTERY },
  contractsCompleted: 0,
  perfectContracts: 0,
};

/** Shape `saveRun` needs from a finished run's contracts; kept local so ProfileStore stays
 * decoupled from `ContractSystem` and is easy to unit test in isolation. */
export interface RunContractOutcome {
  creditsEarned: number;
  completedCount: number;
  perfect: boolean;
}

const NO_CONTRACTS: RunContractOutcome = { creditsEarned: 0, completedCount: 0, perfect: false };

function validNonNegative(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function normalizeProfile(value: unknown): PlayerProfile {
  if (!value || typeof value !== 'object') return { ...defaults };
  const raw = value as Partial<PlayerProfile>;
  return {
    runs: Math.floor(validNonNegative(raw.runs, defaults.runs)),
    schemaVersion: 4,
    bestLevel: Math.max(1, Math.floor(validNonNegative(raw.bestLevel, defaults.bestLevel))),
    victories: Math.floor(validNonNegative(raw.victories, defaults.victories)),
    bioCredits: Math.floor(validNonNegative(raw.bioCredits, defaults.bioCredits)),
    vibration: typeof raw.vibration === 'boolean' ? raw.vibration : defaults.vibration,
    autoFire: typeof raw.autoFire === 'boolean' ? raw.autoFire : defaults.autoFire,
    unlocks: Array.isArray(raw.unlocks)
      ? [...new Set(raw.unlocks.filter((id): id is string => typeof id === 'string' && id.length < 64))]
      : defaults.unlocks,
    weaponMastery: {
      pulse: Math.floor(validNonNegative(raw.weaponMastery?.pulse, 0)),
      spore: Math.floor(validNonNegative(raw.weaponMastery?.spore, 0)),
      arc: Math.floor(validNonNegative(raw.weaponMastery?.arc, 0)),
    },
    // Absent on any profile saved before this schema version; defaults to zero rather than
    // failing the whole load.
    contractsCompleted: Math.floor(validNonNegative(raw.contractsCompleted, defaults.contractsCompleted)),
    perfectContracts: Math.floor(validNonNegative(raw.perfectContracts, defaults.perfectContracts)),
  };
}

export function loadProfile(): PlayerProfile {
  try {
    const stored = localStorage.getItem(KEY) ?? LEGACY_KEYS.map(key => localStorage.getItem(key)).find(Boolean) ?? '{}';
    const profile = normalizeProfile(JSON.parse(stored));
    if (!localStorage.getItem(KEY)) persist(profile);
    return profile;
  } catch {
    const recovered = { ...defaults, unlocks: [...defaults.unlocks] };
    persist(recovered);
    return recovered;
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

export function saveRun(
  level: number,
  victory: boolean,
  weaponId: StarterWeaponId = 'pulse',
  contracts: RunContractOutcome = NO_CONTRACTS,
) {
  const profile = loadProfile();
  profile.runs++;
  profile.bestLevel = Math.max(profile.bestLevel, level);
  profile.victories += Number(victory);
  profile.bioCredits += level * 5 + (victory ? 100 : 0) + contracts.creditsEarned;
  profile.contractsCompleted += contracts.completedCount;
  if (contracts.perfect) profile.perfectContracts++;
  profile.weaponMastery[weaponId] += masteryEarnedForRun(level, victory);
  for (const definition of UNLOCKS) {
    if (!profile.unlocks.includes(definition.id) && definition.requirement(profile))
      profile.unlocks.push(definition.id);
  }
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
