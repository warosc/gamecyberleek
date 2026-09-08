import Phaser from 'phaser';
import type { CombatEffects } from '../effects/CombatEffects';
import type { AudioManager } from '../managers/AudioManager';
import {
  impactProfile,
  resolveImpactTier,
  type ImpactContext,
  type ImpactTier,
} from './ImpactFeedback';

/**
 * Applies one impact tier across every channel at once: sparks, damage number, camera and
 * audio. Keeping them together is the point — feedback that scales in only one channel reads
 * as noise rather than as weight.
 */
export class ImpactPresenter {
  private lastCameraAt = -1000;
  private readonly reducedMotion =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly effects: CombatEffects,
    private readonly audio: AudioManager,
  ) {}

  /** A landed hit that did not kill. Returns the tier so callers can extend the reaction. */
  hit(x: number, y: number, amount: number, context: ImpactContext) {
    const tier = resolveImpactTier(context);
    this.effects.impact(x, y, tier);
    this.effects.damageNumber(x, y - 20, amount, tier);
    this.audio.play(impactProfile(tier).audio);
    this.camera(tier);
    return tier;
  }

  /** A kill. The burst colour stays the caller's choice so elites keep their affix colour. */
  death(x: number, y: number, color: number, context: ImpactContext) {
    const tier = resolveImpactTier({ ...context, fatal: true });
    this.effects.deathBurst(x, y, color, tier);
    this.audio.play(impactProfile(tier).audio);
    this.camera(tier);
    return tier;
  }

  /** Camera reaction alone, for moments that are not a damage event (a phase change, a spawn). */
  camera(tier: ImpactTier) {
    if (this.reducedMotion || tier === 'normal' || tier === 'enemyDeath') return;
    const now = this.scene.time.now;
    if (tier !== 'bossDeath' && now - this.lastCameraAt < 140) return;
    this.lastCameraAt = now;
    const profile = impactProfile(tier);
    if (profile.shakeMs > 0) this.scene.cameras.main.shake(profile.shakeMs, profile.shakeIntensity);
    if (profile.flash)
      this.scene.cameras.main.flash(
        profile.flash.durationMs,
        profile.flash.r,
        profile.flash.g,
        profile.flash.b,
        false,
      );
  }
}
