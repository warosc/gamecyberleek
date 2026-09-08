import Phaser from 'phaser';
import { saveRun } from './ProfileStore';
import { masteryEarnedForRun } from '../weapons/WeaponMastery';
import type { StarterWeaponId } from '../weapons/WeaponRegistry';

export interface RunEndData {
  time: number;
  level: number;
  victory: boolean;
  arenaIndex: number;
  weaponId: StarterWeaponId;
}

/** Owns the one-way handoff from gameplay into the result screen. */
export class RunEndSystem {
  private ended = false;

  constructor(private readonly scene: Phaser.Scene, private readonly stopUi: () => void) {}

  finish(data: RunEndData) {
    if (this.ended) return false;
    this.ended = true;
    saveRun(data.level, data.victory, data.weaponId);
    this.stopUi();
    this.scene.scene.start('GameOver', { ...data, masteryEarned: masteryEarnedForRun(data.level, data.victory) });
    return true;
  }
}
