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
});
