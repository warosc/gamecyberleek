import Phaser from 'phaser';
import { loadProfile, saveRun } from './ProfileStore';
import { masteryEarnedForRun } from '../weapons/WeaponMastery';
import type { StarterWeaponId } from '../weapons/WeaponRegistry';
import type { RunRecord } from './RunTelemetry';

export interface RunEndData {
  time: number;
  level: number;
  victory: boolean;
  arenaIndex: number;
  weaponId: StarterWeaponId;
  summary: Readonly<RunRecord>;
  equipment: string[];
  synergy?: string;
}

/** Owns the one-way handoff from gameplay into the result screen. */
export class RunEndSystem {
  private ended = false;

  constructor(private readonly scene: Phaser.Scene, private readonly stopUi: () => void) {}

  finish(data: RunEndData) {
    if (this.ended) return false;
    this.ended = true;
    const before = loadProfile();
    const after = saveRun(data.level, data.victory, data.weaponId);
    const newUnlocks = after.unlocks.filter(id => !before.unlocks.includes(id));
    this.stopUi();
    this.scene.scene.start('GameOver', {
      ...data,
      masteryEarned: masteryEarnedForRun(data.level, data.victory),
      creditsEarned: after.bioCredits - before.bioCredits,
      newUnlocks,
    });
    return true;
  }
}
