import type { SpecialAbilityId } from '../abilities/SpecialAbilities';

/**
 * Local playtest instrumentation.
 *
 * This exists to answer the questions in `docs/PLAYTEST_PLAN.md` from data instead of memory:
 * how long runs last, whether players ever reach a level-up, which upgrades they take, and
 * whether they press restart. It is deliberately not analytics: nothing leaves the device, no
 * identifier is generated, and no personal data is recorded. A facilitator reads it off the
 * machine the session ran on.
 */
export interface RunRecord {
  /** Wall-clock start, kept only so a facilitator can line runs up with their notes. */
  startedAt: string;
  durationMs: number;
  level: number;
  kills: number;
  damageDealt: number;
  damageTaken: number;
  shotsFired: number;
  hits: number;
  abilityUses: Record<SpecialAbilityId, number>;
  /** Upgrade ids in the order they were chosen. */
  upgrades: string[];
  weapon: string;
  bossReached: boolean;
  bossDefeated: boolean;
  outcome: 'death' | 'victory' | 'quit';
  /** Set later, when the player chooses to go again. The behavioural KPI for the alpha. */
  restarted: boolean;
}

const KEY = 'leek-ops-playtest-v1';
/** Bounded so a long session cannot grow local storage without limit. */
const MAX_RECORDS = 25;

function read(): RunRecord[] {
  try {
    const stored = localStorage.getItem(KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as RunRecord[]) : [];
  } catch {
    return [];
  }
}

/**
 * Persistence here is a convenience, exactly as in `ProfileStore`: `localStorage.setItem`
 * throws in Safari private browsing and over quota, and this runs on the death transition,
 * which is a path the player cannot avoid. An escaping error would kill the game loop.
 */
function write(records: RunRecord[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(records.slice(-MAX_RECORDS)));
  } catch {
    // Ignored on purpose: the session continues without a playtest history.
  }
}

export function loadRunHistory(): RunRecord[] {
  return read();
}

export function clearRunHistory() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Ignored on purpose.
  }
}

/** Marks the most recent run as having been followed by a restart. */
export function recordRestart() {
  const records = read();
  const last = records[records.length - 1];
  if (!last) return;
  last.restarted = true;
  write(records);
}

/**
 * Summary a facilitator can read at a glance between sessions. Restart rate is the alpha's
 * primary behavioural KPI, so it is computed here rather than eyeballed.
 */
export function summariseRuns(records: RunRecord[] = read()) {
  const runs = records.length;
  if (runs === 0)
    return { runs: 0, restartRate: 0, medianDurationMs: 0, reachedLevelUp: 0, bossReached: 0, bossDefeated: 0 };
  const durations = records.map((record) => record.durationMs).sort((a, b) => a - b);
  const middle = Math.floor(durations.length / 2);
  return {
    runs,
    restartRate: records.filter((record) => record.restarted).length / runs,
    medianDurationMs:
      durations.length % 2 === 1
        ? durations[middle]
        : Math.round((durations[middle - 1] + durations[middle]) / 2),
    // "Did they ever see the core reward loop?" is the single most important onboarding answer.
    reachedLevelUp: records.filter((record) => record.level > 1).length / runs,
    bossReached: records.filter((record) => record.bossReached).length / runs,
    bossDefeated: records.filter((record) => record.bossDefeated).length / runs,
  };
}

/** Accumulates one run. Created per run; `finish` appends it to the local history. */
export class RunTelemetry {
  private readonly record: RunRecord = {
    startedAt: new Date().toISOString(),
    durationMs: 0,
    level: 1,
    kills: 0,
    damageDealt: 0,
    damageTaken: 0,
    shotsFired: 0,
    hits: 0,
    abilityUses: { nova: 0, shield: 0, overdrive: 0 },
    upgrades: [],
    weapon: 'PULSEGUN-01',
    bossReached: false,
    bossDefeated: false,
    outcome: 'quit',
    restarted: false,
  };
  private finished = false;

  shotFired() {
    this.record.shotsFired++;
  }

  hitLanded() {
    this.record.hits++;
  }

  dealtDamage(amount: number) {
    this.record.damageDealt += Math.max(0, Math.round(amount));
  }

  tookDamage(amount: number) {
    this.record.damageTaken += Math.max(0, Math.round(amount));
  }

  killed() {
    this.record.kills++;
  }

  usedAbility(id: SpecialAbilityId) {
    this.record.abilityUses[id]++;
  }

  choseUpgrade(id: string) {
    this.record.upgrades.push(id);
  }

  equipped(weapon: string) {
    this.record.weapon = weapon;
  }

  bossSpawned() {
    this.record.bossReached = true;
  }

  bossKilled() {
    this.record.bossDefeated = true;
  }

  /** Appends the run. Guarded because victory and death can both race to end a run. */
  finish(durationMs: number, level: number, outcome: RunRecord['outcome']) {
    if (this.finished) return this.record;
    this.finished = true;
    this.record.durationMs = Math.round(durationMs);
    this.record.level = level;
    this.record.outcome = outcome;
    write([...read(), this.record]);
    return this.record;
  }

  get snapshot(): Readonly<RunRecord> {
    return this.record;
  }
}
