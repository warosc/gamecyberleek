import Phaser from 'phaser';
import { detectQualityProfile } from '../../config/QualityProfile';
import { EnemyType } from './EnemyTypes';
import { VEGETABLE_ROSTER, vegetableTexture, type VegetableType } from './VegetableRoster';

/** Shared textures, fixed child counts, and gameplay-time animation; no per-enemy timers. */
export class VegetableVisual extends Phaser.GameObjects.Container {
  readonly artHeight: number;
  private readonly model: Phaser.GameObjects.Container;
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly jets: Phaser.GameObjects.Ellipse[] = [];
  private readonly charge?: Phaser.GameObjects.Arc;
  private readonly motion = detectQualityProfile().tier !== 'low';

  constructor(scene: Phaser.Scene, private readonly enemyKind: VegetableType) {
    super(scene, 0, 0);
    const spec = VEGETABLE_ROSTER[enemyKind];
    this.artHeight = spec.height;
    this.name = `vegetable-visual-${spec.id}`;
    this.sprite = scene.add.image(0, 0, vegetableTexture(enemyKind)).setOrigin(0.5, 0.7);
    this.sprite.setScale(spec.height / this.sprite.height);
    this.sprite.name = `${spec.id}-production-sprite`;
    const width = this.sprite.displayWidth;
    this.shadow = scene.add.ellipse(0, spec.height * 0.26, width * 0.65, spec.height * 0.11, 0x000000, 0.45);
    this.model = scene.add.container(0, 0);
    if (enemyKind === EnemyType.RUNNER) {
      for (const side of [-1, 1]) {
        const jet = scene.add.ellipse(side * width * 0.18, spec.height * 0.26, 4, 10, 0x21e6ff, 0.5)
          .setBlendMode(Phaser.BlendModes.ADD);
        this.jets.push(jet);
        this.model.add(jet);
      }
    }
    this.model.add(this.sprite);
    if (enemyKind === EnemyType.SHOOTER) {
      this.charge = scene.add.circle(-width * 0.385, 0, 4, 0xffc857, 0)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.model.add(this.charge);
    }
    this.add([this.shadow, this.model]);
  }

  updatePose(time: number, offset: number, moving: boolean, facingLeft: boolean,
    charging: boolean, recoil: number, hit: number) {
    const heavy = this.enemyKind === EnemyType.TANK;
    const runner = this.enemyKind === EnemyType.RUNNER;
    const shooter = this.enemyKind === EnemyType.SHOOTER;
    const wave = Math.sin(time * (moving ? (heavy ? 0.009 : runner ? 0.024 : 0.016) : 0.003) + offset);
    const detail = this.motion ? 1 : 0;
    const stride = moving ? Math.abs(wave) * (runner ? 2.8 : heavy ? 1.4 : 2) : Math.abs(wave) * 0.5;
    this.model.setPosition(recoil * 2 * (facingLeft ? 1 : -1) * detail,
      -(stride + (shooter ? 1.5 : 0) + recoil * 2) * detail);
    this.model.scaleX = facingLeft ? -1 : 1;
    this.model.rotation = (moving ? wave * (heavy ? 0.035 : 0.025) : 0) * detail;
    this.shadow.setScale(1 - stride * 0.025 * detail, 1);
    for (const jet of this.jets) jet.setVisible(moving)
      .setScale(1, this.motion ? 0.8 + Math.abs(wave) * 0.65 : 0.7);
    this.charge?.setAlpha(charging ? 0.9 : recoil * 0.8)
      .setScale(1 + (charging ? 0.4 : recoil * 0.8) * detail);
    if (hit > 0.6) {
      this.sprite.setTint(0xeaffff);
      this.sprite.setTintFill();
    } else this.sprite.clearTint();
  }
}
