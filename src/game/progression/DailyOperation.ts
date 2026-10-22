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
  /** Consecutive days with a finished daily, counting `lastPlayedDate`; 0 before the first one. */
  streak: number;
  /**
   * The newest operation date whose bonus was paid. Kept apart from `date`, which follows the
   * board: a results-screen retry of yesterday's daily after midnight moves the board back a day,
   * and must not make today's next run look unpaid.
   */
  lastPlayedDate: string;
}

export const EMPTY_DAILY: DailyRecord = { date: '', bestScore: 0, attempts: 0, scores: [], streak: 0, lastPlayedDate: '' };
export const DAILY_BOARD_SIZE = 5;

/**
 * The first finished daily of each day pays a flat bonus on top of the run's own credits, so the
 * daily is worth a visit even on a bad run. Flat on purpose: sector, threat and salvage already
 * scale the run's credits, and a bonus that grew with them would make the daily another farm.
 */
export const DAILY_BONUS_CREDITS = 100;
/** A daily victory pays the bonus ×1.5. */
export const DAILY_VICTORY_FACTOR = 1.5;
/** +20 % per consecutive day after the first… */
export const DAILY_STREAK_STEP = 0.2;
/** …up to a week, ×2.2: a missed day costs something, but a long streak cannot snowball. */
export const DAILY_STREAK_CAP = 7;

/** Records a daily score, resetting the board (not the streak) when the calendar day changes. */
export function recordDailyScore(record: Readonly<DailyRecord>, date: string, score: number): DailyRecord {
  const current = record.date === date ? record : { ...record, date, bestScore: 0, attempts: 0, scores: [] };
  const scores = [...current.scores, score].sort((a, b) => b - a).slice(0, DAILY_BOARD_SIZE);
  return { ...current, date, bestScore: Math.max(current.bestScore, score), attempts: current.attempts + 1, scores };
}

/** The calendar day before a `YYYY-MM-DD` key. Done in UTC so a DST change cannot skip or repeat a day. */
export function previousDateKey(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  const before = new Date(Date.UTC(year, month - 1, day - 1));
  return `${before.getUTCFullYear()}-${String(before.getUTCMonth() + 1).padStart(2, '0')}-${String(before.getUTCDate()).padStart(2, '0')}`;
}

/** Bonus credits for a paid daily at `streak` days. 100 / 150 on day one, 220 / 330 from day seven. */
export function dailyBonus(streak: number, victory: boolean) {
  const days = Math.min(Math.max(Math.floor(streak) || 1, 1), DAILY_STREAK_CAP);
  return Math.round(DAILY_BONUS_CREDITS * (1 + DAILY_STREAK_STEP * (days - 1)) * (victory ? DAILY_VICTORY_FACTOR : 1));
}

/**
 * The streak as of `today`: still counting when the last paid daily was today or yesterday,
 * otherwise broken. `claimed` says whether today's bonus is already paid.
 */
export function streakStatus(record: Readonly<DailyRecord>, today: string) {
  const claimed = record.lastPlayedDate === today;
  const alive = claimed || record.lastPlayedDate === previousDateKey(today);
  const streak = alive ? record.streak : 0;
  // What the next paid daily would count: today's run extends a live streak or starts a new one.
  const next = claimed ? streak : streak + 1;
  return { streak, claimed, next };
}

/**
 * Pays the daily bonus for a finished run of the operation dated `date`, once per date. Attempts
 * stay unlimited (the board keeps the best score); only the first one of each day pays. A date
 * not newer than the last paid one never pays, so replaying an old daily cannot re-earn it.
 */
export function claimDailyBonus(record: Readonly<DailyRecord>, date: string, victory: boolean) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date <= record.lastPlayedDate)
    return { bonus: 0, streak: record.streak, record: { ...record } };
  const streak = record.lastPlayedDate === previousDateKey(date) ? record.streak + 1 : 1;
  return { bonus: dailyBonus(streak, victory), streak, record: { ...record, streak, lastPlayedDate: date } };
}

export function normalizeDaily(value: unknown): DailyRecord {
  const raw = (value && typeof value === 'object' ? value : {}) as Partial<Record<keyof DailyRecord, unknown>>;
  const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  const dateKey = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
  const lastPlayedDate = dateKey(raw.lastPlayedDate);
  return {
    date: dateKey(raw.date),
    bestScore: count(raw.bestScore),
    attempts: count(raw.attempts),
    scores: Array.isArray(raw.scores) ? raw.scores.map(count).sort((a, b) => b - a).slice(0, DAILY_BOARD_SIZE) : [],
    // Saves from before the streak have neither field and start at 0 with no paid date. A streak
    // without a date could never be extended, so it is dropped rather than shown.
    streak: lastPlayedDate ? Math.min(count(raw.streak), 9999) : 0,
    lastPlayedDate,
  };
}
