import Phaser from 'phaser';
import { PLAYER_RIG_LAYERS, type PlayerRigLayer } from './PlayerRigManifest';
import type { PlayerAnimationState, PlayerVisualAdapter } from './PlayerAnimator';
import type { WeaponMode } from './WeaponSilhouettes';
import {
  PLAYER_RIG_SKELETON,
  rigOrigin,
  rigRestPosition,
  rigSolveOrder,
} from './PlayerRigSkeleton';
import {
  RigAnimationClock,
  sampleRigAnimation,
  type RigAnimationData,
} from './PlayerRigAnimation';

interface PoseEntry {
  x: number;
  y: number;
  rotation: number;
  alpha: number;
}

/** Longest frame the secondary-motion springs will integrate in one step. */
const MAX_STEP_MS = 50;
/** Full breath cycle. Deliberately slower than a hurried idle so the pose reads as composed. */
const BREATH_PERIOD_MS = 2400;
const SHINE_MIN_GAP_MS = 5200;
const SHINE_DURATION_MS = 620;

/**
 * Runtime layered renderer. It is only created when every validated layer texture exists.
 *
 * Layers are posed through a small forward-kinematics pass over `PLAYER_RIG_SKELETON`: each
 * image's origin sits on its joint, so a rotation bends the limb at the joint, and a parent's
 * rotation carries its children. On top of the authored keyframes it runs velocity-driven
 * secondary motion — leaf follow-through, body lean, dash squash — that no keyframe can express
 * because it depends on how the player is actually moving.
 */
export class LayeredPlayerRig extends Phaser.GameObjects.Container implements PlayerVisualAdapter {
  private readonly layers = new Map<PlayerRigLayer, Phaser.GameObjects.Image>();
  private readonly rest = new Map<PlayerRigLayer, { x: number; y: number }>();
  private readonly pose = new Map<PlayerRigLayer, PoseEntry>();
  private readonly worldAngle = new Map<PlayerRigLayer, number>();
  private readonly worldPosition = new Map<PlayerRigLayer, { x: number; y: number }>();
  private readonly solveOrder = rigSolveOrder(PLAYER_RIG_LAYERS);
  private readonly animations = new Map<PlayerAnimationState, RigAnimationData>();
  private readonly clock = new RigAnimationClock();
  private readonly reducedMotion =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  private glassesShine?: Phaser.GameObjects.Image;
  private shineStartedAt = -SHINE_MIN_GAP_MS;
  private nextShineAt = SHINE_MIN_GAP_MS;

  private stateStartedAt = 0;
  private lastTime = 0;
  private started = false;

  /** Facing sign written by `setFlipX`, kept apart from the squash written by the dash. */
  private facing = 1;
  private externalScale = 1;
  private squash = 0;
  private lean = 0;
  private leafAngle = 0;
  private leafVelocity = 0;
  private localVelocityX = 0;
  private speed = 0;
  private dashing = false;
  private powerGlow = 0;
  private gaitTime = 0;
  private aimPitch = 0;
  private aimAngle = 0;
  private recoilAt = -1000;
  private weaponMode: WeaponMode = 'pulse';

  setAim(angle: number) {
    this.aimAngle = angle;
    this.aimPitch = Math.sin(angle) * 0.12 * this.facing;
  }

  /** Player-local socket resolved from the animated right wrist after forward kinematics. */
  getWeaponSocket() {
    const hand = this.worldPosition.get('hand-right')!;
    const stretch = this.squash * 0.16;
    return {
      x: hand.x * this.facing * this.externalScale * (1 + stretch),
      y: hand.y * this.externalScale * (1 - stretch * 0.75),
      angle: this.aimAngle,
    };
  }

  recoil(time: number) {
    this.recoilAt = time;
  }
  setWeaponMode(mode: WeaponMode) { this.weaponMode = mode; }

  static create(scene: Phaser.Scene) {
    if (!PLAYER_RIG_LAYERS.every((layer) => scene.textures.exists(`rig-${layer}`))) return undefined;
    return new LayeredPlayerRig(scene);
  }

