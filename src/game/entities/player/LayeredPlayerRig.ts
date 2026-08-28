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
    const phase = time * (state === 'walk' ? 0.014 : 0.0045);
    this.y = state === 'walk' ? Math.abs(Math.sin(phase)) * -6 : Math.sin(phase) * 3;
    this.rotation = state === 'walk' ? Math.sin(phase) * 0.04 : Math.sin(phase * 0.65) * 0.02;
    const frameIndex = animation.keyframes.reduce(
      (index, candidate, current) => (candidate.timeMs <= local ? current : index),
      0,
    );
    const frame = animation.keyframes[frameIndex];
    const next = animation.keyframes[Math.min(frameIndex + 1, animation.keyframes.length - 1)];
    const span = Math.max(1, next.timeMs - frame.timeMs);
    const blend = next === frame ? 0 : Phaser.Math.Clamp((local - frame.timeMs) / span, 0, 1);
    for (const layer of PLAYER_RIG_LAYERS) {
      const image = this.layers.get(layer)!;
      const transform = frame.layers?.[layer];
      const following = next.layers?.[layer];
      const value = (key: 'x' | 'y' | 'rotation' | 'alpha', fallback: number) =>
        Phaser.Math.Linear(transform?.[key] ?? fallback, following?.[key] ?? transform?.[key] ?? fallback, blend);
      image.setPosition(value('x', 0), value('y', 0));
      image.setRotation(value('rotation', 0));
      image.setAlpha(value('alpha', 1));
    }
  }
}
