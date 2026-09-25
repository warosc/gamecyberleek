export interface MomentumState {
  chain: number;
  xpMultiplier: number;
  tier: number;
  expiresAt: number;
}

export const MOMENTUM_WINDOW_MS = 1800;

/** Rewards consecutive eliminations while keeping the maximum economy bonus bounded. */
export class CombatMomentum {
  private chain = 0;
  private lastKillAt = -Infinity;

  kill(time: number): MomentumState {
    this.chain = time - this.lastKillAt <= MOMENTUM_WINDOW_MS ? this.chain + 1 : 1;
    this.lastKillAt = time;
    return this.state;
  }

  update(time: number): MomentumState | undefined {
    if (this.chain === 0 || time <= this.lastKillAt + MOMENTUM_WINDOW_MS) return;
    this.chain = 0;
    return this.state;
  }

  break(): MomentumState | undefined {
    if (this.chain === 0) return;
    this.chain = 0;
    return this.state;
  }

  get state(): MomentumState {
    const tier = Math.min(3, Math.floor(this.chain / 3));
    return {
      chain: this.chain,
      tier,
      xpMultiplier: 1 + tier * 0.1,
      expiresAt: this.chain > 0 ? this.lastKillAt + MOMENTUM_WINDOW_MS : 0,
    };
  }
}
