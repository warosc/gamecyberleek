import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  RigAnimationClock,
  rigPlayhead,
  sampleRigAnimation,
  type RigAnimationData,
} from '../src/game/entities/player/PlayerRigAnimation';

const root = resolve(process.cwd(), 'public/assets/character/leek/rig/animations');
const load = (state: string) =>
  JSON.parse(readFileSync(resolve(root, `${state}.json`), 'utf8')) as RigAnimationData;

describe('rig animation clock', () => {
  it('restarts a one-shot entered late in a run', () => {
    // Regression: the rig sampled its animations with absolute gameplay time, so
    // `min(time, duration)` was already past the last keyframe seconds into a run. Attack,
    // dash, hurt and death were permanently pinned to their final pose and never played.
    const clock = new RigAnimationClock();
    clock.elapsed('idle', 240_000);
    expect(clock.elapsed('attack', 240_000)).toBe(0);
    expect(clock.elapsed('attack', 240_060)).toBe(60);
  });

  it('keeps timing the same state across frames', () => {
    const clock = new RigAnimationClock();
    clock.elapsed('walk', 1_000);
    expect(clock.elapsed('walk', 1_400)).toBe(400);
    expect(clock.current).toBe('walk');
  });

  it('restarts again when the same state is re-entered after another', () => {
    const clock = new RigAnimationClock();
    clock.elapsed('attack', 5_000);
    clock.elapsed('idle', 5_300);
    expect(clock.elapsed('attack', 5_400)).toBe(0);
  });
});

describe('rig playhead', () => {
  it('wraps a looping animation and clamps a one-shot', () => {
    const looping: RigAnimationData = { loop: true, durationMs: 600, keyframes: [] };
    const oneShot: RigAnimationData = { loop: false, durationMs: 240, keyframes: [] };
    expect(rigPlayhead(looping, 1_500)).toBe(300);
    expect(rigPlayhead(oneShot, 1_500)).toBe(240);
    expect(rigPlayhead(oneShot, 100)).toBe(100);
  });
});

describe('rig animation sampling', () => {
  const animation: RigAnimationData = {
    loop: false,
    durationMs: 100,
    keyframes: [
      { timeMs: 0, layers: { torso: { rotation: 0, y: 0 } } },
      { timeMs: 100, layers: { torso: { rotation: 1, y: 10 } } },
    ],
  };

  it('interpolates between the surrounding keyframes', () => {
    expect(sampleRigAnimation(animation, 50).get('torso')).toEqual({
      x: 0,
      y: 5,
      rotation: 0.5,
      alpha: 1,
    });
  });

  it('holds the final keyframe once a one-shot has finished', () => {
    expect(sampleRigAnimation(animation, 400).get('torso')?.rotation).toBe(1);
  });

  it('omits layers no keyframe mentions so they keep their rest pose', () => {
    expect(sampleRigAnimation(animation, 50).has('hand-left')).toBe(false);
  });
});

describe('shipped animation content', () => {
  it('lifts one leg at a time and swaps across the half cycle', () => {
    // The product requirement is leg opposition, not merely "something moves". Left and right
    // are mirror images, so opposition shows up in which foot leaves the ground, not in the
    // sign of a raw screen rotation.
    const walk = load('walk');
    const half = (walk.durationMs ?? 600) / 2;
    const first = sampleRigAnimation(walk, 0);
    const second = sampleRigAnimation(walk, half);
    expect(first.get('thigh-right')!.y).toBeLessThan(0);
    expect(first.get('thigh-left')!.y).toBe(0);
    expect(second.get('thigh-left')!.y).toBeLessThan(0);
    expect(second.get('thigh-right')!.y).toBe(0);
    // The lifted leg's knee is the flexed one.
    expect(Math.abs(first.get('leg-right')!.rotation)).toBeGreaterThan(
      Math.abs(first.get('leg-left')!.rotation),
    );
  });

  it('swings the arms in counter-phase to the legs', () => {
    const walk = load('walk');
    const frame = sampleRigAnimation(walk, 0);
    // Undo the left/right mirror so "swung outward" is comparable on both sides.
    const leftArm = frame.get('arm-left-upper')!.rotation;
    const rightArm = -frame.get('arm-right-upper')!.rotation;
    expect(Math.sign(leftArm)).toBe(-Math.sign(rightArm));
    // At time 0 the right leg is lifted, so the left arm is the one swung out.
    expect(leftArm).toBeGreaterThan(0);
    expect(frame.get('thigh-right')!.y).toBeLessThan(0);
  });

  it('recoils the weapon arm during the attack and returns it to rest', () => {
    const attack = load('attack');
    const peak = sampleRigAnimation(attack, 50);
    expect(peak.get('arm-right-upper')!.rotation).toBeLessThan(-0.2);
    const settled = sampleRigAnimation(attack, attack.durationMs ?? 240);
    expect(settled.get('arm-right-upper')!.rotation).toBe(0);
  });

  it('gives the dash anticipation, travel and recovery in that order', () => {
    const dash = load('dash');
    const anticipation = sampleRigAnimation(dash, 40).get('torso')!.rotation;
    const travel = sampleRigAnimation(dash, 130).get('torso')!.rotation;
    const recovery = sampleRigAnimation(dash, 200).get('torso')!.rotation;
    // Coil back, drive forward, then settle near neutral.
    expect(anticipation).toBeLessThan(0);
    expect(travel).toBeGreaterThan(0.1);
    expect(Math.abs(recovery)).toBeLessThan(Math.abs(travel));
  });

  it('breathes on a calm idle cycle rather than a hurried one', () => {
    const idle = load('idle');
    expect(idle.loop).toBe(true);
    expect(idle.durationMs).toBeGreaterThanOrEqual(2000);
  });
});
