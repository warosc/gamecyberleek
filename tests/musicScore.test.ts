import { describe, expect, it } from 'vitest';
import { musicCue, musicStepDuration, type MusicState } from '../src/game/audio/MusicScore';

const states: MusicState[] = ['menu', 'combat', 'danger', 'boss'];

describe('procedural music score', () => {
  it('accelerates as the operation becomes more dangerous', () => {
    expect(musicStepDuration('menu')).toBeGreaterThan(musicStepDuration('combat'));
    expect(musicStepDuration('combat')).toBeGreaterThan(musicStepDuration('danger'));
    expect(musicStepDuration('danger')).toBeGreaterThan(musicStepDuration('boss'));
  });

  it('generates deterministic, restrained and audible cues', () => {
    for (const state of states) {
      const sequence = Array.from({ length: 8 }, (_, step) => musicCue(state, step));
      expect(sequence).toEqual(Array.from({ length: 8 }, (_, step) => musicCue(state, step)));
      expect(sequence.flat().length).toBeGreaterThan(0);
      for (const tone of sequence.flat()) {
        expect(tone.frequency).toBeGreaterThanOrEqual(38);
        expect(tone.frequency).toBeLessThan(1000);
        expect(tone.volume).toBeLessThanOrEqual(0.02);
      }
    }
  });

  it('gives the boss its own low percussive accent', () => {
    expect(musicCue('boss', 0)).toHaveLength(3);
    expect(musicCue('combat', 0)).toHaveLength(2);
  });

  it('keys each sector differently while staying in audible range', () => {
    const roots = [0, 1, 2].map(sector => musicCue('combat', 0, { sector })[0].frequency);
    expect(new Set(roots).size).toBe(3);
    for (const sector of [0, 1, 2])
      for (const state of states)
        for (let step = 0; step < 16; step++)
          for (const tone of musicCue(state, step, { sector, intensity: 2 })) {
            expect(tone.frequency).toBeGreaterThanOrEqual(38);
            expect(tone.frequency).toBeLessThan(1000);
            expect(tone.volume).toBeLessThanOrEqual(0.02);
          }
  });

  it('layers more voices as intensity rises, but never on the menu', () => {
    const voices = (intensity: number) =>
      Array.from({ length: 8 }, (_, step) => musicCue('combat', step, { intensity }).length).reduce((a, b) => a + b);
    expect(voices(1)).toBeGreaterThan(voices(0));
    expect(voices(2)).toBeGreaterThan(voices(1));
    expect(musicCue('menu', 1, { intensity: 2 })).toEqual(musicCue('menu', 1));
  });

  it('answers each phrase with a varied second half', () => {
    const first = Array.from({ length: 8 }, (_, step) => musicCue('combat', step));
    const second = Array.from({ length: 8 }, (_, step) => musicCue('combat', step + 8));
    expect(second).not.toEqual(first);
  });
});
