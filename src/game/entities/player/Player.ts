import Phaser from 'phaser';
import { Events } from '../../config/Constants';
import { HealthComponent } from '../../components/HealthComponent';
import { createPlayerStats } from './PlayerStats';
import { PlayerAnimator } from './PlayerAnimator';
import { PlayerController, type VirtualPlayerInput } from './PlayerController';
import { resolveDamage } from '../../systems/CombatSystem';
import { LayeredPlayerRig } from './LayeredPlayerRig';

export class Player extends Phaser.GameObjects.Container {
  readonly stats = createPlayerStats();
  readonly health = new HealthComponent(this.stats.maxHp);
  private controller: PlayerController;
  private lastShot = 0;
  private readonly weapon: Phaser.GameObjects.Container;
  private lastDash = -9999;
  private readonly dashDirection = new Phaser.Math.Vector2();
  private hurtUntil = 0;
  private dashingUntil = 0;
  aim = 0;
  private overdriveUntil = 0;
  private animator: PlayerAnimator;
  private layeredRig?: LayeredPlayerRig;
  private lastTrail = 0;
  private shieldUntil = 0;
  private shieldVisual: Phaser.GameObjects.Arc;
  private shieldRing: Phaser.GameObjects.Graphics;
  private overdriveVisual: Phaser.GameObjects.Arc;
  private overdriveRing: Phaser.GameObjects.Graphics;
  private shadow: Phaser.GameObjects.Ellipse;
  private gameplayTime = 0;
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const rig = LayeredPlayerRig.create(scene);
    this.layeredRig = rig;
    // The layered rig stands taller than the flat reference image, so its feet land lower.
    // A shadow tuned for the reference floated a body-width above the boots and broke the
    // sense that the character is standing on the floor at all.
    this.shadow = scene.add.ellipse(0, rig ? 46 : 31, rig ? 60 : 54, rig ? 20 : 18, 0x000000, 0.48);
    this.shadow.name = 'player-ground-shadow';
    this.shieldVisual = scene.add
      .circle(0, 0, 48, 0x21e6ff, 0.1)
      .setStrokeStyle(2, 0x73ef62, 0.55)
      .setVisible(false);
    // A segmented ring reads as a deployed shield rather than a plain circle, and the gaps
    // keep enemies behind it readable.
    this.shieldRing = scene.add.graphics().setVisible(false);
    this.shieldRing.lineStyle(4, 0x73ef62, 0.95);
    for (let segment = 0; segment < 6; segment++) {
      const start = (Math.PI * 2 * segment) / 6;
      this.shieldRing.beginPath();
      this.shieldRing.arc(0, 0, 48, start, start + Math.PI / 4.6);
      this.shieldRing.strokePath();
    }
    this.overdriveVisual = scene.add
      .circle(0, 0, 56, 0xd566ff, 0.07)
      .setStrokeStyle(2, 0xd566ff, 0.55)
      .setVisible(false);
    this.overdriveRing = scene.add.graphics().setVisible(false);
    this.overdriveRing.lineStyle(3, 0xd566ff, 0.9);
    for (let segment = 0; segment < 3; segment++) {
      const start = (Math.PI * 2 * segment) / 3;
      this.overdriveRing.beginPath();
      this.overdriveRing.arc(0, 0, 62, start, start + Math.PI / 2.4);
      this.overdriveRing.strokePath();
    }
    this.overdriveRing.setBlendMode(Phaser.BlendModes.ADD);
    const reference = scene.add.image(0, 0, 'leek-placeholder-front').setScale(0.2);
    reference.name = 'placeholder-full-body-reference-not-a-rig';
    if (rig) reference.setVisible(false);
    this.add([
      this.shadow,
      this.overdriveVisual,
      this.overdriveRing,
      this.shieldVisual,
      this.shieldRing,
      reference,
    ]);
    if (rig) this.add(rig);
    const gun = scene.add.graphics();
    gun.fillStyle(0x07111f).fillRoundedRect(-7, -8, 35, 16, 3)
      .lineStyle(2, 0x5b8191).strokeRoundedRect(-7, -8, 35, 16, 3)
      .fillStyle(0x21e6ff).fillRect(2, -3, 28, 6)
      .fillStyle(0x73ef62).fillRect(-4, -5, 5, 10);
    this.weapon = scene.add.container(22, 0, [gun]);
    this.weapon.name = 'player-aimed-weapon';
    this.add(this.weapon);
    this.animator = new PlayerAnimator(scene, reference, rig?.setAnimationState.bind(rig));
    this.setSize(46, 75);
    (this.body as Phaser.Physics.Arcade.Body)
      .setSize(46, 75)
      .setOffset(-23, -22)
      .setCollideWorldBounds(true);
    this.setDepth(10);
    this.controller = new PlayerController(scene.input.keyboard!);
  }
  update(
    time: number,
    pointer: Phaser.Input.Pointer,
    shoot: (x: number, y: number, angle: number) => void,
    virtual?: VirtualPlayerInput,
  ) {
    this.gameplayTime = time;
    const v = this.controller.getMovement(virtual);
    if (
      this.controller.wantsDash(virtual) &&
      time - this.lastDash >= this.stats.dashCooldown &&
      v.lengthSq() > 0
    ) {
      this.lastDash = time;
      this.dashDirection.copy(v);
      this.dashingUntil = time + this.stats.dashDuration;
      this.animator.dash(time, this.stats.dashDuration);
      // A short impulse along the dash rather than an undirected shake: the camera agrees with
      // where the player just went.
      this.scene.cameras.main.shake(90, 0.0035);
      this.scene.events.emit(Events.PLAYER_DASHED, v.x, v.y);
    }
    if (time < this.dashingUntil) v.copy(this.dashDirection);
    const speed = time < this.dashingUntil ? this.stats.dashSpeed : this.stats.moveSpeed;
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(v.x * speed, v.y * speed);
    const mouseFiring = !pointer.wasTouch && pointer.leftButtonDown();
    const virtualAiming = virtual?.active &&
      (virtual.firing || virtual.autoFire || pointer.wasTouch) && !mouseFiring;
    if (virtualAiming && virtual.aim.lengthSq() > 0.04) this.aim = virtual.aim.angle();
    else {
      const world = pointer.positionToCamera(this.scene.cameras.main) as Phaser.Math.Vector2;
      this.aim = Phaser.Math.Angle.Between(this.x, this.y, world.x, world.y);
    }
    const recoil = Math.max(0, 1 - (time - this.lastShot) / 120) * 5;
    this.weapon.setPosition(Math.cos(this.aim) * (22 - recoil), Math.sin(this.aim) * (22 - recoil))
      .setRotation(this.aim).setAlpha(time < this.dashingUntil ? 0.5 : 1);
    const facingAngle = time < this.dashingUntil ? this.dashDirection.angle() : this.aim;
    const facing = Math.cos(facingAngle) < 0 ? -1 : 1;
    const dashing = time < this.dashingUntil;
    // Mirror the rig first: it converts world velocity into its own local axis using facing.
    this.layeredRig?.setFlipX(facing < 0);
    this.layeredRig?.setAim(this.aim);
    this.layeredRig?.setMotion(v.x * speed, v.y * speed, dashing, this.stats.moveSpeed);
    this.animator.update(time, v, dashing, facing);
    // Ground contact: the shadow tightens as the character rises into a dash.
    this.shadow.setScale(dashing ? 0.78 : 1, dashing ? 0.72 : 1).setAlpha(dashing ? 0.3 : 0.48);
    if (dashing && time - this.lastTrail > 45) {
      this.lastTrail = time;
      // A streak stretched along the dash axis rather than a tinted body copy: it reads as
      // speed against any silhouette, and stays correct now that the rig replaced the flat
      // reference image the old ghost was cut from.
      const heading = v.lengthSq() > 0 ? v.angle() : this.aim;
      const streak = this.scene.add
        .ellipse(this.x, this.y, 78, 26, 0x21e6ff, 0.32)
        .setRotation(heading)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(8);
      this.scene.tweens.add({
        targets: streak,
        scaleX: 0.35,
        scaleY: 0.5,
        alpha: 0,
        duration: 190,
        ease: 'Quad.Out',
        onComplete: () => streak.destroy(),
      });
    }
    const overdrive = time < this.overdriveUntil;
    this.setScale(overdrive ? 1.08 : 1);
    const shielded = time < this.shieldUntil;
    this.shieldVisual.setVisible(shielded);
    this.shieldRing.setVisible(shielded);
    if (shielded) {
      // Counter-rotating shell and ring: unmistakably a shield, and the gaps let the player
      // keep reading what is behind it.
      this.shieldVisual.setRotation(-time * 0.003);
      this.shieldRing.setRotation(time * 0.0016);
      const flicker = 1 + Math.sin(time * 0.012) * 0.03;
      this.shieldRing.setScale(flicker);
    }
    this.overdriveVisual.setVisible(overdrive);
    this.overdriveRing.setVisible(overdrive);
    if (overdrive) {
      this.overdriveVisual.setRotation(time * 0.004);
      this.overdriveRing.setRotation(-time * 0.0055);
      this.overdriveRing.setAlpha(0.65 + Math.sin(time * 0.02) * 0.3);
    }
    // The lenses hold a charge while Overdrive is up: the ability reads on the character
    // itself, not only on the aura around it.
    this.layeredRig?.setPowerGlow(overdrive ? 0.55 : 0);
    if (
      (mouseFiring || (virtual?.active && (virtual.firing || virtual.autoFire))) &&
      time - this.lastShot >= this.stats.attackCooldown * (overdrive ? 0.5 : 1)
    ) {
      this.lastShot = time;
      this.layeredRig?.recoil(time);
      this.animator.attack(time);
      const spread = 0.12;
      for (let i = 0; i < this.stats.projectileCount; i++)
        shoot(this.x + Math.cos(this.aim) * 46, this.y + Math.sin(this.aim) * 46, this.aim + (i - (this.stats.projectileCount - 1) / 2) * spread);
    }
  }
  activateOverdrive(durationMs: number) {
    this.overdriveUntil = Math.max(this.overdriveUntil, this.gameplayTime) + durationMs;
    this.overdriveVisual.setVisible(true);
    this.overdriveRing.setVisible(true);
    this.scene.tweens.add({ targets: this.overdriveVisual, scale: 1.16, alpha: 0.45, duration: 180, yoyo: true });
    this.castFlare(0xd566ff, 74);
  }
  activateShield(durationMs: number) {
    this.shieldUntil = Math.max(this.shieldUntil, this.gameplayTime) + durationMs;
    this.shieldVisual.setVisible(true);
    this.shieldRing.setVisible(true);
    this.shieldVisual.setScale(0.92);
    this.scene.tweens.add({
      targets: this.shieldVisual,
      alpha: { from: 0.35, to: 1 },
      scale: 1.08,
      duration: 280,
      yoyo: true,
      repeat: Math.max(1, Math.floor(durationMs / 560) - 1),
      onComplete: () => this.shieldVisual.setAlpha(1),
    });
    this.castFlare(0x73ef62, 60);
  }
  /** Single expanding ring on activation, so every ability has a visible moment of cast. */
  private castFlare(color: number, radius: number) {
    const flare = this.scene.add
      .circle(this.x, this.y, radius * 0.35, color, 0)
      .setStrokeStyle(4, color, 0.9)
      .setDepth(19);
    this.scene.tweens.add({
      targets: flare,
      scale: radius / (radius * 0.35) / 1.6,
      alpha: 0,
      duration: 320,
      ease: 'Quad.Out',
      onComplete: () => flare.destroy(),
    });
  }
  get damageMultiplier() {
    return this.gameplayTime < this.overdriveUntil ? 1.5 : 1;
  }
  get animationState() {
    return this.animator.currentState;
  }
  get usesLayeredRig() {
    return this.layeredRig !== undefined;
  }
  getDashCharge(time = this.gameplayTime) {
    return Phaser.Math.Clamp((time - this.lastDash) / this.stats.dashCooldown, 0, 1);
  }
  takeDamage(amount: number) {
    if (this.gameplayTime < this.dashingUntil || this.gameplayTime < this.hurtUntil) return;
    if (this.gameplayTime < this.shieldUntil) {
      // A blocked hit has to be as readable as a taken one, or the shield feels like nothing.
      this.scene.tweens.add({ targets: this.shieldVisual, scale: 1.18, duration: 70, yoyo: true });
      this.scene.tweens.add({ targets: this.shieldRing, alpha: { from: 1, to: 0.35 }, duration: 90, yoyo: true });
      return;
    }
    const hit = resolveDamage({
      baseAmount: amount,
      type: 'kinetic',
      source: 'enemy',
      armorReduction: this.stats.damageReduction,
    });
    const applied = Math.max(1, hit.amount);
    if (this.health.damage(applied)) {
      this.hurtUntil = this.gameplayTime + 350;
      // The third argument is the damage actually applied after armor. Heals emit the same
      // event without it, so a listener can tell a hit from a repair.
      this.scene.events.emit(Events.PLAYER_DAMAGED, this.health.current, this.health.max, applied);
      this.animator.hurt(this.gameplayTime);
      this.setAlpha(0.45);
      this.scene.time.delayedCall(90, () => this.setAlpha(1));
      if (this.health.dead) {
        this.animator.death(this.gameplayTime);
        this.scene.events.emit(Events.PLAYER_DIED);
      }
    }
  }
  isShieldActive() {
    return this.gameplayTime < this.shieldUntil;
  }
  isOverdriveActive() {
    return this.gameplayTime < this.overdriveUntil;
  }
}
