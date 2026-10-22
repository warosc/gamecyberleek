import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/Constants';
import { t, td } from '../i18n';
import { reducedMotion } from '../systems/RuntimeSettings';
import { fitText } from './SceneWidgets';
import { hudFont, hudPx, isCompactHud } from './HudLayout';

/** Compact mid-run encounter panel that stays clear of the permanent HUD. */
export class MinibossBanner {
  private readonly panel: Phaser.GameObjects.Container;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly name: Phaser.GameObjects.Text;
  private readonly compact: boolean;
  private readonly barWidth: number;
  private readonly panelWidth: number;
  private targetWidth: number;

  constructor(private readonly scene: Phaser.Scene) {
    // With phone-sized type the boss panel takes 120-180 (BossBanner), so this one sits under it
    // at 186-234 and widens for "REM-Ω // CENTINELA REMOLACHA" at 22px (~500px).
    this.compact = isCompactHud(scene);
    const centerY = this.compact ? 210 : 166;
    this.panelWidth = this.compact ? 520 : 360;
    this.barWidth = this.panelWidth - 30;
    this.targetWidth = this.barWidth;
    const back = scene.add.rectangle(GAME_WIDTH / 2, centerY, this.panelWidth, this.compact ? 48 : 34, 0x160811, 0.94)
      .setStrokeStyle(2, 0xff3b76, 0.9);
    this.fill = scene.add.rectangle(GAME_WIDTH / 2 - this.barWidth / 2, centerY + (this.compact ? 15 : 8), this.barWidth, 8, 0xff3b76)
      .setOrigin(0, 0.5);
    this.name = scene.add.text(GAME_WIDTH / 2, centerY - 8, '', {
      fontFamily: 'Arial Black', fontSize: hudFont(scene, 11), color: '#ffd7e5', letterSpacing: 2,
    }).setOrigin(0.5);
    this.panel = scene.add.container(0, 0, [back, this.fill, this.name]).setVisible(false);
  }

  update(delta: number) {
    if (this.panel.visible) this.fill.width += (this.targetWidth - this.fill.width) * (1 - Math.exp(-delta / 90));
  }

  show(name = 'REM-Ω', title = 'CENTINELA REMOLACHA', color = 0xff3b76) {
    const label = `${td(name)} // ${td(title)}`;
    this.name.setFontSize(hudPx(this.scene, 11)).setText(label).setColor(`#${color.toString(16).padStart(6, '0')}`);
    fitText(this.name, this.panelWidth - 20, 9);
    this.targetWidth = this.barWidth;
    this.fill.width = this.barWidth;
    // The arrival banner is the announcement; the springing panel and the banner's zoom are
    // decoration that reduced motion drops.
    const still = reducedMotion();
    this.panel.setVisible(true).setScale(1, still ? 1 : 0.2);
    if (!still) this.scene.tweens.add({ targets: this.panel, scaleY: 1, duration: 260, ease: 'Back.Out' });
    const plateWidth = this.compact ? 820 : 680;
    const banner = this.scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 35).setDepth(120);
    const plate = this.scene.add.rectangle(0, 0, plateWidth, this.compact ? 106 : 92, 0x160811, 0.95).setStrokeStyle(3, color);
    const titleText = fitText(this.scene.add.text(0, this.compact ? -16 : -13, label, {
      fontFamily: 'Arial Black', fontSize: '34px', color: '#ffd7e5', stroke: '#24030f', strokeThickness: 6,
    }).setOrigin(0.5), plateWidth - 40, 22);
    const brief = fitText(this.scene.add.text(0, this.compact ? 30 : 25, t('miniboss.brief'), {
      fontFamily: 'monospace', fontSize: hudFont(this.scene, 13), color: '#ff6f9f', letterSpacing: 3,
    }).setOrigin(0.5), plateWidth - 40, 11);
    banner.add([plate, titleText, brief]).setAlpha(0).setScale(still ? 1 : 0.86);
    this.scene.tweens.add({
      targets: banner, alpha: 1, scale: 1, duration: 280, ease: still ? 'Linear' : 'Back.Out', hold: 1250, yoyo: true,
      onComplete: () => banner.destroy(true),
    });
  }

  setHealth(current: number, max: number) {
    this.targetWidth = this.barWidth * Phaser.Math.Clamp(current / max, 0, 1);
    if (current <= 0) this.scene.time.delayedCall(500, () => this.panel.setVisible(false));
  }

  destroy() { this.panel.destroy(true); }
}
