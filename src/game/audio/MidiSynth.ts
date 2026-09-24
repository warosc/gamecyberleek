/**
 * Web Audio voices for the soundtrack's tracks. Track names match the FL Studio template
 * channels the composer writes to; anything unknown plays as a soft lead.
 */
let noise: AudioBuffer | undefined;

function noiseBuffer(context: BaseAudioContext) {
  if (noise && noise.sampleRate === context.sampleRate) return noise;
  noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const data = noise.getChannelData(0);
  // Deterministic LCG noise: the same drum sound every session.
  let seed = 1234567;
  for (let index = 0; index < data.length; index++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    data[index] = (seed / 0x7fffffff) * 2 - 1;
  }
  return noise;
}

const frequency = (pitch: number) => 440 * 2 ** ((pitch - 69) / 12);

function envelope(context: BaseAudioContext, when: number, peak: number, attack: number, hold: number, release: number) {
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), when + attack);
  gain.gain.setValueAtTime(Math.max(peak, 0.0002), when + attack + hold);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + attack + hold + release);
  return gain;
}

function oscillator(context: BaseAudioContext, type: OscillatorType, hz: number, when: number, stop: number, detune = 0) {
  const osc = context.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(hz, when);
  osc.detune.value = detune;
  osc.start(when);
  osc.stop(stop);
  return osc;
}

function noiseHit(context: BaseAudioContext, out: AudioNode, when: number, peak: number, decay: number, filter: BiquadFilterType, hz: number) {
  const source = context.createBufferSource();
  source.buffer = noiseBuffer(context);
  const shape = context.createBiquadFilter();
  shape.type = filter;
  shape.frequency.value = hz;
  const gain = envelope(context, when, peak, 0.002, 0, decay);
  source.connect(shape).connect(gain).connect(out);
  source.start(when, Math.random() * 0.5);
  source.stop(when + decay + 0.05);
}

function drum(context: BaseAudioContext, out: AudioNode, pitch: number, velocity: number, when: number) {
  const v = velocity;
  if (pitch === 35 || pitch === 36) {
    const osc = oscillator(context, 'sine', 150, when, when + 0.3);
    osc.frequency.exponentialRampToValueAtTime(42, when + 0.12);
    osc.connect(envelope(context, when, 0.5 * v, 0.002, 0.02, 0.22)).connect(out);
  } else if (pitch === 38 || pitch === 40) {
    noiseHit(context, out, when, 0.16 * v, 0.14, 'bandpass', 1900);
    oscillator(context, 'triangle', 185, when, when + 0.12).connect(envelope(context, when, 0.12 * v, 0.002, 0, 0.08)).connect(out);
  } else if (pitch === 39) {
    for (const offset of [0, 0.012, 0.024]) noiseHit(context, out, when + offset, 0.1 * v, 0.09, 'bandpass', 1400);
  } else if (pitch === 42 || pitch === 44) {
    noiseHit(context, out, when, 0.05 * v, 0.035, 'highpass', 7500);
  } else if (pitch === 46) {
    noiseHit(context, out, when, 0.05 * v, 0.22, 'highpass', 6500);
  } else if (pitch === 49 || pitch === 57) {
    noiseHit(context, out, when, 0.06 * v, 0.9, 'highpass', 4500);
  } else if (pitch === 70) {
    noiseHit(context, out, when, 0.035 * v, 0.05, 'highpass', 5500);
  } else {
    // Toms and congas: a pitched sine drop, higher notes for higher drums.
    const start = pitch >= 60 ? 340 : pitch >= 48 ? 220 : 150;
    const osc = oscillator(context, 'sine', start, when, when + 0.3);
    osc.frequency.exponentialRampToValueAtTime(start * 0.6, when + 0.18);
    osc.connect(envelope(context, when, 0.22 * v, 0.003, 0, 0.2)).connect(out);
  }
}

export type TrackVoice = 'drums' | 'perc' | 'sub' | 'bass' | 'pad' | 'arp' | 'lead' | 'riser';

export function voiceFor(name: string, channel: number): TrackVoice {
  const key = name.toLowerCase();
  if (key.includes('perc')) return 'perc';
  if (channel === 9 || key.includes('drum')) return 'drums';
  if (key.includes('sub')) return 'sub';
  if (key.includes('bass')) return 'bass';
  if (key.includes('pad') || key.includes('chord')) return 'pad';
  if (key.includes('arp') || key.includes('pluck')) return 'arp';
  if (key.includes('riser')) return 'riser';
  return 'lead';
}

/**
 * Dynamic-mix layer of a voice: 0 always plays, 1 joins when a run heats up, 2 is the
 * foreground melody that marks peak intensity.
 */
export const VOICE_LAYER: Record<TrackVoice, 0 | 1 | 2> = {
  drums: 0, sub: 0, bass: 0, pad: 0, arp: 1, perc: 1, lead: 2, riser: 2,
};

/** Schedules one note. `out` is the music bus; loudness is balanced across voices here. */
export function playVoice(
  context: BaseAudioContext, out: AudioNode, voice: TrackVoice, pitch: number, velocity: number, when: number, duration: number,
) {
  const hz = frequency(pitch);
  const end = when + duration;
  switch (voice) {
    case 'drums':
    case 'perc':
      drum(context, out, pitch, velocity, when);
      return;
    case 'sub':
      oscillator(context, 'sine', hz, when, end + 0.1).connect(envelope(context, when, 0.16 * velocity, 0.01, Math.max(0, duration - 0.06), 0.08)).connect(out);
      return;
    case 'bass': {
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 5;
      filter.frequency.setValueAtTime(1400, when);
      filter.frequency.exponentialRampToValueAtTime(420, when + Math.min(0.2, duration));
      oscillator(context, 'sawtooth', hz, when, end + 0.08).connect(filter)
        .connect(envelope(context, when, 0.07 * velocity, 0.005, Math.max(0, duration - 0.05), 0.06)).connect(out);
      return;
    }
    case 'pad': {
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1500;
      const gain = envelope(context, when, 0.022 * velocity, Math.min(0.3, duration / 3), Math.max(0, duration - 0.35), 0.45);
      filter.connect(gain).connect(out);
      for (const detune of [-8, 8]) oscillator(context, 'sawtooth', hz, when, end + 0.5, detune).connect(filter);
      return;
    }
    case 'arp': {
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3200, when);
      filter.frequency.exponentialRampToValueAtTime(700, when + 0.16);
      oscillator(context, 'square', hz, when, when + 0.25).connect(filter)
        .connect(envelope(context, when, 0.028 * velocity, 0.003, 0, Math.min(0.2, duration + 0.05))).connect(out);
      return;
    }
    case 'riser':
      oscillator(context, 'sine', hz, when, end + 0.1).connect(envelope(context, when, 0.03 * velocity, 0.02, Math.max(0, duration - 0.04), 0.06)).connect(out);
      return;
    default: {
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2800;
      const gain = envelope(context, when, 0.04 * velocity, 0.012, Math.max(0, duration - 0.08), 0.12);
      filter.connect(gain).connect(out);
      oscillator(context, 'sawtooth', hz, when, end + 0.15, -4).connect(filter);
      oscillator(context, 'square', hz, when, end + 0.15, 5).connect(filter);
    }
  }
}
