import Phaser from 'phaser';
import { COLORS } from '../config/Constants';

/** Scene-owned, presentation-only transient combat effects. */
export class CombatEffects {
  constructor(private readonly scene: Phaser.Scene) {}

  muzzle(x: number, y: number, angle: number) {
    const flash = this.scene.add
      .circle(x + Math.cos(angle) * 50, y + Math.sin(angle) * 50, 8, COLORS.cyan, 0.8)
      .setDepth(20);
    this.scene.tweens.add({
      targets: flash,
      scale: 2,
      alpha: 0,
      duration: 90,
      onComplete: () => flash.destroy(),
    });
  }

  impact(x: number, y: number) {
    for (let index = 0; index < 5; index++) {
      const dot = this.scene.add.circle(x, y, 2, COLORS.cyan).setDepth(20);
      const angle = Math.random() * Math.PI * 2;
      this.scene.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * 25,
        y: y + Math.sin(angle) * 25,
        alpha: 0,
        duration: 180,
        onComplete: () => dot.destroy(),
      });
    }
  }

  explosion(x: number, y: number, radius: number) {
    const blast = this.scene.add
      .circle(x, y, 18, 0xff7b35, 0.55)
      .setStrokeStyle(5, 0xffd166)
      .setDepth(20);
    this.scene.tweens.add({
      targets: blast,
      scale: radius / 18,
      alpha: 0,
      duration: 330,
      onComplete: () => blast.destroy(),
    });
  }

  floatingText(x: number, y: number, text: string, color: string) {
    const label = this.scene.add
      .text(x, y, text, { fontFamily: 'Arial Black', fontSize: '18px', color })
      .setOrigin(0.5)
      .setDepth(30);
    this.scene.tweens.add({
      targets: label,
      y: y - 35,
      alpha: 0,
      duration: 550,
      onComplete: () => label.destroy(),
    });
  }
}