  private constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    for (const layer of PLAYER_RIG_LAYERS) {
      const rest = rigRestPosition(layer);
      const origin = rigOrigin(layer);
      // Moving the origin onto the joint also moves the image, so the rest position puts the
      // joint exactly where it sits in the export and the pose is unchanged at rest.
      const image = scene.add
        .image(rest.x, rest.y, `rig-${layer}`)
        .setOrigin(origin.x, origin.y)
        .setScale(0.2);
      this.rest.set(layer, rest);
      this.layers.set(layer, image);
      this.pose.set(layer, { x: 0, y: 0, rotation: 0, alpha: 1 });
      this.worldAngle.set(layer, 0);
      this.worldPosition.set(layer, { x: rest.x, y: rest.y });
      this.add(image);
    }
    // A second copy of the lens layer, additively blended and normally invisible. It inherits
    // the glasses transform every frame, so the highlight tracks the head for free.
    const glasses = this.layers.get('glasses');
    if (glasses && !this.reducedMotion) {
      this.glassesShine = scene.add
        .image(glasses.x, glasses.y, 'rig-glasses')
        .setOrigin(glasses.originX, glasses.originY)
        .setScale(0.2)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0);
      this.add(this.glassesShine);
    }
    for (const state of ['idle', 'walk', 'attack', 'dash', 'hurt', 'death'] as PlayerAnimationState[]) {
      const data = scene.cache.json.get(`rig-anim-${state}`) as RigAnimationData | undefined;
      if (data) this.animations.set(state, data);
    }
  }

  setPose() {}

  setFlipX(flip: boolean) {
    this.facing = flip ? -1 : 1;
  }

  setPosition(x?: number, y?: number) {
    super.setPosition(x, y);
    return this;
  }

  setScale(scale: number) {
    this.externalScale = scale;
    return this;
  }

  setAlpha(alpha: number) {
    super.setAlpha(alpha);
    return this;
  }

  setAngle(angle: number) {
    super.setAngle(angle);
    return this;
  }

  /**
   * Movement signal for secondary motion. Velocity arrives in world space; the rig mirrors with
   * the character, so it is converted to the rig's own local axis before driving the springs.
   */
  setMotion(velocityX: number, velocityY: number, dashing: boolean, moveSpeed: number) {
    const reference = Math.max(1, moveSpeed);
    this.localVelocityX = (velocityX / reference) * this.facing;
    this.speed = Math.min(1.6, Math.hypot(velocityX, velocityY) / reference);
    this.dashing = dashing;
  }

  /**
   * Sustained charge held in the lenses, 0 to 1. Overdrive uses it so the ability is legible on
   * the character and not only in the aura drawn around it.
   */
  setPowerGlow(intensity: number) {
    this.powerGlow = Phaser.Math.Clamp(intensity, 0, 1);
  }

  setAnimationState(state: PlayerAnimationState, time: number) {
    if (!this.started) {
      this.started = true;
      this.lastTime = time;
    }
    // The clock restarts on every state change, so a one-shot entered deep into a run still
    // plays from its first keyframe instead of resuming at its last.
    this.stateStartedAt = time - this.clock.elapsed(state, time);
    const step = Phaser.Math.Clamp(time - this.lastTime, 0, MAX_STEP_MS);
    this.lastTime = time;
    this.gaitTime += step * Math.min(this.speed, 1.6);

    this.resetPose();
    this.sampleAnimation(state, time);
    this.blendLocomotion(state);
    this.applySecondaryMotion(state, time, step);
    this.solve();
    this.updateShine(state, time);
  }

  private resetPose() {
    for (const layer of PLAYER_RIG_LAYERS) {
      const entry = this.pose.get(layer)!;
      entry.x = 0;
      entry.y = 0;
      entry.rotation = 0;
      entry.alpha = 1;
    }
  }

  /** Legs keep walking under the firing pose, even during sustained automatic fire. */
  private blendLocomotion(state: PlayerAnimationState) {
    if ((state !== 'walk' && state !== 'attack') || this.speed < 0.01) return;
    const walk = this.animations.get('walk');
    if (!walk) return;
    for (const [layer, transform] of sampleRigAnimation(walk, this.gaitTime)) {
      const leg = layer.startsWith('thigh-') || layer.startsWith('leg-') || layer.startsWith('boot-');
      if (state === 'walk' || leg) Object.assign(this.pose.get(layer)!, transform);
    }
  }

  /** Reads the authored keyframes for the state into the pose accumulator. */
  private sampleAnimation(state: PlayerAnimationState, time: number) {
    const animation = this.animations.get(state);
    if (!animation?.keyframes?.length) return;
    for (const [layer, transform] of sampleRigAnimation(animation, time - this.stateStartedAt)) {
      const entry = this.pose.get(layer);
      if (!entry) continue;
      entry.x += transform.x;
      entry.y += transform.y;
      entry.rotation += transform.rotation;
      entry.alpha = transform.alpha;
    }
  }

  /**
   * Motion the keyframes cannot express: breathing that never stops, leaves that trail the body
   * with spring follow-through, a lean into movement, and the dash squash/stretch.
   */
  private applySecondaryMotion(state: PlayerAnimationState, time: number, step: number) {
    const torso = this.pose.get('torso')!;
    const head = this.pose.get('head')!;
    const leaves = this.pose.get('hair-leaves')!;
    const dead = state === 'death';

    if (!dead) {
      // Breathing rides under every state so the character is never a frozen sprite.
      const breath = Math.sin((time / BREATH_PERIOD_MS) * Math.PI * 2);
      const depth = state === 'idle' ? 1 : 0.35;
      torso.y += breath * 0.55 * depth;
      head.y += breath * 0.25 * depth;
      if (!this.reducedMotion) {
        head.rotation += this.aimPitch;
        const recoil = Math.max(0, 1 - (time - this.recoilAt) / 150) ** 2;
        torso.x -= recoil * 2.2;
        torso.rotation -= recoil * 0.045;
        this.pose.get('arm-right-upper')!.rotation -= recoil * 0.18;
        this.pose.get('arm-right-fore')!.rotation += recoil * 0.12;
        leaves.rotation += recoil * 0.08;
      }
      // Turn the complete right-arm chain toward the cursor. The angles account for the
      // downward rest vectors in the exported artwork; mirroring converts world aim back into
      // the rig's local space before forward kinematics is solved.
      const localAim = this.facing < 0 ? Math.PI - this.aimAngle : this.aimAngle;
      const upperRestAngle = Math.atan2(66, 31);
      const foreRestAngle = Math.atan2(49, 6);
      const bend = 0.16;
      const upper = this.pose.get('arm-right-upper')!;
      const fore = this.pose.get('arm-right-fore')!;
      const torsoAngle = torso.rotation;
      const upperWorld = localAim - upperRestAngle + bend;
      upper.rotation += upperWorld - torsoAngle;
      fore.rotation += localAim - foreRestAngle - bend - upperWorld;
      if (this.weaponMode === 'plasma' || this.weaponMode === 'laser') {
        // Heavy and long weapons use the left hand as a support point beneath the barrel.
        const leftUpperRest = Math.atan2(65, -29);
        const leftForeRest = Math.atan2(50, -3);
        const leftUpper = this.pose.get('arm-left-upper')!;
        const leftFore = this.pose.get('arm-left-fore')!;
        const supportWorld = localAim - leftUpperRest - 0.1;
        leftUpper.rotation += supportWorld - torsoAngle;
        leftFore.rotation += localAim - leftForeRest + 0.2 - supportWorld;
      }
    }

    // Leaves trail the body: the spring is driven by horizontal speed and by the lean, with a
    // small bob that grows with total speed so running shakes them more than strafing. The
    // overshoot when the player stops is the follow-through the brief asks for.
    const bob = Math.sin((time / 190) * Math.PI * 2) * 0.05 * this.speed;
    const leafTarget = dead
      ? 0.85
      : Phaser.Math.Clamp(-this.localVelocityX * 0.26 - this.lean * 1.1 + bob, -0.34, 0.34);
    // Critically damped spring integrated in seconds. Tuning stiffness against a raw millisecond
    // step made the velocity term explode: it crossed the target in two frames and swung the
    // leaves clear of the head.
    const seconds = step / 1000;
    const frequency = this.dashing ? 17 : 12;
    const acceleration =
      (leafTarget - this.leafAngle) * frequency * frequency - this.leafVelocity * 2 * frequency;
    this.leafVelocity += acceleration * seconds;
    this.leafAngle = Phaser.Math.Clamp(this.leafAngle + this.leafVelocity * seconds, -0.5, 0.9);
    leaves.rotation += this.leafAngle;
    // A little of the same lag on the head reads as weight without breaking the silhouette.
    if (!dead) head.rotation += this.leafAngle * 0.18;

    if (this.reducedMotion || dead) {
      this.lean = 0;
      this.squash = 0;
    } else {
      const leanTarget = Phaser.Math.Clamp(this.localVelocityX * 0.075, -0.09, 0.09);
      this.lean = Phaser.Math.Linear(this.lean, leanTarget, Math.min(1, step * 0.012));
      // Squash on the dash's first frames, stretch on its release, both settling back fast.
      const dashElapsed = time - this.stateStartedAt;
      const dashShape =
        state === 'dash' && dashElapsed < 200
          ? dashElapsed < 45
            ? dashElapsed / 45
            : Math.max(0, 1 - (dashElapsed - 45) / 155)
          : 0;
      this.squash = Phaser.Math.Linear(this.squash, dashShape, Math.min(1, step * 0.02));
      torso.rotation += this.lean;
      const stride = Math.sin(this.gaitTime * Math.PI * 2 / 440);
      if (state === 'walk' || state === 'attack') {
        torso.y -= Math.abs(stride) * Math.min(this.speed, 1) * 1.5;
        head.y += Math.abs(stride) * Math.min(this.speed, 1) * 0.4;
      }
      if (state === 'dash') {
        torso.rotation += 0.16;
        this.pose.get('arm-left-upper')!.rotation -= 0.28;
        this.pose.get('thigh-left')!.rotation -= 0.18;
        this.pose.get('thigh-right')!.rotation += 0.18;
      }
      head.rotation -= this.lean * 0.45;
    }
  }

  /**
   * Forward kinematics. A joint's world angle is its parent's plus its own, and its position is
   * its parent's position plus the rest offset between the two joints rotated by the parent's
   * angle — so rotating a shoulder carries the forearm and the hand with it.
   */
  private solve() {
    for (const layer of this.solveOrder) {
      const entry = this.pose.get(layer)!;
      const rest = this.rest.get(layer)!;
      const parent = PLAYER_RIG_SKELETON[layer].parent;
      let angle = entry.rotation;
      let x = rest.x + entry.x;
      let y = rest.y + entry.y;
      if (parent) {
        const parentAngle = this.worldAngle.get(parent)!;
        const parentPosition = this.worldPosition.get(parent)!;
        const parentRest = this.rest.get(parent)!;
        const offsetX = rest.x - parentRest.x;
        const offsetY = rest.y - parentRest.y;
        const cos = Math.cos(parentAngle);
        const sin = Math.sin(parentAngle);
        angle += parentAngle;
        x = parentPosition.x + offsetX * cos - offsetY * sin + entry.x;
        y = parentPosition.y + offsetX * sin + offsetY * cos + entry.y;
      }
      this.worldAngle.set(layer, angle);
      const position = this.worldPosition.get(layer)!;
      position.x = x;
      position.y = y;
      this.layers.get(layer)!.setPosition(x, y).setRotation(angle).setAlpha(entry.alpha);
    }
    const stretch = this.squash * 0.16;
    this.scaleX = this.facing * this.externalScale * (1 + stretch);
    this.scaleY = this.externalScale * (1 - stretch * 0.75);
  }

  /** Occasional specular flash across the lenses. Idle-only, so it reads as a character beat. */
  private updateShine(state: PlayerAnimationState, time: number) {
    const shine = this.glassesShine;
    if (!shine) return;
    const glasses = this.layers.get('glasses')!;
    shine.setPosition(glasses.x, glasses.y).setRotation(glasses.rotation);
    if (state === 'idle' && time >= this.nextShineAt) {
      this.shineStartedAt = time;
      this.nextShineAt = time + SHINE_MIN_GAP_MS + Math.random() * 3400;
    }
    // A held Overdrive charge and a passing idle glint share the lenses; the brighter wins.
    const charge = this.powerGlow * (0.7 + Math.sin(time * 0.018) * 0.3);
    const elapsed = time - this.shineStartedAt;
    const glint =
      elapsed < 0 || elapsed > SHINE_DURATION_MS
        ? 0
        : // One smooth in-out sweep rather than a blink.
          Math.sin((elapsed / SHINE_DURATION_MS) * Math.PI) * 0.5;
    shine.setAlpha(Math.max(charge, glint));
  }
}
