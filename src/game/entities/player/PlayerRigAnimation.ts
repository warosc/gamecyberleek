import type { PlayerRigLayer } from './PlayerRigManifest';

export type RigLayerTransform = { x?: number; y?: number; rotation?: number; alpha?: number };
export type RigKeyframe = {
  timeMs: number;
  layers?: Partial<Record<PlayerRigLayer, RigLayerTransform>>;
};
export type RigAnimationData = { loop?: boolean; durationMs?: number; keyframes?: RigKeyframe[] };

export interface RigSampledLayer {
  x: number;
  y: number;
  rotation: number;
  alpha: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const lerp = (from: number, to: number, blend: number) => from + (to - from) * blend;

/**
 * Tracks when the current animation state was entered.
 *
 * The rig used to sample its animations with absolute gameplay time. For a looping animation that
 * is harmless, but for a one-shot it meant `min(time, duration)` was already past the last
 * keyframe a fraction of a second into the run, so attack, dash, hurt and death were permanently
 * pinned to their final pose and never played at all. Elapsed time has to be measured from the
 * moment the state was entered, which is what this clock exists to remember.
 */
export class RigAnimationClock {
  private state?: string;
  private startedAt = 0;

  /** Milliseconds since the given state was entered. Entering a new state restarts at zero. */
  elapsed(state: string, time: number) {
    if (state !== this.state) {
      this.state = state;
      this.startedAt = time;
    }
    return Math.max(0, time - this.startedAt);
  }

  /** The state this clock is currently timing, or undefined before the first call. */
  get current() {
    return this.state;
  }
}

/** Position within an animation for a given elapsed time, honouring loop or one-shot playback. */
export function rigPlayhead(animation: RigAnimationData, elapsed: number) {
  const duration = Math.max(1, animation.durationMs ?? 1);
  return animation.loop ? elapsed % duration : Math.min(Math.max(0, elapsed), duration);
}

/**
 * Interpolates the keyframes surrounding `elapsed` into a per-layer transform.
 *
 * A layer absent from both surrounding keyframes is omitted rather than reset, so an animation
 * only has to describe the layers it actually moves.
 */
export function sampleRigAnimation(
  animation: RigAnimationData,
  elapsed: number,
): Map<PlayerRigLayer, RigSampledLayer> {
  const sampled = new Map<PlayerRigLayer, RigSampledLayer>();
  const keyframes = animation.keyframes;
  if (!keyframes?.length) return sampled;

  const local = rigPlayhead(animation, elapsed);
  let index = 0;
  for (let candidate = 0; candidate < keyframes.length; candidate++)
    if (keyframes[candidate].timeMs <= local) index = candidate;
  const frame = keyframes[index];
  const next = keyframes[Math.min(index + 1, keyframes.length - 1)];
  const span = Math.max(1, next.timeMs - frame.timeMs);
  const blend = next === frame ? 0 : clamp((local - frame.timeMs) / span, 0, 1);

  const layers = new Set<PlayerRigLayer>([
    ...(Object.keys(frame.layers ?? {}) as PlayerRigLayer[]),
    ...(Object.keys(next.layers ?? {}) as PlayerRigLayer[]),
  ]);
  for (const layer of layers) {
    const from = frame.layers?.[layer];
    const to = next.layers?.[layer];
    const value = (key: keyof RigLayerTransform, fallback: number) =>
      lerp(from?.[key] ?? fallback, to?.[key] ?? from?.[key] ?? fallback, blend);
    sampled.set(layer, {
      x: value('x', 0),
      y: value('y', 0),
      rotation: value('rotation', 0),
      alpha: value('alpha', 1),
    });
  }
  return sampled;
}
