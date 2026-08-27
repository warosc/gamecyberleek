import Phaser from 'phaser';
import { Events } from '../../config/Constants';
import { HealthComponent } from '../../components/HealthComponent';
import { createPlayerStats } from './PlayerStats';
import { PlayerAnimator } from './PlayerAnimator';

export class Player extends Phaser.GameObjects.Container {
  readonly stats = createPlayerStats();
  readonly health = new HealthComponent(this.stats.maxHp);
  private keys: Record<'up' | 'down' | 'left' | 'right' | 'dash', Phaser.Input.Keyboard.Key>;
  private lastShot = 0;
  private lastDash = -9999;
  private dashingUntil = 0;
  aim = 0;
  private overdriveUntil = 0;
  private animator: PlayerAnimator;
  private lastTrail = 0;
  private shieldUntil = 0;
  private shieldVisual: Phaser.GameObjects.Arc;
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const shadow = scene.add.ellipse(0, 31, 54, 18, 0x000000, 0.48);
    shadow.name = 'player-ground-shadow';
    this.shieldVisual = scene.add
      .circle(0, 0, 48, 0x21e6ff, 0.12)
      .setStrokeStyle(3, 0x73ef62, 0.9)
      .setVisible(false);
    const reference = scene.add.image(0, 0, 'leek-placeholder-front').setScale(0.2);
    reference.name = 'placeholder-full-body-reference-not-a-rig';
    this.add([shadow, this.shieldVisual, reference]);
    this.animator = new PlayerAnimator(scene, reference);
    this.setSize(46, 75);
    (this.body as Phaser.Physics.Arcade.Body)
      .setSize(46, 75)
      .setOffset(-23, -22)
      .setCollideWorldBounds(true);
    this.setDepth(10);
    const kb = scene.input.keyboard!;
    this.keys = {
      up: kb.addKey('W'),
      down: kb.addKey('S'),
      left: kb.addKey('A'),
      right: kb.addKey('D'),
      dash: kb.addKey('SPACE'),
    };
  }
  update(
    time: number,
    pointer: Phaser.Input.Pointer,
    shoot: (x: number, y: number, angle: number) => void,
    virtual?: {
      active: boolean;
      movement: Phaser.Math.Vector2;
      aim: Phaser.Math.Vector2;
      firing: boolean;
      dash: boolean;
      autoFire: boolean;
    },
  ) {
    const v = virtual?.active
      ? virtual.movement.clone().normalize()
      : new Phaser.Math.Vector2(
          Number(this.keys.right.isDown) - Number(this.keys.left.isDown),
          Number(this.keys.down.isDown) - Number(this.keys.up.isDown),
        ).normalize();
    if (
      (Phaser.Input.Keyboard.JustDown(this.keys.dash) || Boolean(virtual?.dash)) &&
      time - this.lastDash >= this.stats.dashCooldown &&
      v.lengthSq() > 0
    ) {
      this.lastDash = time;
      this.dashingUntil = time + this.stats.dashDuration;
      this.animator.dash(time, this.stats.dashDuration);
      this.scene.cameras.main.shake(70, 0.002);
    }
    const speed = time < this.dashingUntil ? this.stats.dashSpeed : this.stats.moveSpeed;
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(v.x * speed, v.y * speed);
    if (virtual?.active && virtual.aim.lengthSq() > 0.04) this.aim = virtual.aim.angle();
    else {
      const world = pointer.positionToCamera(this.scene.cameras.main) as Phaser.Math.Vector2;
      this.aim = Phaser.Math.Angle.Between(this.x, this.y, world.x, world.y);
    }
    const facing = Math.cos(this.aim) < 0 ? -1 : 1;
    this.animator.update(time, v, time < this.dashingUntil, facing);
    if (time < this.dashingUntil && time - this.lastTrail > 45) {
      this.lastTrail = time;
      const ghost = this.scene.add
        .image(this.x, this.y, 'leek-placeholder-front')
        .setScale(0.2)
        .setFlipX(facing < 0)
        .setTint(0x21e6ff)
        .setAlpha(0.24)
        .setDepth(8);
      this.scene.tweens.add({
        targets: ghost,
        alpha: 0,
        duration: 180,
        onComplete: () => ghost.destroy(),
      });
    }
    const overdrive = time < this.overdriveUntil;
    if (
      (virtual?.active ? virtual.firing || virtual.autoFire : pointer.isDown) &&
      time - this.lastShot >= this.stats.attackCooldown * (overdrive ? 0.5 : 1)
    ) {
      this.lastShot = time;
      this.animator.attack(time);
      const spread = 0.12;
      for (let i = 0; i < this.stats.projectileCount; i++)
        shoot(this.x, this.y, this.aim + (i - (this.stats.projectileCount - 1) / 2) * spread);
    }
  }
  activateOverdrive(durationMs: number) {
    this.overdriveUntil = Math.max(this.overdriveUntil, this.scene.time.now) + durationMs;
    this.setScale(this.scaleX * 1.08, 1.08);
    this.scene.time.delayedCall(
      durationMs,
      () => this.active && this.setScale(Math.sign(this.scaleX), 1),
    );
  }
  activateShield(durationMs: number) {
    this.shieldUntil = Math.max(this.shieldUntil, this.scene.time.now) + durationMs;
    this.shieldVisual.setVisible(true);
    this.scene.tweens.add({
      targets: this.shieldVisual,
      alpha: { from: 0.45, to: 1 },
      duration: 280,
      yoyo: true,
      repeat: Math.max(1, Math.floor(durationMs / 560) - 1),
      onComplete: () => this.shieldVisual.setVisible(false).setAlpha(1),
    });
  }
  get damageMultiplier() {
    return this.scene.time.now < this.overdriveUntil ? 1.5 : 1;
  }
  getDashCharge(time = this.scene.time.now) {
    return Phaser.Math.Clamp((time - this.lastDash) / this.stats.dashCooldown, 0, 1);
  }
  takeDamage(amount: number) {
    if (this.scene.time.now < this.shieldUntil) {
      this.scene.tweens.add({ targets: this.shieldVisual, scale: 1.18, duration: 70, yoyo: true });
      return;
    }
    const mitigated = Math.max(1, amount * (1 - this.stats.damageReduction));
    if (this.health.damage(mitigated)) {
      this.scene.events.emit(Events.PLAYER_DAMAGED, this.health.current, this.health.max);
      this.animator.hurt(this.scene.time.now);
      this.setAlpha(0.45);
      this.scene.time.delayedCall(90, () => this.setAlpha(1));
      if (this.health.dead) this.scene.events.emit(Events.PLAYER_DIED);
    }
  }
}
