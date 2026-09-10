import Phaser from 'phaser';
import { COLORS } from '../../config/Constants';
export class ExperienceOrb extends Phaser.GameObjects.Arc {
  value = 0;
  /** Gameplay time this orb was last spawned, used to recycle the stalest orb first. */
  spawnedAt = 0;
  private readonly visual: Phaser.GameObjects.Container;
  private readonly halo: Phaser.GameObjects.Arc;
  private readonly badge: Phaser.GameObjects.Arc;
  private readonly glyph: Phaser.GameObjects.Text;
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 10, 0, 360, false, COLORS.green, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.halo = scene.add.circle(0, 0, 14, COLORS.green, 0.1).setStrokeStyle(2, COLORS.green, 0.55)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.badge = scene.add.circle(0, 0, 12, 0x06131a, 0.96)
      .setStrokeStyle(2, COLORS.green, 0.95);
    this.glyph = scene.add.text(0, 0, 'XP', {
      fontFamily: 'Arial Black', fontSize: '13px', color: '#73ef62',
      stroke: '#07111f', strokeThickness: 2,
    }).setOrigin(0.5);
    this.visual = scene.add.container(x, y, [this.halo, this.badge, this.glyph]).setDepth(7);
  }
  spawn(x: number, y: number, value: number, gameplayTime = 0) {
    this.scene.tweens.killTweensOf(this.visual);
    this.value = value;
    this.spawnedAt = gameplayTime;
    const tier = value >= 50 ? 3 : value >= 25 ? 2 : 1;
    const color = tier === 3 ? 0xffd166 : tier === 2 ? 0x21e6ff : COLORS.green;
    this.setPosition(x, y).setScale(1).setAlpha(1);
    this.visual.setPosition(x, y).setVisible(true).setAlpha(1).setScale(0.35);
    this.halo.setFillStyle(color, 0.1).setStrokeStyle(tier + 1, color, 0.7);
    this.badge.setRadius(10 + tier * 2).setStrokeStyle(tier === 3 ? 3 : 2, color, 0.95);
    this.glyph.setColor(`#${color.toString(16).padStart(6, '0')}`).setFontSize(11 + tier * 2);
    this.scene.tweens.add({ targets: this.visual, scale: 1, duration: 220, ease: 'Back.Out' });
    (this.body as Phaser.Physics.Arcade.Body).enable = true;
    this.setActive(true).setVisible(true);
  }
  collect() {
    (this.body as Phaser.Physics.Arcade.Body).stop().enable = false;
    this.setActive(false).setVisible(false);
    this.visual.setVisible(false);
  }
  syncVisual(gameplayTime: number) {
    if (!this.active) return;
    this.visual.setPosition(this.x, this.y - 4 - Math.sin(gameplayTime * 0.006 + this.spawnedAt) * 3);
    const pulse = 1 + Math.sin(gameplayTime * 0.01 + this.spawnedAt) * 0.06;
    this.badge.setScale(pulse);
    this.glyph.setScale(pulse);
    this.halo.setScale(0.9 + Math.sin(gameplayTime * 0.008 + this.spawnedAt) * 0.12);
  }
  destroy(fromScene?: boolean) {
    this.visual?.destroy(true);
    super.destroy(fromScene);
  }
}
