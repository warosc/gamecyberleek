import Phaser from 'phaser';

export type PlayerAnimationState = 'idle' | 'walk' | 'dash' | 'attack' | 'hurt' | 'death';

/** Rendering contract for a future separated-layer rig. Gameplay never depends on textures. */
export interface PlayerVisualAdapter {
  setPose(texture: string, frame?: string): void;
  setFlipX(flip: boolean): void;
  setPosition(x: number, y: number): void;
  setScale(scale: number): void;
  setAlpha(alpha: number): void;
  setAngle(angle: number): void;
}

/** Adapter for the current complete reference image. A layered rig can implement the same API. */
export class ImageVisualAdapter implements PlayerVisualAdapter {
  constructor(private readonly image: Phaser.GameObjects.Image) {}
  setPose(texture: string, frame?: string) { this.image.setTexture(texture, frame); }
  setFlipX(flip: boolean) { this.image.setFlipX(flip); }
  setPosition(x: number, y: number) { this.image.setPosition(x, y); }
  setScale(scale: number) { this.image.setScale(scale); }
  setAlpha(alpha: number) { this.image.setAlpha(alpha); }
  setAngle(angle: number) { this.image.setAngle(angle); }
}

/**
 * Placeholder animation adapter. It only translates and rotates the complete reference image;
 * no missing frames are synthesized and the art is never stretched.
 */
export class PlayerAnimator {
  private state: PlayerAnimationState = 'idle';
  private stateUntil = 0;
  private facing = 1;
  private lastPose = '';
  private directionalTexture = 'leek-placeholder-front';
  private readonly priority: Record<PlayerAnimationState, number> = {
    idle: 0,
    walk: 1,
    attack: 2,
    dash: 3,
    hurt: 4,
    death: 5,
  };

  constructor(
    private scene: Phaser.Scene,
    private visual: Phaser.GameObjects.Image,
  ) {}

  update(time: number, movement: Phaser.Math.Vector2, dashing: boolean, facing: number) {
    this.facing = facing;
    const moving = movement.lengthSq() > 0;
    const vertical = Math.abs(movement.y) > Math.abs(movement.x) * 0.72;
    const direction = vertical ? (movement.y < 0 ? 'up' : 'down') : 'side';

    if (time >= this.stateUntil) this.state = dashing ? 'dash' : moving ? 'walk' : 'idle';

    const phase = time * (this.state === 'walk' ? 0.014 : 0.0045);
    if (this.state === 'idle') {
      this.setPose('leek-placeholder-front', undefined, 0.2);
      this.visual.setFlipX(facing < 0);
      this.visual.y = Math.sin(phase) * 1.5;
      this.visual.angle = Math.sin(phase * 0.65) * 0.8;
    } else if (this.state === 'walk') {
      if (direction === 'up') {
        this.directionalTexture = 'leek-back';
        this.setPose(this.directionalTexture, undefined, 0.2);
      } else if (direction === 'down') {
        this.directionalTexture = 'leek-placeholder-front';
        this.setPose(this.directionalTexture, undefined, 0.2);
      } else {
        this.directionalTexture = 'leek-profile';
        this.setPose(this.directionalTexture, undefined, 0.2);
      }
      this.visual.setFlipX(direction === 'side' && movement.x < 0);
      this.visual.y = Math.abs(Math.sin(phase)) * -3;
      this.visual.x = Math.sin(phase * 0.5) * 1.4;
      this.visual.angle = Math.sin(phase) * (direction === 'side' ? 1.4 : 2.2);
    } else if (this.state === 'dash') {
      this.setPose('leek-actions', 'dash', 0.46);
      this.visual.setFlipX(facing < 0);
      this.visual.y = 0;
      this.visual.angle = 9 * this.facing;
    }
  }

  dash(time: number, duration: number) {
    this.transition('dash', time + duration);
  }

  attack(time: number) {
    if (!this.transition('attack', time + 90)) return;
    // Keep the complete directional body. The action reference is a sheet, not a compatible
    // runtime frame, so swapping to it made the character pop, shrink and lose its silhouette.
    this.setPose(this.directionalTexture, undefined, 0.2);
    this.scene.tweens.killTweensOf(this.visual);
    const originX = this.visual.x;
    this.scene.tweens.add({
      targets: this.visual,
      x: originX - 4 * this.facing,
      angle: -4 * this.facing,
      duration: 35,
      yoyo: true,
      ease: 'Quad.Out',
      onComplete: () => {
        this.visual.x = originX;
      },
    });
  }

  hurt(time: number) {
    if (!this.transition('hurt', time + 130)) return;
    this.scene.tweens.add({
      targets: this.visual,
      x: { from: -3, to: 3 },
      duration: 28,
      repeat: 3,
      yoyo: true,
      onComplete: () => {
        this.visual.x = 0;
      },
    });
  }

  death(time: number) {
    if (!this.transition('death', time + 700)) return;
    this.scene.tweens.killTweensOf(this.visual);
    this.scene.tweens.add({
      targets: this.visual,
      alpha: 0,
      angle: 18 * this.facing,
      scale: 0.16,
      duration: 700,
      ease: 'Quad.In',
    });
  }

  private transition(next: PlayerAnimationState, until: number) {
    if (this.priority[next] < this.priority[this.state] && until <= this.stateUntil) return false;
    this.state = next;
    this.stateUntil = until;
    return true;
  }

  private setPose(texture: string, frame: string | undefined, scale: number) {
    const pose = `${texture}:${frame ?? 'base'}`;
    if (pose === this.lastPose) return;
    this.lastPose = pose;
    this.visual.setTexture(texture, frame).setScale(scale).setPosition(0, 0);
  }
}
