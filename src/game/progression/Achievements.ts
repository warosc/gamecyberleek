import type { StarterWeaponId } from '../weapons/WeaponRegistry';
import { masteryRank } from '../weapons/WeaponMastery';

/** What a finished run reports to persistent progression. All fields are gameplay facts. */
export interface RunFacts {
  sector: number;
  durationMs: number;
  kills: number;
  damageDealt: number;
  damageTaken: number;
  shotsFired: number;
  hits: number;
  bossDefeated: boolean;
}

export const NO_RUN_FACTS: RunFacts = {
  sector: 0, durationMs: 0, kills: 0, damageDealt: 0, damageTaken: 0, shotsFired: 0, hits: 0, bossDefeated: false,
};

export interface LifetimeStats {
  kills: number;
  bossKills: number;
  playTimeMs: number;
  damageDealt: number;
  shotsFired: number;
  hits: number;
  creditsEarned: number;
  /** Fastest victory; 0 until the first one. */
  fastestVictoryMs: number;
  victoriesByWeapon: Record<StarterWeaponId, number>;
  victoriesBySector: [number, number, number];
}

export const EMPTY_LIFETIME: LifetimeStats = {
  kills: 0, bossKills: 0, playTimeMs: 0, damageDealt: 0, shotsFired: 0, hits: 0, creditsEarned: 0,
  fastestVictoryMs: 0, victoriesByWeapon: { pulse: 0, spore: 0, arc: 0 }, victoriesBySector: [0, 0, 0],
};

export interface RunHistoryEntry {
  at: string;
  sector: number;
  weaponId: StarterWeaponId;
  level: number;
  victory: boolean;
  durationMs: number;
  kills: number;
  credits: number;
}

export const MAX_RUN_HISTORY = 12;

/** The slice of the profile achievements are allowed to read. */
export interface AchievementContext {
  runs: number;
  victories: number;
  perfectContracts: number;
  weaponMastery: Record<StarterWeaponId, number>;
  lifetime: LifetimeStats;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  /** One-time bio-credit bonus paid when the achievement is earned. */
  reward: number;
  earned: (profile: AchievementContext, run: RunFacts & { victory: boolean }) => boolean;
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'first-harvest', name: 'PRIMERA COSECHA', description: 'Gana una operación', reward: 50,
    earned: p => p.victories >= 1 },
  { id: 'exterminator', name: 'EXTERMINADOR', description: '250 eliminaciones en una operación', reward: 60,
    earned: (_p, run) => run.kills >= 250 },
  { id: 'untouchable', name: 'INTOCABLE', description: 'Gana recibiendo menos de 60 de daño', reward: 120,
    earned: (_p, run) => run.victory && run.damageTaken < 60 },
  { id: 'marksman', name: 'FRANCOTIRADOR', description: '70% de precisión con 150+ disparos', reward: 70,
    earned: (_p, run) => run.shotsFired >= 150 && run.hits / run.shotsFired >= 0.7 },
  { id: 'cryo-breaker', name: 'ROMPEHIELOS', description: 'Gana en el Sector 3', reward: 150,
    earned: p => p.lifetime.victoriesBySector[2] >= 1 },
  { id: 'full-arsenal', name: 'ARSENAL COMPLETO', description: 'Gana con las tres armas iniciales', reward: 200,
    earned: p => Object.values(p.lifetime.victoriesByWeapon).every(count => count >= 1) },
  { id: 'contractor', name: 'CONTRATISTA', description: 'Completa los tres contratos de una operación', reward: 80,
    earned: p => p.perfectContracts >= 1 },
  { id: 'master', name: 'MAESTRO ARMERO', description: 'Maestría 3 con cualquier arma', reward: 100,
    earned: p => Object.values(p.weaponMastery).some(points => masteryRank(points) >= 3) },
  { id: 'veteran', name: 'VETERANO', description: 'Completa 25 operaciones', reward: 100,
    earned: p => p.runs >= 25 },
  { id: 'harvester', name: 'COSECHADOR', description: '5.000 eliminaciones en total', reward: 150,
    earned: p => p.lifetime.kills >= 5000 },
];

/** Returns the achievements newly earned by this run, in registry order. */
export function newlyEarned(owned: readonly string[], profile: AchievementContext, run: RunFacts & { victory: boolean }) {
  return ACHIEVEMENTS.filter(achievement => !owned.includes(achievement.id) && achievement.earned(profile, run));
}

function count(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

export function normalizeLifetime(value: unknown): LifetimeStats {
  const raw = (value && typeof value === 'object' ? value : {}) as Partial<Record<keyof LifetimeStats, unknown>>;
  const byWeapon = (raw.victoriesByWeapon ?? {}) as Partial<Record<StarterWeaponId, unknown>>;
  const bySector = Array.isArray(raw.victoriesBySector) ? raw.victoriesBySector : [];
  return {
    kills: count(raw.kills), bossKills: count(raw.bossKills), playTimeMs: count(raw.playTimeMs),
    damageDealt: count(raw.damageDealt), shotsFired: count(raw.shotsFired), hits: count(raw.hits),
    creditsEarned: count(raw.creditsEarned), fastestVictoryMs: count(raw.fastestVictoryMs),
    victoriesByWeapon: { pulse: count(byWeapon.pulse), spore: count(byWeapon.spore), arc: count(byWeapon.arc) },
    victoriesBySector: [count(bySector[0]), count(bySector[1]), count(bySector[2])],
  };
}

export function normalizeHistory(value: unknown): RunHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is RunHistoryEntry =>
    Boolean(entry) && typeof entry === 'object' && typeof entry.at === 'string' &&
    ['pulse', 'spore', 'arc'].includes(entry.weaponId) && typeof entry.victory === 'boolean')
    .map(entry => ({
      at: entry.at, sector: count(entry.sector), weaponId: entry.weaponId, level: count(entry.level),
      victory: entry.victory, durationMs: count(entry.durationMs), kills: count(entry.kills), credits: count(entry.credits),
    }))
    .slice(-MAX_RUN_HISTORY);
}
