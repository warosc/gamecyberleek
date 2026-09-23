export type MusicState = 'menu' | 'combat' | 'danger' | 'boss';

export interface MusicTone {
  frequency: number;
  durationS: number;
  volume: number;
  type: OscillatorType;
  delayMs?: number;
}

/** What the score adapts to beyond the run state. */
export interface MusicContext {
  /** Sector index: each sector has its own key and voicing. */
  sector?: number;
  /** 0 calm, 1 a kill chain is running, 2 a high chain: adds a pulse and doubles the lead. */
  intensity?: number;
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

/**
 * Sector identities: the lab keeps the original voicing, the greenhouse moves up a tone with
 * softer waves, and the reactor sits a fourth higher with a hard bass and an icy top note.
 * Transpositions only go up so the lowest boss note never drops below audible range.
 */
const SECTOR_VOICES = [
  { semitones: 0, bass: 'sawtooth', lead: 'triangle', sparkle: false },
  { semitones: 2, bass: 'triangle', lead: 'sine', sparkle: false },
  { semitones: 5, bass: 'square', lead: 'triangle', sparkle: true },
] as const satisfies readonly { semitones: number; bass: OscillatorType; lead: OscillatorType; sparkle: boolean }[];

export function musicStepDuration(state: MusicState) {
  return PATTERNS[state].stepMs;
}

/**
 * Original deterministic score assembled from short Web Audio notes. Every 16 steps the second
 * half answers the first with a rotated lead, so a phrase does not loop identically.
 */
export function musicCue(state: MusicState, step: number, context: MusicContext = {}): MusicTone[] {
  const pattern = PATTERNS[state];
  const length = pattern.bass.length;
  const index = ((step % length) + length) % length;
  const answer = state !== 'menu' && ((step % (length * 2)) + length * 2) % (length * 2) >= length;
  const voice = SECTOR_VOICES[Math.min(Math.max(context.sector ?? 0, 0), SECTOR_VOICES.length - 1)];
  const shift = 2 ** (voice.semitones / 12);
  const intensity = state === 'menu' ? 0 : Math.min(Math.max(context.intensity ?? 0, 0), 2);
  const tones: MusicTone[] = [];
  const bass = pattern.bass[index];
  const lead = pattern.lead[answer ? (index + 2) % length : index];
  if (bass) tones.push({ frequency: bass * shift, durationS: state === 'boss' ? 0.2 : 0.28, volume: 0.018, type: voice.bass });
  if (lead) {
    tones.push({ frequency: lead * shift, durationS: 0.12, volume: state === 'menu' ? 0.009 : 0.012, type: voice.lead, delayMs: 24 });
    if (intensity >= 2) tones.push({ frequency: lead * shift * 2, durationS: 0.08, volume: 0.006, type: 'triangle', delayMs: 40 });
  }
  if (state === 'boss' && index % 4 === 0)
    tones.push({ frequency: 82.41 * shift, durationS: 0.08, volume: 0.012, type: 'square', delayMs: 110 });
  if (intensity >= 1 && index % 2 === 1)
    tones.push({ frequency: 880, durationS: 0.02, volume: 0.005, type: 'square', delayMs: 12 });
  if (voice.sparkle && state !== 'menu' && index === 0)
    tones.push({ frequency: 987.77, durationS: 0.05, volume: 0.004, type: 'sine', delayMs: 180 });
  return tones;
}
