import { MAX_THREAT, clampThreat } from '../config/EnemyScaling';
import { t } from '../i18n';

/**
 * Threat levels (AMENAZA I–V): the endgame after the first wins. Each sector climbs on its own,
 * one level per victory at the current top, so the ladder is 15 clears long instead of the three
 * that used to exhaust the run's reasons to play. Enemy health lives in EnemyScaling; this file
 * owns what the profile stores and what a level pays.
 */

/** +0.25 to the reward multiplier per level: ×2.25 at AMENAZA V, on top of the sector's own. */
export const THREAT_REWARD_STEP = 0.25;
export const SECTOR_COUNT = 3;

/** Highest threat cleared per sector; −1 until the sector is first won. */
export type ThreatRecord = [number, number, number];

export const NO_THREAT_CLEARED: ThreatRecord = [-1, -1, -1];

export function threatRewardMultiplier(threat: number) {
  return 1 + THREAT_REWARD_STEP * clampThreat(threat);
}

function sectorSlot(sector: number) {
  return Math.min(Math.max(Math.floor(sector) || 0, 0), SECTOR_COUNT - 1);
}

/** The highest threat the player may pick in `sector`: one above the best cleared, capped at V. */
export function availableThreat(cleared: Readonly<ThreatRecord>, sector: number) {
  return Math.min(MAX_THREAT, cleared[sectorSlot(sector)] + 1);
}

/** A requested threat, lowered to what the sector has unlocked: scene data is not trusted. */
export function allowedThreat(cleared: Readonly<ThreatRecord>, sector: number, threat: number) {
  return Math.min(clampThreat(threat), availableThreat(cleared, sector));
}

/** Records a victory at `threat`; only raises, so replaying a lower level never loses a clear. */
export function recordThreatClear(cleared: Readonly<ThreatRecord>, sector: number, threat: number): ThreatRecord {
  const next: ThreatRecord = [...cleared];
  const slot = sectorSlot(sector);
  next[slot] = Math.max(next[slot], allowedThreat(cleared, sector, threat));
  return next;
}

/**
 * Validates each slot on its own. Saves from before threat levels have no record, so a sector
 * the player already won counts as cleared at the normal level: AMENAZA I is open there at once.
 */
export function normalizeThreatCleared(value: unknown, victoriesBySector: readonly number[]): ThreatRecord {
  const raw = Array.isArray(value) ? value : [];
  return NO_THREAT_CLEARED.map((_, index) => {
    const level = raw[index];
    if (typeof level === 'number' && Number.isFinite(level)) return Math.min(Math.max(Math.floor(level), -1), MAX_THREAT);
    return (victoriesBySector[index] ?? 0) > 0 ? 0 : -1;
  }) as ThreatRecord;
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'] as const;

/** I–V for the labels; threat 0 has no numeral and is shown as the normal operation. */
export function threatNumeral(threat: number) {
  return ROMAN[clampThreat(threat)];
}

/** AMENAZA NORMAL / AMENAZA I … V in the player's language. */
export function threatLabel(threat: number) {
  const level = clampThreat(threat);
  return level === 0 ? t('threat.normal') : t('threat.level', { level: threatNumeral(level) });
}
