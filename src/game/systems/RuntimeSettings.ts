import type Phaser from 'phaser';
import type { GameSettings } from '../progression/Settings';
import { DEFAULT_SETTINGS } from '../progression/Settings';
import { setLocale } from '../i18n';
import { setAudioPreferences } from '../managers/AudioManager';

/**
 * The persisted settings as the running game sees them. Read synchronously by constructors
 * (effects, enemy visuals) so a preference change applies to everything created afterwards
 * without threading the profile through every call site.
 */
let active: GameSettings = { ...DEFAULT_SETTINGS };

export function applyRuntimeSettings(settings: GameSettings) {
  active = { ...settings };
  setLocale(settings.locale);
  setAudioPreferences(settings.masterVolume, settings.musicVolume, settings.sfxVolume);
}

export function runtimeSettings(): Readonly<GameSettings> {
  return active;
}

export function systemPrefersReducedMotion() {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

/** The one reduced-motion question every presenter asks: the player's choice wins over the OS. */
export function reducedMotion() {
  if (active.motion === 'reduced') return true;
  if (active.motion === 'full') return false;
  return systemPrefersReducedMotion();
}

/** Camera shake honours both the explicit toggle and reduced motion. */
export function shakeCamera(camera: Phaser.Cameras.Scene2D.Camera, duration: number, intensity: number) {
  if (!active.screenShake || reducedMotion()) return;
  camera.shake(duration, intensity);
}
