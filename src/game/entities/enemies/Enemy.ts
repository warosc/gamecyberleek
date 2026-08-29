import Phaser from 'phaser';
import { HealthComponent } from '../../components/HealthComponent';
import { ELITE_AFFIX_DEFS, ENEMY_DEFS, EnemyType, type EliteAffix } from './EnemyTypes';

/** Preserves the original feel: 0.075 rad per frame at 60fps. */
const PULSE_RADIANS_PER_MS = 0.075 * 0.06;
export class Enemy extends Phaser.GameObjects.Arc {
  readonly def;
  readonly health;
  lastContact = 0;
  private lastAttack = -9999;
  private visual: Phaser.GameObjects.Container;
  private healthBack: Phaser.GameObjects.Rectangle;
  private healthFill: Phaser.GameObjects.Rectangle;
  /** Per-enemy offset so the idle pulse of a crowd is desynchronised. */
  private readonly visualOffset = Math.random() * Math.PI * 2;
  private visualPhase = 0;
  elite = false;
  eliteAffix: EliteAffix = 'OVERCHARGED';
  private eliteMultiplier = 1;
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    public enemyType: EnemyType,
  ) {
    const d = ENEMY_DEFS[enemyType];
    super(scene, x, y, d.size, 0, 360, false, d.color);
    this.def = d;
    this.health = new HealthComponent(d.hp);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setVisible(false);
    (this.body as Phaser.Physics.Arcade.Body).setCircle(d.size);
    this.visual = this.createVisual(scene, d.size, d.color);
    this.healthBack = scene.add
      .rectangle(x, y - d.size - 10, d.size * 2, 5, 0x08101b, 0.9)
      .setVisible(false)
      .setDepth(12);
    this.healthFill = scene.add
      .rectangle(x - d.size, y - d.size - 10, d.size * 2, 3, 0x73ef62)
      .setOrigin(0, 0.5)
      .setVisible(false)
      .setDepth(13);
  }
  chase(target: { x: number; y: number }) {
    this.scene.physics.moveToObject(this, target, this.def.speed * this.eliteMultiplier);
    this.syncVisual(target);
  }
  updateBehavior(
    target: { x: number; y: number },
    time: number,
    fire: (x: number, y: number, angle: number, speed: number, damage: number) => void,
  ) {
    // Derived from gameplay time, not incremented per frame: a fixed step made the pulse
    // run at the display refresh rate, so a 165Hz screen animated ~2.75x faster than 60Hz.
    this.visualPhase = this.visualOffset + time * PULSE_RADIANS_PER_MS;
    const distance = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);
    if (this.def.behavior === 'kite') {
      if (distance > 390) this.scene.physics.moveToObject(this, target, this.def.speed * this.eliteMultiplier);
      else if (distance < 230)
        this.scene.physics.velocityFromRotation(
          Phaser.Math.Angle.Between(target.x, target.y, this.x, this.y),
          this.def.speed * this.eliteMultiplier,
          (this.body as Phaser.Physics.Arcade.Body).velocity,
        );
      else (this.body as Phaser.Physics.Arcade.Body).setVelocity(0);
      if (time - this.lastAttack > 1450 && distance < 560) {
        this.lastAttack = time;
        this.showAttackTelegraph(0xff9a72, 34);
        fire(
          this.x,
          this.y,
          Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y),
          310,
          10,
        );
      }
      this.syncVisual(target);
      return;
    }
    this.chase(target);
    if (this.def.behavior === 'commander' && time - this.lastAttack > this.bossAttackCooldown) {
      this.lastAttack = time;
      const phase = this.bossPhase;
      this.showAttackTelegraph(phase === 3 ? 0xff476f : 0xd566ff, phase === 3 ? 104 : 86);
      const base = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
      const spread = phase === 1 ? 2 : phase === 2 ? 3 : 4;
      for (let index = -spread; index <= spread; index++)
        fire(this.x, this.y, base + index * 0.2, phase === 3 ? 290 : 260, phase === 3 ? 16 : 14);
    }
  }
  hit(amount: number) {
    this.health.damage(amount);
    this.healthBack.setVisible(true);
    this.healthFill
      .setVisible(true)
      .setDisplaySize(this.def.size * 2 * (this.health.current / this.health.max), 3);
    this.visual.setAlpha(0.35);
    this.scene.time.delayedCall(60, () => this.active && this.visual.setAlpha(1));
    return this.health.dead;
  }
  makeElite() {
    if (this.enemyType === EnemyType.BOSS || this.elite) return this;
    this.elite = true;
    const affix = ELITE_AFFIX_DEFS[this.eliteAffix];
    this.eliteMultiplier = affix.speedMultiplier;
    this.health.max = Math.round(this.health.max * affix.healthMultiplier);
    this.health.current = this.health.max;
    const crown = this.scene.add.graphics().lineStyle(4, affix.color, 0.9).strokeCircle(0, 0, this.def.size + 13);
    crown.setBlendMode(Phaser.BlendModes.ADD);
    this.visual.addAt(crown, 1);
    return this;
  }
  get contactDamage() {
    return this.def.damage * (this.elite ? ELITE_AFFIX_DEFS[this.eliteAffix].damageMultiplier : 1);
  }
  get xpReward() {
    return this.def.xp * (this.elite ? 3 : 1);
  }
  get bossPhase() {
    if (this.enemyType !== EnemyType.BOSS) return 1;
    const ratio = this.health.current / this.health.max;
    return ratio <= 0.33 ? 3 : ratio <= 0.66 ? 2 : 1;
  }
  private get bossAttackCooldown() {
    return this.bossPhase === 3 ? 780 : this.bossPhase === 2 ? 1000 : 1300;
  }
  destroy(fromScene?: boolean) {
    this.visual?.destroy();
    this.healthBack?.destroy();
    this.healthFill?.destroy();
    super.destroy(fromScene);
  }

  private createVisual(scene: Phaser.Scene, size: number, color: number) {
    const shadow = scene.add.ellipse(0, size * 0.45, size * 1.9, size * 0.75, 0x000000, 0.4);
    const body = scene.add.graphics();
    const halo = scene.add.graphics();
    halo.lineStyle(2, color, 0.28).strokeCircle(0, 0, size + 8);

    if (this.enemyType === EnemyType.GRUNT) {
      body
        .fillStyle(0x173a25)
        .fillTriangle(-size, -5, -size - 10, 8, -size + 2, 12)
        .fillTriangle(size, -5, size + 10, 8, size - 2, 12)
        .fillStyle(0x0a1725)
        .fillCircle(0, 0, size + 3)
        .fillStyle(color)
        .fillCircle(0, 0, size - 2)
        .lineStyle(3, 0x9affb2, 0.75)
        .strokeCircle(0, 0, size)
        .fillStyle(0x10243a)
        .fillRoundedRect(-size * 0.72, -7, size * 1.44, 13, 4)
        .fillStyle(0x21e6ff)
        .fillRoundedRect(-size * 0.48, -4, size * 0.96, 5, 2)
        .fillStyle(0xeaffff)
        .fillCircle(0, size * 0.47, 3);
    } else if (this.enemyType === EnemyType.RUNNER) {
      body
        .fillStyle(0xffc857, 0.5)
        .fillTriangle(-size * 0.55, size * 0.7, 0, size + 18, size * 0.55, size * 0.7)
        .fillStyle(0x07111f)
        .fillTriangle(0, -size - 7, -size - 5, size, size + 5, size)
        .fillStyle(color)
        .fillTriangle(0, -size - 3, -size, size - 2, size, size - 2)
        .lineStyle(2, 0xfff2a0, 0.85)
        .strokeTriangle(0, -size - 3, -size, size - 2, size, size - 2)
        .fillStyle(0x0b1a2b)
        .fillCircle(0, 0, size * 0.55)
        .fillStyle(0x21e6ff)
        .fillCircle(0, 0, size * 0.27)
        .fillStyle(0xffffff)
        .fillCircle(0, 0, 2);
    } else if (this.enemyType === EnemyType.SHOOTER) {
      body
        .fillStyle(0x301323)
        .fillRoundedRect(-size - 11, -5, size * 2 + 22, 10, 4)
        .fillStyle(0x0a101c)
        .fillCircle(0, 0, size + 4)
        .lineStyle(3, 0xff9a72, 0.9)
        .strokeCircle(0, 0, size + 2)
        .fillStyle(color)
        .fillCircle(0, 0, size - 3)
        .fillStyle(0x15283a)
        .fillRoundedRect(-size * 0.75, -7, size * 1.5, 14, 5)
        .fillStyle(0xff476f)
        .fillCircle(0, -2, 6)
        .fillStyle(0xffffff)
        .fillCircle(0, -2, 2)
        .fillStyle(0xff9a72)
        .fillTriangle(-8, size - 2, 8, size - 2, 0, size + 11);
    } else {
      const points = Array.from({ length: 8 }, (_, index) => {
        const angle = (Math.PI * 2 * index) / 8 - Math.PI / 8;
        return new Phaser.Math.Vector2(Math.cos(angle) * (size + 4), Math.sin(angle) * (size + 4));
      });
      body
        .fillStyle(0x080d18)
        .fillPoints(points, true)
        .lineStyle(4, 0xbad8ff, 0.65)
        .strokePoints(points, true)
        .fillStyle(color)
        .fillCircle(0, 0, size - 5)
        .fillStyle(0x17243b)
        .fillRoundedRect(-size * 0.8, -8, size * 1.6, 16, 5)
        .fillStyle(0xd566ff)
        .fillRect(-size * 0.52, -3, size * 1.04, 6)
        .fillStyle(0xeaffff)
        .fillCircle(0, size * 0.52, 4);
      for (let index = 0; index < 4; index++) {
        const angle = (Math.PI / 2) * index;
        body.fillStyle(color, 0.65).fillCircle(
          Math.cos(angle) * (size + 8), Math.sin(angle) * (size + 8), 4,
        );
      }
    }

    return scene.add.container(this.x, this.y, [shadow, halo, body]).setDepth(6);
  }

  private syncVisual(target: { x: number; y: number }) {
    this.visual.setPosition(this.x, this.y);
    const pulse = 1 + Math.sin(this.visualPhase) * (this.enemyType === EnemyType.RUNNER ? 0.07 : 0.025);
    this.visual.setScale(pulse, 2 - pulse);
    this.visual.rotation =
      Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y) + Math.PI / 2;
    this.healthBack.setPosition(this.x, this.y - this.def.size - 10);
    this.healthFill.setPosition(this.x - this.def.size, this.y - this.def.size - 10);
  }

  private showAttackTelegraph(color: number, radius: number) {
    const ring = this.scene.add
      .circle(this.x, this.y, radius, color, 0.08)
      .setStrokeStyle(3, color, 0.95)
      .setDepth(14);
    this.scene.tweens.add({
      targets: ring,
      scale: 1.35,
      alpha: 0,
      duration: 220,
      ease: 'Quad.Out',
      onComplete: () => ring.destroy(),
    });
  }
}
