import type { AudioCategory } from '../managers/AudioManager';

/**
 * The complete set of gameplay moments that make a sound.
 *
 * Call sites emit these names, never raw frequencies, so replacing the procedural placeholder
 * voicing with original recorded audio is a change to this file and to `AudioManager.play`
 * alone. No copyrighted audio is imported: every event below is synthesised at runtime.
 */
export type AudioEventId =
  | 'charge_warning'
  | 'shot_warning'
  | 'enemy_melee'
  | 'enemy_charge'
  | 'enemy_shot'
  | 'boss_attack'
  | 'phase_change'
  | 'weapon_evolve'
  | 'combo_rise'
  | 'player_hit'
  | 'weapon_fire'
  | 'spore_fire'
  | 'arc_fire'
  | 'enemy_hit'
  | 'critical_hit'
  | 'enemy_death'
  | 'elite_death'
  | 'xp_collect'
  | 'level_up'
  | 'dash'
  | 'nova'
  | 'shield'
  | 'overdrive'
  | 'boss_spawn'
  | 'boss_phase'
  | 'boss_death'
  | 'victory'
  | 'game_over';

export interface AudioTone {
  frequency: number;
  durationS: number;
  volume: number;
  /** Offset from the event trigger, so an event can be a short motif rather than one beep. */
  delayMs?: number;
  type?: OscillatorType;
}

export interface AudioEventDefinition {
  category: AudioCategory;
  tones: AudioTone[];
}

/**
 * Placeholder voicing. Kept deliberately terse and quiet: these are stand-ins that must not
 * fatigue a playtester, and the mix is what the original audio pass will replace.
 */
