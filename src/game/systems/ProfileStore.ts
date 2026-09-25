import { UNLOCKS } from './UnlockRegistry';
import { EMPTY_WEAPON_MASTERY, masteryEarnedForRun, type WeaponMastery } from '../weapons/WeaponMastery';
import type { StarterWeaponId } from '../weapons/WeaponRegistry';
import { sectorRewardMultiplier } from '../config/ArenaDefinitions';
import {
  EMPTY_WORKSHOP, creditMultiplier, normalizeWorkshop, purchaseRank, type WorkshopRanks, type WorkshopUpgradeId,
} from '../progression/Workshop';
import { DEFAULT_SETTINGS, normalizeSettings, type GameSettings } from '../progression/Settings';
import {
  EMPTY_LIFETIME, MAX_RUN_HISTORY, NO_RUN_FACTS, newlyEarned, normalizeHistory, normalizeLifetime,
  type LifetimeStats, type RunFacts, type RunHistoryEntry,
} from '../progression/Achievements';
import { EMPTY_DAILY, normalizeDaily, recordDailyScore, type DailyRecord } from '../progression/DailyOperation';
import {
  generateCallsign, generateCode, normalizeCallsign, normalizeIdentity, type OperativeIdentity,
} from '../online/OperativeIdentity';

export interface PlayerProfile {
  schemaVersion: 5;
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
  workshop: WorkshopRanks;
  settings: GameSettings;
  lifetime: LifetimeStats;
  history: RunHistoryEntry[];
  achievements: string[];
  daily: DailyRecord;
  /** Online identity; absent until the player first uses an online feature. */
  operative?: OperativeIdentity;
}

const KEY = 'leek-ops-profile-v5';
const LEGACY_KEYS = ['leek-ops-profile-v4', 'leek-ops-profile-v3', 'leek-ops-profile-v2', 'leek-ops-profile-v1'] as const;

function freshProfile(): PlayerProfile {
  return {
    schemaVersion: 5,
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
    workshop: { ...EMPTY_WORKSHOP },
    settings: { ...DEFAULT_SETTINGS },
    lifetime: normalizeLifetime(EMPTY_LIFETIME),
    history: [],
    achievements: [],
    daily: { ...EMPTY_DAILY, scores: [] },
  };
}

/** Shape `saveRun` needs from a finished run's contracts; kept local so ProfileStore stays
 * decoupled from `ContractSystem` and is easy to unit test in isolation. */
export interface RunContractOutcome {
  creditsEarned: number;
  completedCount: number;
  perfect: boolean;
}

const NO_CONTRACTS: RunContractOutcome = { creditsEarned: 0, completedCount: 0, perfect: false };

/** A daily operation's identity and score, present only when the run was the daily. */
export interface DailyResult {
  date: string;
  score: number;
}

