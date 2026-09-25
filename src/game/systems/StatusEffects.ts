export type StatusKind = 'burn' | 'chill' | 'toxin';

/** Carried on a damage packet; the target decides how it stacks. */
export interface StatusPayload {
  kind: StatusKind;
  /** Burn/toxin: damage per tick. Chill: ignored. */
  potency: number;
  durationMs: number;
}

export const STATUS_TICK_MS = 500;
/** Chill slows by this fraction; it refreshes rather than stacks so it can never freeze a boss. */
export const CHILL_SLOW = 0.35;
/** Toxin stacks increase tick damage up to this many applications. */
export const TOXIN_MAX_STACKS = 5;
/** Bosses and minibosses take reduced status effects so a build cannot trivialise the finale. */
export const BOSS_STATUS_SCALE = 0.4;

export const STATUS_COLORS: Record<StatusKind, number> = { burn: 0xff8a3d, chill: 0x8fd8ff, toxin: 0x9dff4f };

interface ActiveStatus {
  until: number;
  potency: number;
  stacks: number;
  nextTick: number;
}

/**
 * Per-enemy status state on gameplay time. Pure: it reports tick damage and speed, and the
 * owning scene routes that damage through the normal death resolution.
 */
export class StatusEffects {
  private readonly active = new Map<StatusKind, ActiveStatus>();

  constructor(private readonly resilient = false) {}

  apply(payload: StatusPayload, now: number) {
    const scale = this.resilient ? BOSS_STATUS_SCALE : 1;
    const duration = payload.durationMs * scale;
    const current = this.active.get(payload.kind);
    if (payload.kind === 'toxin' && current && current.until > now) {
      current.stacks = Math.min(TOXIN_MAX_STACKS, current.stacks + 1);
      current.until = now + duration;
      current.potency = Math.max(current.potency, payload.potency * scale);
      return;
    }
    // Burn and chill refresh to the strongest application instead of stacking.
    this.active.set(payload.kind, {
      until: Math.max(current?.until ?? 0, now + duration),
      potency: Math.max(current && current.until > now ? current.potency : 0, payload.potency * scale),
      stacks: 1,
      nextTick: current && current.until > now ? current.nextTick : now + STATUS_TICK_MS,
    });
  }

  has(kind: StatusKind, now: number) {
    const status = this.active.get(kind);
    return Boolean(status && status.until > now);
  }

  /** Movement multiplier from chill; 1 when unaffected. */
  speedFactor(now: number) {
    return this.has('chill', now) ? 1 - CHILL_SLOW * (this.resilient ? BOSS_STATUS_SCALE : 1) : 1;
  }

  /**
   * Advances damage-over-time to `now` and returns the damage due, rounded. Ticks that fell
   * inside a pause are not replayed because gameplay time does not advance while paused.
   */
  tick(now: number) {
    let damage = 0;
    for (const [kind, status] of this.active) {
      if (kind === 'chill') {
        if (status.until <= now) this.active.delete(kind);
        continue;
      }
      while (status.nextTick <= now && status.nextTick <= status.until) {
        damage += status.potency * status.stacks;
        status.nextTick += STATUS_TICK_MS;
      }
      if (status.until <= now) this.active.delete(kind);
    }
    return Math.round(damage);
  }

  /** The most visible active status, for tinting the enemy. */
  dominant(now: number): StatusKind | undefined {
    for (const kind of ['burn', 'toxin', 'chill'] as const) if (this.has(kind, now)) return kind;
    return undefined;
  }

  clear() {
    this.active.clear();
  }
}
