import Phaser from 'phaser';
import { COLORS, GAMEPLAY } from '../config/Constants';
import { detectQualityProfile } from '../config/QualityProfile';
import { impactProfile, type ImpactTier } from '../presentation/ImpactFeedback';
import type { WeaponMode } from '../entities/player/WeaponSilhouettes';

/** Particle count the quality profile is expressed against, so tiers scale relative to it. */
const IMPACT_PARTICLE_BASELINE = 3;

/** Scene-owned, presentation-only transient combat effects. */
export class CombatEffects {
  private readonly transient = new Set<Phaser.GameObjects.GameObject>();
  private readonly quality = detectQualityProfile();
  private readonly maxTransient = Math.floor(GAMEPLAY.maxTransientEffects * this.quality.transientBudgetScale);
  private readonly reducedMotion =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  constructor(private readonly scene: Phaser.Scene) {}

  private track<T extends Phaser.GameObjects.GameObject>(object: T): T | undefined {
    if (this.transient.size >= this.maxTransient) {
      object.destroy();
      return undefined;
    }
    this.transient.add(object);
    return object;
  }

  private release(object: Phaser.GameObjects.GameObject) {
    this.transient.delete(object);
    if (object.active) object.destroy();
  }

  muzzle(x: number, y: number, angle: number, mode: WeaponMode = 'pulse', color: number = COLORS.cyan) {
    const muzzleX = x;
    const muzzleY = y;
    const flash = this.track(this.scene.add
      .circle(muzzleX, muzzleY, mode === 'plasma' ? 13 : mode === 'laser' ? 6 : 8, color, 0.82)
      .setDepth(20));
    if (!flash) return;
    this.scene.tweens.add({
      targets: flash,
      scale: 2,
      alpha: 0,
      duration: 90,
      onComplete: () => this.release(flash),
    });
    if (this.reducedMotion) return;
    // A short cone along the shot: the weapon reads as pointing somewhere, and the shot is
    // legible in the first frame after the click rather than only once the bolt has travelled.
    const length = mode === 'laser' ? 48 : mode === 'plasma' ? 22 : mode === 'arc' ? 34 : 30;
    const width = mode === 'plasma' ? 14 : mode === 'laser' ? 4 : 9;
    const cone = this.track(this.scene.add
      .triangle(muzzleX, muzzleY, 0, -width, 0, width, length, 0,
        mode === 'arc' ? color : COLORS.white, 0.78)
      .setRotation(angle)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(21));
    if (!cone) return;
    cone.name = `muzzle-${mode}`;
    this.scene.tweens.add({
      targets: cone,
      scaleX: 0.25,
      scaleY: 0.4,
      alpha: 0,
      duration: 80,
      ease: 'Quad.Out',
      onComplete: () => this.release(cone),
    });
    if (mode === 'plasma') {
      const ring = this.track(this.scene.add.circle(muzzleX, muzzleY, 9, color, 0)
        .setStrokeStyle(3, color, 0.9).setDepth(20).setName('muzzle-plasma-ring'));
      if (ring) this.scene.tweens.add({ targets: ring, scale: 2.6, alpha: 0, duration: 130,
        onComplete: () => this.release(ring) });
    } else if (mode === 'arc') {
      const fork = this.track(this.scene.add.graphics().lineStyle(2, color, 0.9)
        .lineBetween(muzzleX, muzzleY, muzzleX + Math.cos(angle + 0.3) * 23, muzzleY + Math.sin(angle + 0.3) * 23)
        .lineBetween(muzzleX, muzzleY, muzzleX + Math.cos(angle - 0.3) * 23, muzzleY + Math.sin(angle - 0.3) * 23)
        .setDepth(21).setName('muzzle-arc-fork'));
      if (fork) this.scene.tweens.add({ targets: fork, alpha: 0, duration: 90,
        onComplete: () => this.release(fork) });
    }
  }

