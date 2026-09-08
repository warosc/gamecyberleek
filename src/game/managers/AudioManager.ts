import Phaser from 'phaser';
import { AUDIO_EVENTS, type AudioEventId } from '../audio/AudioEvents';

/**
 * One AudioContext for the whole game, created on the first user gesture that reaches any
 * scene and never replaced.
 *
 * A context per `GameScene` leaked one on every restart, and browsers cap concurrent contexts
 * per document — iOS Safari most tightly — so repeated runs eventually failed with
 * "Failed to start the audio device" and lost audio for the rest of the session.
 */
let context: AudioContext | undefined;
let masterGain: GainNode | undefined;
let masterVolume = 0.8;
const categoryVolumes: Record<AudioCategory, number> = { sfx: 1, ui: 1, ambience: 1 };

export type AudioCategory = 'sfx' | 'ui' | 'ambience';

function unlock() {
  if (context) return;
  try {
    context = new AudioContext();
    masterGain = context.createGain();
    masterGain.gain.value = masterVolume;
    masterGain.connect(context.destination);
  } catch {
    // Audio is optional; a browser refusing a context must never interrupt a run.
    return;
  }
  // Safari can hand back a suspended context even inside a gesture.
  void context.resume().catch(() => undefined);
}

export class AudioManager {
  private lastPlayed = new Map<AudioEventId, number>();
  constructor(scene: Phaser.Scene) {
    // Re-arm per scene only while no context exists: a run where the player never taps
    // leaves nothing behind, and the next run gets another chance to unlock.
    if (!context) scene.input.once('pointerdown', unlock);
  }

  setMasterVolume(volume: number) {
    masterVolume = Phaser.Math.Clamp(volume, 0, 1);
    if (masterGain) masterGain.gain.value = masterVolume;
  }

  getMasterVolume() { return masterVolume; }

  setCategoryVolume(category: AudioCategory, volume: number) {
    categoryVolumes[category] = Phaser.Math.Clamp(volume, 0, 1);
  }

  tone(
    frequency: number,
    duration = 0.04,
    volume = 0.025,
    category: AudioCategory = 'sfx',
    type: OscillatorType = 'square',
    delayS = 0,
  ) {
    if (!context || context.state !== 'running') return;
    const start = context.currentTime + delayS;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    gain.gain.setValueAtTime(volume * categoryVolumes[category], start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(masterGain ?? context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  /**
   * Plays a named gameplay event. Call sites name the moment, not the frequency, so swapping in
   * original recorded audio later is confined to this method and `AUDIO_EVENTS`.
   */
  play(event: AudioEventId) {
    const now = performance.now();
    const gap = event.endsWith('warning') ? 220 : event === 'enemy_hit' || event === 'enemy_death' ? 65 : 20;
    if (now - (this.lastPlayed.get(event) ?? -10000) < gap) return;
    this.lastPlayed.set(event, now);
    const definition = AUDIO_EVENTS[event];
    if (!definition) return;
    for (const tone of definition.tones)
      this.tone(
        tone.frequency,
        tone.durationS,
        tone.volume,
        definition.category,
        tone.type ?? 'square',
        (tone.delayMs ?? 0) / 1000,
      );
  }
}