export const AUDIO_EVENTS: Record<AudioEventId, AudioEventDefinition> = {
  charge_warning: { category: 'sfx', tones: [{ frequency: 330, durationS: 0.14, volume: 0.025, type: 'sawtooth' }] },
  shot_warning: { category: 'sfx', tones: [{ frequency: 860, durationS: 0.09, volume: 0.02, type: 'triangle' }] },
  enemy_melee: { category: 'sfx', tones: [{ frequency: 115, durationS: 0.08, volume: 0.035, type: 'square' }] },
  enemy_charge: { category: 'sfx', tones: [{ frequency: 185, durationS: 0.16, volume: 0.032, type: 'sawtooth' }] },
  enemy_shot: { category: 'sfx', tones: [{ frequency: 510, durationS: 0.07, volume: 0.027, type: 'square' }] },
  boss_attack: {
    category: 'sfx',
    tones: [
      { frequency: 62, durationS: 0.22, volume: 0.045, type: 'sawtooth' },
      { frequency: 124, durationS: 0.16, volume: 0.025, delayMs: 55, type: 'square' },
    ],
  },
  phase_change: {
    category: 'ui',
    tones: [
      { frequency: 294, durationS: 0.1, volume: 0.025, type: 'triangle' },
      { frequency: 440, durationS: 0.16, volume: 0.025, delayMs: 85, type: 'triangle' },
    ],
  },
  weapon_evolve: {
    category: 'ui',
    tones: [
      { frequency: 330, durationS: 0.16, volume: 0.035, type: 'triangle' },
      { frequency: 495, durationS: 0.18, volume: 0.034, delayMs: 120, type: 'triangle' },
      { frequency: 740, durationS: 0.3, volume: 0.032, delayMs: 250, type: 'sawtooth' },
    ],
  },
  combo_rise: {
    category: 'ui',
    tones: [
      { frequency: 540, durationS: 0.08, volume: 0.022, type: 'triangle' },
      { frequency: 680, durationS: 0.1, volume: 0.02, delayMs: 55, type: 'triangle' },
    ],
  },
  player_hit: { category: 'sfx', tones: [{ frequency: 80, durationS: 0.12, volume: 0.04, type: 'triangle' }] },
  weapon_fire: { category: 'sfx', tones: [{ frequency: 240, durationS: 0.025, volume: 0.015, type: 'square' }] },
  spore_fire: { category: 'sfx', tones: [{ frequency: 92, durationS: 0.14, volume: 0.035, type: 'sawtooth' }] },
  arc_fire: {
    category: 'sfx',
    tones: [
      { frequency: 390, durationS: 0.055, volume: 0.024, type: 'square' },
      { frequency: 780, durationS: 0.04, volume: 0.016, delayMs: 20, type: 'triangle' },
    ],
  },
  enemy_hit: { category: 'sfx', tones: [{ frequency: 135, durationS: 0.035, volume: 0.025, type: 'square' }] },
  // A critical reads as a hit plus a bright overtone, so it is recognisable without being louder.
  critical_hit: {
    category: 'sfx',
    tones: [
      { frequency: 180, durationS: 0.04, volume: 0.03, type: 'square' },
      { frequency: 720, durationS: 0.09, volume: 0.022, delayMs: 20, type: 'triangle' },
    ],
  },
  enemy_death: { category: 'sfx', tones: [{ frequency: 75, durationS: 0.09, volume: 0.025, type: 'square' }] },
  elite_death: {
    category: 'sfx',
    tones: [
      { frequency: 90, durationS: 0.14, volume: 0.032, type: 'square' },
      { frequency: 300, durationS: 0.12, volume: 0.02, delayMs: 50, type: 'triangle' },
    ],
  },
  xp_collect: { category: 'sfx', tones: [{ frequency: 520, durationS: 0.05, volume: 0.018, type: 'triangle' }] },
  level_up: {
    category: 'ui',
    tones: [
      { frequency: 620, durationS: 0.11, volume: 0.035, type: 'triangle' },
      { frequency: 930, durationS: 0.16, volume: 0.032, delayMs: 90, type: 'triangle' },
    ],
  },
  dash: { category: 'sfx', tones: [{ frequency: 420, durationS: 0.07, volume: 0.016, type: 'sawtooth' }] },
  nova: {
    category: 'sfx',
    tones: [
      { frequency: 95, durationS: 0.24, volume: 0.045, type: 'square' },
      { frequency: 380, durationS: 0.2, volume: 0.022, delayMs: 40, type: 'triangle' },
    ],
  },
  shield: { category: 'sfx', tones: [{ frequency: 340, durationS: 0.18, volume: 0.03, type: 'triangle' }] },
  overdrive: {
    category: 'sfx',
    tones: [
      { frequency: 220, durationS: 0.2, volume: 0.032, type: 'sawtooth' },
      { frequency: 440, durationS: 0.22, volume: 0.024, delayMs: 70, type: 'sawtooth' },
    ],
  },
  boss_spawn: {
    category: 'ui',
    tones: [
      { frequency: 70, durationS: 0.5, volume: 0.05, type: 'square' },
      { frequency: 105, durationS: 0.42, volume: 0.04, delayMs: 220, type: 'square' },
    ],
  },
  boss_phase: { category: 'ui', tones: [{ frequency: 150, durationS: 0.16, volume: 0.035, type: 'square' }] },
  boss_death: {
    category: 'ui',
    tones: [
      { frequency: 120, durationS: 0.3, volume: 0.05, type: 'square' },
      { frequency: 240, durationS: 0.3, volume: 0.04, delayMs: 160, type: 'triangle' },
      { frequency: 480, durationS: 0.45, volume: 0.035, delayMs: 340, type: 'triangle' },
    ],
  },
  victory: {
    category: 'ui',
    tones: [
      { frequency: 520, durationS: 0.18, volume: 0.04, type: 'triangle' },
      { frequency: 660, durationS: 0.18, volume: 0.04, delayMs: 150, type: 'triangle' },
      { frequency: 880, durationS: 0.34, volume: 0.04, delayMs: 300, type: 'triangle' },
    ],
  },
  game_over: {
    category: 'ui',
    tones: [
      { frequency: 200, durationS: 0.26, volume: 0.04, type: 'square' },
      { frequency: 120, durationS: 0.42, volume: 0.038, delayMs: 200, type: 'square' },
    ],
  },
};

export const AUDIO_EVENT_IDS = Object.keys(AUDIO_EVENTS) as AudioEventId[];
