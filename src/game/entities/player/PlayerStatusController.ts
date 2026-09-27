/**
 * The player's timed states on gameplay time: shield, overdrive, chill and post-hit grace.
 * Pure and Phaser-free, so the rules (extend vs. refresh, what blocks damage) are unit tested;
 * `Player` owns only the visuals that react to them.
 */
export class PlayerStatusController {
  private shieldUntil = 0;
  private overdriveUntil = 0;
  private chilledUntil = 0;
  private graceUntil = 0;

  /** Re-activating extends from whichever is later, so a second shield never wastes the first. */
  shield(now: number, durationMs: number) {
    this.shieldUntil = Math.max(this.shieldUntil, now) + durationMs;
  }

  overdrive(now: number, durationMs: number) {
    this.overdriveUntil = Math.max(this.overdriveUntil, now) + durationMs;
  }

  /** Chill refreshes to the longest remaining duration instead of stacking. */
  chill(now: number, durationMs: number) {
    this.chilledUntil = Math.max(this.chilledUntil, now + durationMs);
  }

  /** Brief protection after a hit so overlapping sources cannot stack damage in one moment. */
  grace(now: number, durationMs: number) {
    this.graceUntil = now + durationMs;
  }

  isShielded(now: number) { return now < this.shieldUntil; }
  isOverdriven(now: number) { return now < this.overdriveUntil; }
  isChilled(now: number) { return now < this.chilledUntil; }
  inGrace(now: number) { return now < this.graceUntil; }

  damageMultiplier(now: number) { return this.isOverdriven(now) ? 1.5 : 1; }
  fireCooldownScale(now: number) { return this.isOverdriven(now) ? 0.5 : 1; }
  moveSpeedScale(now: number) { return this.isChilled(now) ? 0.65 : 1; }
}
