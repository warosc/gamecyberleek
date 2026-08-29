import { describe, expect, it } from 'vitest';
import {
  IMPACT_PROFILES,
  impactProfile,
  resolveImpactTier,
  type ImpactContext,
  type ImpactTier,
} from '../src/game/presentation/ImpactFeedback';
import { AUDIO_EVENTS, AUDIO_EVENT_IDS } from '../src/game/audio/AudioEvents';

const base: ImpactContext = { critical: false, boss: false, elite: false, fatal: false };

describe('impact tiers', () => {
  it('separates a graze, a critical and a boss hit', () => {
    expect(resolveImpactTier(base)).toBe('normal');
    expect(resolveImpactTier({ ...base, critical: true })).toBe('critical');
    expect(resolveImpactTier({ ...base, boss: true })).toBe('bossHit');
  });

  it('announces a kill as a death even when the killing blow was critical', () => {
    // The death is the more important thing that just happened; a "CRIT" flourish on a corpse
    // reads as a hit that failed to kill.
    expect(resolveImpactTier({ ...base, critical: true, fatal: true })).toBe('enemyDeath');
    expect(resolveImpactTier({ ...base, elite: true, fatal: true })).toBe('eliteDeath');
    expect(resolveImpactTier({ ...base, boss: true, elite: true, fatal: true })).toBe('bossDeath');
  });

  it('escalates feedback monotonically from a graze to a boss death', () => {
    // The whole point of the hierarchy: each step up must actually feel bigger.
    const ladder: ImpactTier[] = ['normal', 'critical', 'eliteDeath', 'bossDeath'];
    for (let step = 1; step < ladder.length; step++) {
      const previous = impactProfile(ladder[step - 1]);
      const current = impactProfile(ladder[step]);
      expect(current.shakeIntensity).toBeGreaterThan(previous.shakeIntensity);
      expect(current.particles).toBeGreaterThan(previous.particles);
      expect(current.spread).toBeGreaterThan(previous.spread);
    }
  });

  it('reserves the full-screen flash for the boss death alone', () => {
    const flashing = Object.entries(IMPACT_PROFILES).filter(([, profile]) => profile.flash);
    expect(flashing.map(([tier]) => tier)).toEqual(['bossDeath']);
  });

  it('keeps every tier bound to a defined audio event', () => {
    for (const profile of Object.values(IMPACT_PROFILES))
      expect(AUDIO_EVENT_IDS).toContain(profile.audio);
  });

  it('gives a critical a bigger number than a normal hit', () => {
    expect(impactProfile('critical').textSize).toBeGreaterThan(impactProfile('normal').textSize);
    expect(impactProfile('critical').textColor).not.toBe(impactProfile('normal').textColor);
  });
});

describe('audio event map', () => {
  it('covers every gameplay moment the product brief lists', () => {
    const required = [
      'weapon_fire', 'enemy_hit', 'critical_hit', 'enemy_death', 'xp_collect', 'level_up',
      'dash', 'nova', 'shield', 'overdrive', 'boss_spawn', 'boss_phase', 'boss_death',
      'victory', 'game_over',
    ];
    for (const event of required) expect(AUDIO_EVENT_IDS).toContain(event);
  });

  it('defines at least one playable tone per event and keeps the mix quiet', () => {
    for (const [id, definition] of Object.entries(AUDIO_EVENTS)) {
      expect(definition.tones.length, id).toBeGreaterThan(0);
      for (const tone of definition.tones) {
        expect(tone.frequency, id).toBeGreaterThan(0);
        expect(tone.durationS, id).toBeGreaterThan(0);
        // Placeholder voicing must never be loud enough to fatigue a playtester.
        expect(tone.volume, id).toBeLessThanOrEqual(0.06);
      }
    }
  });
});
