import Phaser from 'phaser';
import { COLORS } from '../../config/Constants';
export class ExperienceOrb extends Phaser.GameObjects.Arc {
  value = 0;
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 7, 0, 360, false, COLORS.green);
    scene.add.existing(this);
    scene.physics.add.existing(this);
  }
  spawn(x: number, y: number, value: number) {
    this.value = value;
    this.setPosition(x, y).setScale(1).setAlpha(1);
    (this.body as Phaser.Physics.Arcade.Body).enable = true;
    this.setActive(true).setVisible(true);
  }
  collect() {
    (this.body as Phaser.Physics.Arcade.Body).stop().enable = false;
    this.setActive(false).setVisible(false);
  }
}
