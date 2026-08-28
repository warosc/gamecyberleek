import Phaser from 'phaser';
import { PLAYER_RIG_LAYERS, type PlayerRigLayer } from './PlayerRigManifest';
import type { PlayerAnimationState, PlayerVisualAdapter } from './PlayerAnimator';

type Keyframe = { timeMs: number; layers?: Partial<Record<PlayerRigLayer, { x?: number; y?: number; rotation?: number; alpha?: number }>> };
type AnimationData = { loop?: boolean; durationMs?: number; keyframes?: Keyframe[] };

/** Runtime layered renderer. It is only created when every validated layer texture exists. */
export class LayeredPlayerRig extends Phaser.GameObjects.Container implements PlayerVisualAdapter {
  private readonly layers = new Map<PlayerRigLayer, Phaser.GameObjects.Image>();
  private readonly animations = new Map<PlayerAnimationState, AnimationData>();

  static create(scene: Phaser.Scene) {
    if (!PLAYER_RIG_LAYERS.every((layer) => scene.textures.exists(`rig-${layer}`))) return undefined;
    return new LayeredPlayerRig(scene);
  }

  private constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    scene.add.existing(this);
    for (const layer of PLAYER_RIG_LAYERS) {
      const image = scene.add.image(0, 0, `rig-${layer}`).setScale(0.2);
      this.layers.set(layer, image);
      this.add(image);
    }
    for (const state of ['idle', 'walk', 'attack', 'dash', 'hurt', 'death'] as PlayerAnimationState[]) {
      const data = scene.cache.json.get(`rig-anim-${state}`) as AnimationData | undefined;
      if (data) this.animations.set(state, data);
    }
  }

  setPose() {}
  setFlipX(flip: boolean) { this.scaleX = flip ? -Math.abs(this.scaleX) : Math.abs(this.scaleX); }
  setPosition(x?: number, y?: number) { super.setPosition(x, y); return this; }
  setScale(scale: number) { super.setScale(scale); return this; }
  setAlpha(alpha: number) { super.setAlpha(alpha); return this; }
  setAngle(angle: number) { super.setAngle(angle); return this; }

  setAnimationState(state: PlayerAnimationState, time: number) {
    const animation = this.animations.get(state);
    if (!animation?.keyframes?.length) return;
    const duration = animation.durationMs ?? 1;
    const local = animation.loop ? time % duration : Math.min(time, duration);
    const frame = [...animation.keyframes].reverse().find((candidate) => candidate.timeMs <= local) ?? animation.keyframes[0];
    for (const layer of PLAYER_RIG_LAYERS) {
      const image = this.layers.get(layer)!;
      const transform = frame.layers?.[layer];
      image.setPosition(transform?.x ?? 0, transform?.y ?? 0);
      image.setRotation(transform?.rotation ?? 0);
      image.setAlpha(transform?.alpha ?? 1);
    }
  }
}
