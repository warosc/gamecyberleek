export type MusicState = 'menu' | 'combat' | 'danger' | 'boss';

export interface MusicTone {
  frequency: number;
  durationS: number;
  volume: number;
  type: OscillatorType;
  delayMs?: number;
}

interface MusicPattern {
  stepMs: number;
  bass: readonly number[];
  lead: readonly number[];
}

const REST = 0;
const PATTERNS: Record<MusicState, MusicPattern> = {
  menu: {
    stepMs: 500,
    bass: [55, REST, 55, REST, 65.41, REST, 49, REST],
    lead: [220, REST, 261.63, REST, 246.94, REST, 196, REST],
  },
  combat: {
    stepMs: 375,
    bass: [55, REST, 55, 65.41, 55, REST, 73.42, 49],
    lead: [220, REST, 261.63, REST, 293.66, 261.63, REST, 196],
  },
  danger: {
    stepMs: 300,
    bass: [55, 55, 65.41, 55, 73.42, 65.41, 49, 55],
    lead: [220, REST, 261.63, 293.66, REST, 329.63, 293.66, 246.94],
  },
  boss: {
    stepMs: 250,
    bass: [41.2, 41.2, 46.25, 41.2, 55, 51.91, 46.25, 38.89],
    lead: [164.81, REST, 174.61, 196, 207.65, REST, 196, 174.61],
  },
};

export function musicStepDuration(state: MusicState) {
  return PATTERNS[state].stepMs;
}

/** Original deterministic score assembled from short Web Audio notes. */
export function musicCue(state: MusicState, step: number): MusicTone[] {
  const pattern = PATTERNS[state];
  const index = ((step % pattern.bass.length) + pattern.bass.length) % pattern.bass.length;
  const tones: MusicTone[] = [];
  const bass = pattern.bass[index];
  const lead = pattern.lead[index];
  if (bass) tones.push({ frequency: bass, durationS: state === 'boss' ? 0.2 : 0.28, volume: 0.018, type: 'sawtooth' });
  if (lead) tones.push({ frequency: lead, durationS: 0.12, volume: state === 'menu' ? 0.009 : 0.012, type: 'triangle', delayMs: 24 });
  if (state === 'boss' && index % 4 === 0)
    tones.push({ frequency: 82.41, durationS: 0.08, volume: 0.012, type: 'square', delayMs: 110 });
  return tones;
}
