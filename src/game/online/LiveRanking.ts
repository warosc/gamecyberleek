import { xpForLevel } from '../systems/ExperienceSystem';

/** One player on the live daily board. */
export interface LiveEntry {
  id: string;
  callsign: string;
  score: number;
  self: boolean;
}

/** A joined live board: push your score and run time, hear everyone's, leave when the run ends. */
export interface LiveBoardSession {
  update(score: number, seconds: number): void;
  onChange(listener: (entries: LiveEntry[]) => void): void;
  leave(): Promise<void>;
}

interface PresencePayload { callsign?: unknown; score?: unknown; t?: unknown }

/**
 * Presence is not validated by the server: anyone holding the public key can join the channel and
 * claim any score. These ceilings come from the game's own rules, loosely, so the live board drops
 * the crude fakes without ever hiding a real run. They are not a security boundary; the persisted
 * daily board is scored and checked on the server.
 */
export const LIVE_MAX_SECONDS = 3600;
/** The regular spawner adds at most one enemy per 0.7 s; splits and summons fit in the margin. */
const KILLS_BASE = 40;
const KILLS_PER_SECOND = 3;
/** Elite bulwark (32 x 3) is the richest regular kill; multipliers from gear, mutator and momentum. */
const XP_PER_KILL = 96;
const XP_BOSSES = 180 + 500;
const XP_MULTIPLIER = 3;
/** Run time may run ahead of the viewer's clock by this much (join latency, throttled updates). */
const CLOCK_SLACK_SECONDS = 10;

function levelForXp(xp: number) {
  let level = 1;
  let left = xp;
  while (left >= xpForLevel(level) && level < 80) left -= xpForLevel(level++);
  return level;
}

/** The highest live score (operationScore without victory) a real run can show at `seconds`. */
export function liveScoreCeiling(seconds: number) {
  const secs = Math.max(0, Math.floor(seconds));
  const kills = KILLS_BASE + KILLS_PER_SECOND * secs;
  const level = levelForXp((kills * XP_PER_KILL + XP_BOSSES) * XP_MULTIPLIER);
  return kills * 10 + level * 150 + secs * 4;
}

/**
 * Remembers when each presence key was first seen, so a claimed run time cannot advance faster
 * than real time. Without it a fake could simply claim an hour of play to lift its ceiling.
 */
export class PresenceClock {
  private readonly firstSeen = new Map<string, { seconds: number; at: number }>();

  accepts(id: string, seconds: number, now = Date.now()) {
    const first = this.firstSeen.get(id);
    if (!first) {
      this.firstSeen.set(id, { seconds, at: now });
      return true;
    }
    return seconds <= first.seconds + (now - first.at) / 1000 + CLOCK_SLACK_SECONDS;
  }
}

/**
 * Turns a presence state (key -> list of payloads, one per open tab) into a ranking. Each key
 * counts once with its best score. Malformed payloads, and scores no real run could have at the
 * claimed run time, are skipped; the player's own entry is always trusted.
 */
export function rankLive(
  state: Record<string, PresencePayload[]>, selfId: string, clock = new PresenceClock(), now = Date.now(),
): LiveEntry[] {
  const entries: LiveEntry[] = [];
  for (const [id, payloads] of Object.entries(state)) {
    const self = id === selfId;
    let best: { callsign: string; score: number } | undefined;
    for (const payload of payloads) {
      const callsign = typeof payload.callsign === 'string' ? payload.callsign.slice(0, 16) : '';
      const score = typeof payload.score === 'number' && Number.isFinite(payload.score) ? Math.max(0, Math.floor(payload.score)) : NaN;
      if (!callsign || Number.isNaN(score)) continue;
      if (!self) {
        const seconds = typeof payload.t === 'number' && Number.isFinite(payload.t) ? payload.t : NaN;
        if (!(seconds >= 0 && seconds <= LIVE_MAX_SECONDS)) continue;
        if (!clock.accepts(id, seconds, now) || score > liveScoreCeiling(seconds)) continue;
      }
      if (!best || score > best.score) best = { callsign, score };
    }
    if (best) entries.push({ id, ...best, self });
  }
  return entries.sort((a, b) => b.score - a.score || Number(b.self) - Number(a.self) || a.callsign.localeCompare(b.callsign));
}

/** Players who were at or below you and are now strictly above you. */
export function overtakes(previous: readonly LiveEntry[], next: readonly LiveEntry[]) {
  const selfBefore = previous.find(entry => entry.self);
  const selfNow = next.find(entry => entry.self);
  if (!selfBefore || !selfNow) return [];
  const wasAhead = new Set(previous.filter(entry => !entry.self && entry.score > selfBefore.score).map(entry => entry.id));
  const known = new Set(previous.map(entry => entry.id));
  return next.filter(entry => !entry.self && known.has(entry.id) && !wasAhead.has(entry.id) && entry.score > selfNow.score);
}
