import type { PlayerStats } from '../entities/player/PlayerStats';
import type { StarterWeaponId } from '../weapons/WeaponRegistry';

export interface DailyMutator {
  id: string;
  name: string;
  description: string;
  apply: (stats: PlayerStats) => void;
}

/** Player-side run rules. Enemy rules stay untouched so daily scores remain comparable. */
export const DAILY_MUTATORS: readonly DailyMutator[] = [
  { id: 'glass-cannon', name: 'CAÑÓN DE CRISTAL', description: '+40% daño  ·  −30% PV',
    apply: s => { s.attackDamage *= 1.4; s.maxHp = Math.round(s.maxHp * 0.7); } },
  { id: 'overclock', name: 'SOBRECARGA', description: '−20% recarga de arma y dash  ·  −15% PV',
    apply: s => { s.attackCooldown *= 0.8; s.dashCooldown *= 0.8; s.maxHp = Math.round(s.maxHp * 0.85); } },
  { id: 'harvest', name: 'COSECHA', description: '+30% XP  ·  +40 imán  ·  −10% daño',
    apply: s => { s.xpMultiplier += 0.3; s.magnetRadius += 40; s.attackDamage *= 0.9; } },
  { id: 'bulwark', name: 'BALUARTE', description: '+15% blindaje  ·  −10% velocidad',
    apply: s => { s.damageReduction = Math.min(0.75, s.damageReduction + 0.15); s.moveSpeed *= 0.9; } },
  { id: 'sprinter', name: 'VELOCISTA', description: '+20% velocidad  ·  −30% recarga de dash  ·  −10% daño',
    apply: s => { s.moveSpeed *= 1.2; s.dashCooldown *= 0.7; s.attackDamage *= 0.9; } },
];

export interface DailyOperation {
  /** Local calendar date, `YYYY-MM-DD`; the whole identity of the operation. */
  date: string;
  seed: number;
  sector: number;
  weaponId: StarterWeaponId;
  mutator: DailyMutator;
}

export function localDateKey(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** FNV-1a: small, stable across engines, and good enough to spread consecutive dates. */
export function hashSeed(text: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

const WEAPONS: readonly StarterWeaponId[] = ['pulse', 'spore', 'arc'];

export function dailyOperation(date = localDateKey()): DailyOperation {
  const seed = hashSeed(`leek-ops-daily:${date}`);
  return {
    date,
    seed,
    sector: seed % 3,
    weaponId: WEAPONS[(seed >>> 4) % WEAPONS.length],
    mutator: DAILY_MUTATORS[(seed >>> 8) % DAILY_MUTATORS.length],
  };
}

export function dailyMutator(id: string | undefined) {
  return DAILY_MUTATORS.find(mutator => mutator.id === id);
}

export interface ScoreFacts {
  kills: number;
  level: number;
  durationMs: number;
  victory: boolean;
}

/**
 * Kills and level reward aggression; survival time rewards staying alive; a victory adds a
 * large bonus that shrinks with the time it took, so a faster clear always outscores a slower one.
 */
export function operationScore({ kills, level, durationMs, victory }: ScoreFacts) {
  const seconds = Math.floor(Math.max(0, durationMs) / 1000);
  const base = kills * 10 + level * 150 + seconds * 4;
  return Math.max(0, Math.floor(base + (victory ? 3000 + Math.max(0, 480 - seconds) * 10 : 0)));
}

export interface DailyRecord {
  date: string;
  bestScore: number;
  attempts: number;
  /** Local top scores for the day, highest first. */
  scores: number[];
}

export const EMPTY_DAILY: DailyRecord = { date: '', bestScore: 0, attempts: 0, scores: [] };
export const DAILY_BOARD_SIZE = 5;

/** Records a daily score, resetting the board when the calendar day changes. */
export function recordDailyScore(record: Readonly<DailyRecord>, date: string, score: number): DailyRecord {
  const current = record.date === date ? record : { ...EMPTY_DAILY, date };
  const scores = [...current.scores, score].sort((a, b) => b - a).slice(0, DAILY_BOARD_SIZE);
  return { date, bestScore: Math.max(current.bestScore, score), attempts: current.attempts + 1, scores };
}

export function normalizeDaily(value: unknown): DailyRecord {
  const raw = (value && typeof value === 'object' ? value : {}) as Partial<Record<keyof DailyRecord, unknown>>;
  const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  return {
    date: typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : '',
    bestScore: count(raw.bestScore),
    attempts: count(raw.attempts),
    scores: Array.isArray(raw.scores) ? raw.scores.map(count).sort((a, b) => b - a).slice(0, DAILY_BOARD_SIZE) : [],
  };
}
