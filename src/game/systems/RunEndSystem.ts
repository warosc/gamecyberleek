import Phaser from 'phaser';
import { saveRun } from './ProfileStore';

export interface RunEndData {
  time: number;
  level: number;
  victory: boolean;
  arenaIndex: number;
}

/** Owns the one-way handoff from gameplay into the result screen. */
export class RunEndSystem {
  private ended = false;

  constructor(private readonly scene: Phaser.Scene, private readonly stopUi: () => void) {}

  finish(data: RunEndData) {
    if (this.ended) return false;
    this.ended = true;
    saveRun(data.level, data.victory);
    this.stopUi();
    this.scene.scene.start('GameOver', data);
    return true;
  }
}
