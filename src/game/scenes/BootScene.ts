import Phaser from 'phaser';
import { COLORS } from '../config/Constants';
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }
  create() {
    const g = this.add
      .graphics()
      .fillStyle(COLORS.cyan)
      .fillCircle(8, 8, 7)
      .fillStyle(0xffffff)
      .fillCircle(11, 6, 2);
    g.generateTexture('energy', 16, 16);
    g.destroy();
    const enemyEnergy = this.add
      .graphics()
      .fillStyle(0xff476f)
      .fillCircle(8, 8, 7)
      .fillStyle(0xffffff)
      .fillCircle(6, 6, 2);
    enemyEnergy.generateTexture('enemy-energy', 16, 16);
    enemyEnergy.destroy();
    this.scene.start('Preload');
  }
}
