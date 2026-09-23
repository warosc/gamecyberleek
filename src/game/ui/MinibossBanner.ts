import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/Constants';

/** Compact mid-run encounter panel that stays clear of the permanent HUD. */
export class MinibossBanner {
  private readonly panel: Phaser.GameObjects.Container;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly name: Phaser.GameObjects.Text;
  private targetWidth = 330;

  constructor(private readonly scene: Phaser.Scene) {
    const back = scene.add.rectangle(GAME_WIDTH / 2, 166, 360, 34, 0x160811, 0.94)
      .setStrokeStyle(2, 0xff3b76, 0.9);
    this.fill = scene.add.rectangle(GAME_WIDTH / 2 - 165, 174, 330, 8, 0xff3b76).setOrigin(0, 0.5);
    this.name = scene.add.text(GAME_WIDTH / 2, 158, 'REM-Ω // CENTINELA REMOLACHA', {
      fontFamily: 'Arial Black', fontSize: '11px', color: '#ffd7e5', letterSpacing: 2,
    }).setOrigin(0.5);
    this.panel = scene.add.container(0, 0, [back, this.fill, this.name]).setVisible(false);
  }

  update(delta: number) {
    if (this.panel.visible) this.fill.width += (this.targetWidth - this.fill.width) * (1 - Math.exp(-delta / 90));
  }

  show(name = 'REM-Ω', title = 'CENTINELA REMOLACHA', color = 0xff3b76) {
    this.name.setText(`${name} // ${title}`).setColor(`#${color.toString(16).padStart(6, '0')}`);
    this.panel.setVisible(true).setScale(1, 0.2);
    this.targetWidth = 330;
    this.fill.width = 330;
    this.scene.tweens.add({ targets: this.panel, scaleY: 1, duration: 260, ease: 'Back.Out' });
    const banner = this.scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 35).setDepth(120);
    const plate = this.scene.add.rectangle(0, 0, 680, 92, 0x160811, 0.95).setStrokeStyle(3, color);
    const titleText = this.scene.add.text(0, -13, `${name} // ${title}`, {
      fontFamily: 'Arial Black', fontSize: '34px', color: '#ffd7e5', stroke: '#24030f', strokeThickness: 6,
    }).setOrigin(0.5);
    const brief = this.scene.add.text(0, 25, 'LEE EL PATRÓN · RECOMPENSA DE EQUIPO', {
      fontFamily: 'monospace', fontSize: '13px', color: '#ff6f9f', letterSpacing: 3,
    }).setOrigin(0.5);
    banner.add([plate, titleText, brief]).setAlpha(0).setScale(0.86);
    this.scene.tweens.add({
      targets: banner, alpha: 1, scale: 1, duration: 280, ease: 'Back.Out', hold: 1250, yoyo: true,
      onComplete: () => banner.destroy(true),
    });
  }

  setHealth(current: number, max: number) {
    this.targetWidth = 330 * Phaser.Math.Clamp(current / max, 0, 1);
    if (current <= 0) this.scene.time.delayedCall(500, () => this.panel.setVisible(false));
  }

  destroy() { this.panel.destroy(true); }
}
