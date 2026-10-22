import {
  LIVE_ACHIEVEMENTS, NO_RUN_FACTS, newlyEarned, type AchievementContext, type RunFacts,
} from '../progression/Achievements';

/** Something worth a moment on screen: announced once, never paid here. */
export type RunMoment =
  | { kind: 'achievement'; id: string; name: string; reward: number }
  | { kind: 'record'; record: 'level'; level: number }
  | { kind: 'streak'; chain: number };

/** The profile as it was when the run started, plus who is playing it. */
export interface RunMomentsStart {
  owned: readonly string[];
  context: AchievementContext;
  bestLevel: number;
  sector: number;
}

/** What the run has done so far. */
export interface LiveRunFacts {
  kills: number;
  damageTaken: number;
  durationMs: number;
  /** All three contracts completed. */
  perfectContracts: boolean;
}

export const STREAK_MILESTONES = [10, 25, 50, 100] as const;

/**
 * Spots the moments of a run as they happen: achievements that can no longer be lost, a new best
 * level and kill-chain milestones. Before, achievements and records only surfaced on the results
 * screen, and the biggest moments of a run passed without a beat. Victory achievements and the
 * fastest-victory record stay on the results screen, which follows the commander's fall within a
 * second. Engine-free so the rules are unit tested; it never pays anything, so an achievement
 * announced here is still awarded once, by ProfileStore.saveRun at the end of the run.
 */
export class RunMoments {
  private readonly announced = new Set<string>();
  private levelRecordShown = false;
  private chain = 0;
  private readonly streaksShown = new Set<number>();

  constructor(private readonly start: RunMomentsStart) {}

  /** Achievements the run has earned so far that cannot be revoked before it ends. */
  achievements(facts: LiveRunFacts): RunMoment[] {
    const context = this.project(facts);
    const run: RunFacts & { victory: boolean } = {
      ...NO_RUN_FACTS, sector: this.start.sector, kills: facts.kills, damageTaken: facts.damageTaken,
      durationMs: facts.durationMs, victory: false,
    };
    return newlyEarned(this.start.owned, context, run)
      .filter(achievement => LIVE_ACHIEVEMENTS.includes(achievement.id))
      .filter(achievement => !this.announced.has(achievement.id))
      .map(achievement => {
        this.announced.add(achievement.id);
        return { kind: 'achievement' as const, id: achievement.id, name: achievement.name, reward: achievement.reward };
      });
  }

  /** A new best level, once per run. A first-time player (best level 1) is not greeted with one. */
  levelReached(level: number): RunMoment[] {
    if (this.levelRecordShown || this.start.bestLevel <= 1 || level <= this.start.bestLevel) return [];
    this.levelRecordShown = true;
    return [{ kind: 'record', record: 'level', level }];
  }

  /** Kill-chain milestones, once per chain; a broken chain re-arms them. */
  chainReached(chain: number): RunMoment[] {
    if (chain < this.chain) this.streaksShown.clear();
    this.chain = chain;
    const milestone = [...STREAK_MILESTONES].reverse().find(value => chain >= value && !this.streaksShown.has(value));
    if (milestone === undefined) return [];
    for (const value of STREAK_MILESTONES) if (value <= milestone) this.streaksShown.add(value);
    return [{ kind: 'streak', chain: milestone }];
  }

  /** The profile as saveRun will see it, so the same rules decide here and at the end. */
  private project(facts: LiveRunFacts): AchievementContext {
    const { context } = this.start;
    return {
      ...context,
      runs: context.runs + 1,
      perfectContracts: context.perfectContracts + Number(facts.perfectContracts),
      lifetime: { ...context.lifetime, kills: context.lifetime.kills + facts.kills },
    };
  }
}
