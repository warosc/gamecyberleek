import Phaser from 'phaser';
import { AUDIO_EVENTS, type AudioEventId } from '../audio/AudioEvents';
import { musicCue, musicStepDuration, type MusicContext, type MusicState } from '../audio/MusicScore';
import type { MidiSong } from '../audio/MidiFile';
import { MusicDirector, SECTOR_CUES, layerFor, type CueManifestEntry, type MusicCue } from '../audio/MusicDirector';

/**
 * One AudioContext for the whole game, created on the first user gesture that reaches any
 * scene and never replaced.
 *
 * A context per `GameScene` leaked one on every restart, and browsers cap concurrent contexts
 * per document — iOS Safari most tightly — so repeated runs eventually failed with
 * "Failed to start the audio device" and lost audio for the rest of the session.
 */
let context: AudioContext | undefined;
const audioContext = () => context;
let masterGain: GainNode | undefined;
let masterVolume = 0.8;
/** Music has its own bus so it can be ducked and follow the music volume as a whole. */
let musicBus: GainNode | undefined;
let director: MusicDirector | undefined;
let musicLightweight = false;
const registeredSongs = new Map<MusicCue, { song: MidiSong; entry?: CueManifestEntry }>();
const MUSIC_BASE_URL = 'assets/music/';

/** Songs parsed at preload; they reach the director as soon as an AudioContext exists. */
export function registerMusic(cue: MusicCue, song: MidiSong, entry?: CueManifestEntry) {
  registeredSongs.set(cue, { song, entry });
  director?.register(cue, song, entry, MUSIC_BASE_URL);
}

export function setMusicLightweight(lightweight: boolean) {
  musicLightweight = lightweight;
  director?.setLightweight(lightweight);
}
const categoryVolumes: Record<AudioCategory, number> = { sfx: 1, ui: 1, ambience: 0.55 };

export type AudioCategory = 'sfx' | 'ui' | 'ambience';

/** Persisted mixer levels. `ambience` carries the procedural music; UI follows effects. */
export function setAudioPreferences(master: number, music: number, sfx: number) {
  masterVolume = Math.min(1, Math.max(0, master));
  if (masterGain) masterGain.gain.value = masterVolume;
  categoryVolumes.ambience = Math.min(1, Math.max(0, music));
  categoryVolumes.sfx = Math.min(1, Math.max(0, sfx));
  categoryVolumes.ui = categoryVolumes.sfx;
}

function unlock() {
  if (context) {
    void context.resume().catch(() => undefined);
    return;
  }
  try {
    context = new AudioContext();
    masterGain = context.createGain();
    masterGain.gain.value = masterVolume;
    masterGain.connect(context.destination);
    musicBus = context.createGain();
    musicBus.gain.value = categoryVolumes.ambience;
    musicBus.connect(masterGain);
    director = new MusicDirector(context, musicBus);
    director.setLightweight(musicLightweight);
    for (const [cue, { song, entry }] of registeredSongs) director.register(cue, song, entry, MUSIC_BASE_URL);
  } catch {
    // Audio is optional; a browser refusing a context must never interrupt a run.
    return;
  }
  // Safari can hand back a suspended context even inside a gesture.
  void context.resume().catch(() => undefined);
}

export class AudioManager {
  private lastPlayed = new Map<AudioEventId, number>();
  private musicState?: MusicState;
  private musicStep = 0;
  private nextMusicAt = 0;
  private duckUntil = 0;
  private duckLevel = 1;
  constructor(scene: Phaser.Scene) {
    // Re-arm per scene only while no context exists: a run where the player never taps
    // leaves nothing behind, and the next run gets another chance to unlock.
    scene.input.once('pointerdown', unlock);
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

  /**
   * Pulls the music under an important cue (boss arrival, phase change) so the cue reads,
   * then lets it return on its own. Wall-clock based: a duck is about what the player hears.
   */
  duck(durationMs: number, level = 0.35) {
    this.duckUntil = performance.now() + durationMs;
    this.duckLevel = Math.min(Math.max(level, 0), 1);
  }

  /** Victory / defeat sting over silence; returns false when the soundtrack is not loaded. */
  playStinger(cue: 'victory' | 'defeat') {
    if (!context || context.state !== 'running' || !musicBus) return false;
    musicBus.gain.setTargetAtTime(categoryVolumes.ambience, context.currentTime, 0.02);
    return director?.playOnce(cue) ?? false;
  }

  updateMusic(gameTime: number, state: MusicState, context: MusicContext = {}) {
    const cue: MusicCue = state === 'menu' ? 'menu' : state === 'boss' ? 'boss'
      : SECTOR_CUES[Math.min(Math.max(context.sector ?? 0, 0), SECTOR_CUES.length - 1)];
    const running = audioContext();
    if (director?.has(cue) && musicBus && running?.state === 'running') {
      const duck = performance.now() < this.duckUntil ? this.duckLevel : 1;
      musicBus.gain.setTargetAtTime(categoryVolumes.ambience * duck, running!.currentTime, 0.06);
      director.update(gameTime, cue, layerFor(state, context.intensity ?? 0));
      return;
    }
    if (this.musicState !== state) {
      this.musicState = state;
      this.musicStep = 0;
      this.nextMusicAt = gameTime;
    }
    if (gameTime < this.nextMusicAt) return;
    const duck = performance.now() < this.duckUntil ? this.duckLevel : 1;
    for (const note of musicCue(state, this.musicStep, context))
      this.tone(note.frequency, note.durationS, note.volume * duck, 'ambience', note.type, (note.delayMs ?? 0) / 1000);
    this.musicStep++;
    this.nextMusicAt = gameTime + musicStepDuration(state);
  }
}
