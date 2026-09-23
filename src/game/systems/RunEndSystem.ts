import Phaser from 'phaser';
import { loadProfile, saveRun } from './ProfileStore';
import { masteryEarnedForRun } from '../weapons/WeaponMastery';
import type { StarterWeaponId } from '../weapons/WeaponRegistry';
import type { ContractOutcome } from './ContractSystem';
import type { RunRecord } from './RunTelemetry';
import type { RunFacts } from '../progression/Achievements';
import { ACHIEVEMENTS } from '../progression/Achievements';

export interface RunEndData {
  time: number;
  level: number;
  victory: boolean;
  arenaIndex: number;
  weaponId: StarterWeaponId;
  contracts: ContractOutcome;
  summary: Readonly<RunRecord>;
  equipment: string[];
  synergy?: string;
  facts: RunFacts;
  daily?: { date: string; mutator: string; score: number };
}

/** Owns the one-way handoff from gameplay into the result screen. */
export class RunEndSystem {
  private ended = false;

  constructor(private readonly scene: Phaser.Scene, private readonly stopUi: () => void) {}

  finish(data: RunEndData) {
    if (this.ended) return false;
    this.ended = true;
    const before = loadProfile();
    const after = saveRun(data.level, data.victory, data.weaponId, data.contracts, data.facts,
      data.daily && { date: data.daily.date, score: data.daily.score });
    const newUnlocks = after.unlocks.filter(id => !before.unlocks.includes(id));
    const newAchievements = ACHIEVEMENTS.filter(achievement =>
      after.achievements.includes(achievement.id) && !before.achievements.includes(achievement.id))
      .map(({ name, reward }) => ({ name, reward }));
    const dailyBest = Boolean(data.daily && (before.daily.date !== data.daily.date || data.daily.score > before.daily.bestScore));
    this.stopUi();
    this.scene.scene.start('GameOver', {
      ...data,
      masteryEarned: masteryEarnedForRun(data.level, data.victory),
      creditsEarned: after.bioCredits - before.bioCredits,
      newUnlocks,
      newAchievements,
      dailyBest,
    });
    return true;
  }
}