function validNonNegative(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

const idList = (value: unknown) => Array.isArray(value)
  ? [...new Set(value.filter((id): id is string => typeof id === 'string' && id.length < 64))]
  : [];

/**
 * Every field is validated on its own, so one corrupt value falls back to its default instead
 * of discarding the whole profile. Fields added by a later schema are simply absent on older
 * saves and take their defaults the same way; that is the whole migration.
 */
function normalizeProfile(value: unknown): PlayerProfile {
  const defaults = freshProfile();
  if (!value || typeof value !== 'object') return defaults;
  const raw = value as Partial<Record<keyof PlayerProfile, unknown>> & { weaponMastery?: Partial<WeaponMastery> };
  return {
    schemaVersion: 5,
    runs: Math.floor(validNonNegative(raw.runs, defaults.runs)),
    bestLevel: Math.max(1, Math.floor(validNonNegative(raw.bestLevel, defaults.bestLevel))),
    victories: Math.floor(validNonNegative(raw.victories, defaults.victories)),
    bioCredits: Math.floor(validNonNegative(raw.bioCredits, defaults.bioCredits)),
    vibration: typeof raw.vibration === 'boolean' ? raw.vibration : defaults.vibration,
    autoFire: typeof raw.autoFire === 'boolean' ? raw.autoFire : defaults.autoFire,
    unlocks: idList(raw.unlocks),
    weaponMastery: {
      pulse: Math.floor(validNonNegative(raw.weaponMastery?.pulse, 0)),
      spore: Math.floor(validNonNegative(raw.weaponMastery?.spore, 0)),
      arc: Math.floor(validNonNegative(raw.weaponMastery?.arc, 0)),
    },
    contractsCompleted: Math.floor(validNonNegative(raw.contractsCompleted, defaults.contractsCompleted)),
    perfectContracts: Math.floor(validNonNegative(raw.perfectContracts, defaults.perfectContracts)),
    workshop: normalizeWorkshop(raw.workshop),
    settings: normalizeSettings(raw.settings),
    lifetime: normalizeLifetime(raw.lifetime),
    history: normalizeHistory(raw.history),
    achievements: idList(raw.achievements),
    daily: normalizeDaily(raw.daily),
    operative: normalizeIdentity((raw as { operative?: unknown }).operative),
  };
}

export function loadProfile(): PlayerProfile {
  try {
    const stored = localStorage.getItem(KEY) ?? LEGACY_KEYS.map(key => localStorage.getItem(key)).find(Boolean) ?? '{}';
    const profile = normalizeProfile(JSON.parse(stored));
    if (!localStorage.getItem(KEY)) persist(profile);
    return profile;
  } catch {
    const recovered = freshProfile();
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

/** Credits for one run before achievement bonuses: sector risk and the salvage upgrade scale it. */
export function runCredits(level: number, victory: boolean, contractCredits: number, sector: number, workshop: WorkshopRanks) {
  const base = level * 5 + (victory ? 100 : 0) + contractCredits;
  return Math.round(base * sectorRewardMultiplier(sector) * creditMultiplier(workshop));
}

export function saveRun(
  level: number,
  victory: boolean,
  weaponId: StarterWeaponId = 'pulse',
  contracts: RunContractOutcome = NO_CONTRACTS,
  run: RunFacts = NO_RUN_FACTS,
  daily?: DailyResult,
) {
  const profile = loadProfile();
  profile.runs++;
  profile.bestLevel = Math.max(profile.bestLevel, level);
  profile.victories += Number(victory);
  profile.contractsCompleted += contracts.completedCount;
  if (contracts.perfect) profile.perfectContracts++;
  profile.weaponMastery[weaponId] += masteryEarnedForRun(level, victory);

  const credits = runCredits(level, victory, contracts.creditsEarned, run.sector, profile.workshop);
  const life = profile.lifetime;
  life.kills += run.kills;
  life.bossKills += Number(run.bossDefeated);
  life.playTimeMs += run.durationMs;
  life.damageDealt += run.damageDealt;
  life.shotsFired += run.shotsFired;
  life.hits += run.hits;
  if (victory) {
    life.victoriesByWeapon[weaponId]++;
    life.victoriesBySector[Math.min(Math.max(run.sector, 0), 2)]++;
    if (run.durationMs > 0 && (!life.fastestVictoryMs || run.durationMs < life.fastestVictoryMs))
      life.fastestVictoryMs = run.durationMs;
  }

  const earned = newlyEarned(profile.achievements, profile, { ...run, victory });
  const bonus = earned.reduce((sum, achievement) => sum + achievement.reward, 0);
  profile.achievements.push(...earned.map(achievement => achievement.id));
  profile.bioCredits += credits + bonus;
  life.creditsEarned += credits + bonus;

  profile.history = [...profile.history, {
    at: new Date().toISOString(), sector: run.sector, weaponId, level, victory,
    durationMs: run.durationMs, kills: run.kills, credits: credits + bonus,
  }].slice(-MAX_RUN_HISTORY);
  if (daily) profile.daily = recordDailyScore(profile.daily, daily.date, daily.score);

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

export function updateSettings(patch: Partial<GameSettings>) {
  const profile = loadProfile();
  profile.settings = normalizeSettings({ ...profile.settings, ...patch });
  persist(profile);
  return profile;
}

/** Buys the next workshop rank; `undefined` when unaffordable or maxed, and nothing is saved. */
export function purchaseWorkshopRank(id: WorkshopUpgradeId) {
  const profile = loadProfile();
  const result = purchaseRank(id, profile.workshop, profile.bioCredits);
  if (!result) return undefined;
  profile.bioCredits = result.credits;
  profile.workshop = result.ranks;
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

/** A portable copy of the save, for the player to keep or move to another device. */
export function exportProfileJson() {
  return JSON.stringify({ game: 'leek-ops', exportedAt: new Date().toISOString(), profile: loadProfile() }, null, 2);
}

/**
 * Restores a save exported by `exportProfileJson`. Every field is re-validated exactly as on
 * load, so a hand-edited or damaged file can at worst reset the fields it broke. Returns
 * `undefined`, and changes nothing, when the text is not a LEEK OPS save.
 */
export function importProfileJson(text: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== 'object') return undefined;
  const envelope = parsed as { game?: unknown; profile?: unknown };
  if (envelope.game !== 'leek-ops' || !envelope.profile || typeof envelope.profile !== 'object') return undefined;
  const profile = normalizeProfile(envelope.profile);
  persist(profile);
  return profile;
}

/** The operative identity, created and saved the first time something online needs it. */
export function ensureOperative(): OperativeIdentity {
  const profile = loadProfile();
  if (profile.operative) return profile.operative;
  profile.operative = { code: generateCode(), callsign: generateCallsign() };
  persist(profile);
  return profile.operative;
}

/** Returns the saved callsign, or undefined (and saves nothing) when it is not valid. */
export function renameOperative(input: string) {
  const callsign = normalizeCallsign(input);
  if (!callsign) return undefined;
  const profile = loadProfile();
  profile.operative = { ...(profile.operative ?? ensureOperative()), callsign };
  persist(profile);
  return callsign;
}

/**
 * Replaces the local save with one downloaded from the cloud, re-validating every field, and
 * adopts the code it was restored with so later uploads keep going to the same cloud slot.
 */
export function restoreCloudProfile(profile: unknown, code: string, callsign: string) {
  const restored = normalizeProfile(profile);
  restored.operative = normalizeIdentity({ code, callsign }) ?? restored.operative;
  persist(restored);
  return restored;
}