  /**
   * Hit spark scaled to what just happened. `tier` comes from `resolveImpactTier`, so a
   * critical, a boss hit and a graze cannot all look the same.
   */
  impact(x: number, y: number, tier: ImpactTier = 'normal') {
    if (this.reducedMotion) return;
    const profile = impactProfile(tier);
    // The device quality profile still caps the count; the tier scales within that budget.
    const count = Math.max(
      1,
      Math.round(this.quality.impactParticles * (profile.particles / IMPACT_PARTICLE_BASELINE)),
    );
    const color = tier === 'critical' ? 0xfff27a : tier === 'bossHit' ? 0xf4d7ff : COLORS.cyan;
    for (let index = 0; index < count; index++) {
      const dot = this.track(
        this.scene.add.circle(x, y, tier === 'normal' ? 2 : 3, color).setDepth(20),
      );
      if (!dot) break;
      const angle = Math.random() * Math.PI * 2;
      this.scene.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * profile.spread,
        y: y + Math.sin(angle) * profile.spread,
        alpha: 0,
        duration: 180,
        onComplete: () => this.release(dot),
      });
    }
    if (tier !== 'critical') return;
    // A critical also gets a ring, which is what makes it readable in a crowded fight.
    const ring = this.track(
      this.scene.add
        .circle(x, y, 10, 0xfff27a, 0)
        .setStrokeStyle(3, 0xfff27a, 0.95)
        .setDepth(21),
    );
    if (!ring) return;
    this.scene.tweens.add({
      targets: ring,
      scale: 3.2,
      alpha: 0,
      duration: 240,
      ease: 'Quad.Out',
      onComplete: () => this.release(ring),
    });
  }

  explosion(x: number, y: number, radius: number) {
    const blast = this.track(this.scene.add
      .circle(x, y, 18, 0xff7b35, 0.55)
      .setStrokeStyle(5, 0xffd166)
      .setDepth(20));
    if (!blast) return;
    this.scene.tweens.add({
      targets: blast,
      scale: radius / 18,
      alpha: 0,
      duration: 330,
      onComplete: () => this.release(blast),
    });
  }

  bossCollapse(x: number, y: number) {
    for (let wave = 0; wave < 3; wave++) {
      const ring = this.track(this.scene.add.circle(x, y, 24, wave === 1 ? 0x21e6ff : 0xd566ff, 0.12)
        .setStrokeStyle(7 - wave, wave === 1 ? 0x21e6ff : 0xf4d7ff, 0.95).setDepth(25));
      if (!ring) continue;
      ring.setScale(0.3).setAlpha(0);
      this.scene.tweens.add({ targets: ring, scale: 5 + wave * 2, alpha: { from: 1, to: 0 },
        delay: wave * 150, duration: 520, ease: 'Cubic.Out', onComplete: () => this.release(ring) });
    }
  }

  /**
   * Death burst sized to the kill. An elite or a boss has to leave a bigger hole in the screen
   * than a grunt, or the player never learns which kills were worth making.
   */
  deathBurst(x: number, y: number, color: number = COLORS.cyan, tier: ImpactTier = 'enemyDeath') {
    if (this.reducedMotion) return;
    const profile = impactProfile(tier);
    const big = tier === 'bossDeath';
    const count = Math.round(profile.particles * this.quality.transientBudgetScale);
    for (let index = 0; index < count; index++) {
      const shard = this.track(
        this.scene.add.rectangle(x, y, big ? 7 : 4, big ? 12 : 8, color, 0.9).setDepth(20),
      );
      if (!shard) break;
      const angle = (Math.PI * 2 * index) / count + Math.random() * 0.2;
      shard.setRotation(angle);
      this.scene.tweens.add({
        targets: shard,
        x: x + Math.cos(angle) * profile.spread,
        y: y + Math.sin(angle) * profile.spread,
        alpha: 0,
        scale: 0.25,
        duration: big ? 420 : 240,
        ease: 'Quad.Out',
        onComplete: () => this.release(shard),
      });
    }
    if (tier === 'enemyDeath') return;
    // Elites and the boss also collapse a ring inward, which reads as "that one mattered".
    const ring = this.track(
      this.scene.add
        .circle(x, y, profile.spread, color, 0)
        .setStrokeStyle(big ? 6 : 3, color, 0.9)
        .setDepth(21),
    );
    if (!ring) return;
    this.scene.tweens.add({
      targets: ring,
      scale: 1.9,
      alpha: 0,
      duration: big ? 520 : 300,
      ease: 'Quad.Out',
      onComplete: () => this.release(ring),
    });
  }

  /**
   * Confirmation that an orb was banked. XP is the loop the whole run hangs off, and before
   * this the only sign a pickup happened was a number moving in the bar at the bottom edge.
   */
  xpPickup(x: number, y: number) {
    if (this.reducedMotion) return;
    const spark = this.track(
      this.scene.add
        .circle(x, y, 5, COLORS.green, 0)
        .setStrokeStyle(2, COLORS.green, 0.9)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(20),
    );
    if (!spark) return;
    this.scene.tweens.add({
      targets: spark,
      scale: 2.6,
      alpha: 0,
      duration: 220,
      ease: 'Quad.Out',
      onComplete: () => this.release(spark),
    });
  }

  floatingText(x: number, y: number, text: string, color: string, size = 18) {
    const label = this.track(this.scene.add
      .text(x, y, text, { fontFamily: 'Arial Black', fontSize: `${size}px`, color })
      .setOrigin(0.5)
      .setDepth(30));
    if (!label) return;
    this.scene.tweens.add({
      targets: label,
      y: y - 35,
      alpha: 0,
      duration: 550,
      onComplete: () => this.release(label),
    });
  }

  /**
   * Damage number styled by tier. A critical pops in at scale before drifting, which is what
   * separates it from a normal number at a glance in a busy fight.
   */
  damageNumber(x: number, y: number, amount: number, tier: ImpactTier) {
    const profile = impactProfile(tier);
    const critical = tier === 'critical';
    const label = this.track(
      this.scene.add
        .text(x, y, critical ? `${amount}!` : `${amount}`, {
          fontFamily: 'Arial Black',
          fontSize: `${profile.textSize}px`,
          color: profile.textColor,
          stroke: '#04121c',
          strokeThickness: critical ? 4 : 3,
        })
        .setOrigin(0.5)
        .setDepth(30),
    );
    if (!label) return;
    if (critical && !this.reducedMotion) {
      label.setScale(0.4);
      this.scene.tweens.add({ targets: label, scale: 1, duration: 130, ease: 'Back.Out' });
    }
    this.scene.tweens.add({
      targets: label,
      y: y - (critical ? 52 : 35),
      alpha: 0,
      duration: critical ? 700 : 550,
      onComplete: () => this.release(label),
    });
  }
}
