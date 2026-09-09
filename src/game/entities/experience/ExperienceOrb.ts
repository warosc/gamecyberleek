import Phaser from 'phaser';
import { COLORS } from '../../config/Constants';
export class ExperienceOrb extends Phaser.GameObjects.Arc {
  value = 0;
  /** Gameplay time this orb was last spawned, used to recycle the stalest orb first. */
  spawnedAt = 0;
  private readonly visual: Phaser.GameObjects.Container;
  private readonly halo: Phaser.GameObjects.Arc;
  private readonly shard: Phaser.GameObjects.Polygon;
  private readonly core: Phaser.GameObjects.Arc;
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 10, 0, 360, false, COLORS.green, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.halo = scene.add.circle(0, 0, 14, COLORS.green, 0.1).setStrokeStyle(2, COLORS.green, 0.55)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.shard = scene.add.polygon(0, 0, [0, -11, 8, 0, 0, 12, -8, 0], 0x73ef62, 0.95)
      .setStrokeStyle(2, 0xeaffff, 0.9);
    this.core = scene.add.circle(0, 0, 3, 0xffffff, 0.95).setBlendMode(Phaser.BlendModes.ADD);
    this.visual = scene.add.container(x, y, [this.halo, this.shard, this.core]).setDepth(7);
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
    this.shard.setFillStyle(color, 0.95).setScale(0.85 + tier * 0.16);
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
    this.shard.setRotation(gameplayTime * 0.0018);
    this.halo.setScale(0.9 + Math.sin(gameplayTime * 0.008 + this.spawnedAt) * 0.12);
  }
  destroy(fromScene?: boolean) {
    this.visual?.destroy(true);
    super.destroy(fromScene);
  }
}
