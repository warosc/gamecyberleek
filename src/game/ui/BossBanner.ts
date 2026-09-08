import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/Constants';
import { BOSS_IDENTITY } from '../entities/enemies/BossVisual';

/** Owns the boss health panel, its arrival banner and the phase callouts. */
export class BossBanner {
  private readonly panel: Phaser.GameObjects.Container;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly phaseText: Phaser.GameObjects.Text;
  private targetWidth = 510;
  private phaseShown = 1;

  constructor(private readonly scene: Phaser.Scene) {
    // Sits below the run clock and the weapon readout rather than across them: at y=88 the
    // boss bar covered both the moment the encounter that most needs a clock began.
    const back = scene.add
      .rectangle(GAME_WIDTH / 2, 126, 540, 48, 0x100817, 0.95)
      .setStrokeStyle(3, 0xd566ff, 0.85);
    this.fill = scene.add
      .rectangle(GAME_WIDTH / 2 - 255, 136, 510, 15, 0x9d36d6)
      .setOrigin(0, 0.5);
    const name = scene.add
      .text(GAME_WIDTH / 2 - 130, 114, BOSS_IDENTITY.name, {
        fontFamily: 'Arial Black',
        fontSize: '15px',
        color: '#f4d7ff',
      })
      .setOrigin(0.5);
    this.phaseText = scene.add
      .text(GAME_WIDTH / 2 + 246, 114, BOSS_IDENTITY.phases[0], {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#d566ff',
        letterSpacing: 1,
      })
      .setOrigin(1, 0.5);
    this.panel = scene.add.container(0, 0, [back, this.fill, name, this.phaseText]).setVisible(false);
  }

  /** Frame-rate-independent drain, matching the rest of the HUD. */
  update(delta: number) {
    if (!this.panel.visible) return;
    this.fill.width += (this.targetWidth - this.fill.width) * (1 - Math.exp(-delta / 90));
  }

  show() {
    this.panel.setVisible(true);
    this.panel.setScale(1, 0.2);
    this.targetWidth = 510;
    this.fill.width = 510;
    this.phaseShown = 1;
    this.scene.tweens.add({ targets: this.panel, scaleY: 1, duration: 320, ease: 'Back.Out' });
    this.scene.cameras.main.flash(280, 95, 15, 120);
    // The arrival of the only boss in the run should not be a health bar quietly appearing.
    const banner = this.scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40).setDepth(120);
    const plate = this.scene.add
      .rectangle(0, 0, 720, 96, 0x100817, 0.94)
      .setStrokeStyle(3, 0xd566ff, 0.9);
    const title = this.scene.add
      .text(0, -14, `${BOSS_IDENTITY.name} // COMANDANTE`, {
        fontFamily: 'Arial Black',
        fontSize: '38px',
        color: '#f4d7ff',
        stroke: '#1a0326',
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    const subtitle = this.scene.add
      .text(0, 26, BOSS_IDENTITY.title, {
        fontFamily: 'Arial Black',
        fontSize: '13px',
        color: '#d566ff',
        letterSpacing: 5,
      })
      .setOrigin(0.5);
    banner.add([plate, title, subtitle]);
    banner.setAlpha(0).setScale(0.85);
    this.scene.tweens.add({
      targets: banner,
      alpha: 1,
      scale: 1,
      duration: 300,
      ease: 'Back.Out',
      hold: 1400,
      yoyo: true,
      onComplete: () => banner.destroy(),
    });
  }

  setHealth(current: number, max: number) {
    const ratio = Phaser.Math.Clamp(current / max, 0, 1);
    this.targetWidth = 510 * ratio;
    if (ratio === 0) return;
    const phase = ratio <= 0.33 ? 3 : ratio <= 0.66 ? 2 : 1;
    this.phaseText
      .setText(BOSS_IDENTITY.phases[phase - 1])
      .setColor(phase === 3 ? '#ff476f' : phase === 2 ? '#ffb52e' : '#d566ff');
    if (phase === this.phaseShown) return;
    // A phase change alters how the boss attacks, so it has to be impossible to miss.
    this.phaseShown = phase;
    this.phaseText.setScale(1);
    this.scene.tweens.add({ targets: this.phaseText, scale: 1.9, duration: 180, yoyo: true });
    this.scene.tweens.add({ targets: this.panel, scaleX: 1.04, duration: 140, yoyo: true });
    const flash = this.scene.add
      .text(GAME_WIDTH / 2, 208, BOSS_IDENTITY.phases[phase - 1], {
        fontFamily: 'Arial Black',
        fontSize: '44px',
        color: phase === 3 ? '#ff476f' : '#ffb52e',
        stroke: '#1a0326',
        strokeThickness: 7,
      })
      .setOrigin(0.5)
      .setDepth(120)
      .setAlpha(0);
    this.scene.tweens.add({
      targets: flash,
      alpha: 1,
      y: 188,
      duration: 220,
      hold: 700,
      yoyo: true,
      onComplete: () => flash.destroy(),
    });
  }
}
