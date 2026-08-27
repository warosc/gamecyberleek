import Phaser from 'phaser';

export type PlayerAnimationState = 'idle' | 'walk' | 'dash' | 'attack' | 'hurt' | 'death';

/**
 * Placeholder animation adapter. It only translates and rotates the complete reference image;
 * no missing frames are synthesized and the art is never stretched.
 */
export class PlayerAnimator {
  private state: PlayerAnimationState = 'idle';
  private stateUntil = 0;
  private facing = 1;
  private lastPose = '';

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
      if (direction === 'up') this.setPose('leek-back', undefined, 0.2);
      else if (direction === 'down') this.setPose('leek-placeholder-front', undefined, 0.2);
      else this.setPose('leek-profile', undefined, 0.2);
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
    this.state = 'dash';
    this.stateUntil = time + duration;
  }

  attack(time: number) {
    this.state = 'attack';
    this.stateUntil = time + 90;
    this.setPose('leek-actions', 'attack', 0.38);
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
    this.state = 'hurt';
    this.stateUntil = time + 130;
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

  private setPose(texture: string, frame: string | undefined, scale: number) {
    const pose = `${texture}:${frame ?? 'base'}`;
    if (pose === this.lastPose) return;
    this.lastPose = pose;
    this.visual.setTexture(texture, frame).setScale(scale).setPosition(0, 0);
  }
}
