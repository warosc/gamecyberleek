import Phaser from 'phaser';
import { COLORS } from '../../config/Constants';
export class ExperienceOrb extends Phaser.GameObjects.Arc {
  value = 0;
  /** Gameplay time this orb was last spawned, used to recycle the stalest orb first. */
  spawnedAt = 0;
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 7, 0, 360, false, COLORS.green);
    scene.add.existing(this);
    scene.physics.add.existing(this);
  }
  spawn(x: number, y: number, value: number, gameplayTime = 0) {
    this.value = value;
    this.spawnedAt = gameplayTime;
    this.setPosition(x, y).setScale(1).setAlpha(1);
    (this.body as Phaser.Physics.Arcade.Body).enable = true;
    this.setActive(true).setVisible(true);
  }
  collect() {
    (this.body as Phaser.Physics.Arcade.Body).stop().enable = false;
    this.setActive(false).setVisible(false);
  }
}
