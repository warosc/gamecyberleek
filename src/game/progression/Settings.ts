export type QualityPreference = 'auto' | 'high' | 'balanced' | 'low';
export type MotionPreference = 'system' | 'reduced' | 'full';
export type Locale = 'es' | 'en';

export interface GameSettings {
  quality: QualityPreference;
  motion: MotionPreference;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  screenShake: boolean;
  locale: Locale;
}

export const DEFAULT_SETTINGS: GameSettings = {
  quality: 'auto',
  motion: 'system',
  masterVolume: 0.8,
  musicVolume: 0.55,
  sfxVolume: 1,
  screenShake: true,
  locale: 'es',
};

const QUALITY: readonly QualityPreference[] = ['auto', 'high', 'balanced', 'low'];
const MOTION: readonly MotionPreference[] = ['system', 'reduced', 'full'];
const LOCALES: readonly Locale[] = ['es', 'en'];

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function unit(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
}

export function normalizeSettings(value: unknown): GameSettings {
  const raw = (value && typeof value === 'object' ? value : {}) as Partial<Record<keyof GameSettings, unknown>>;
  return {
    quality: oneOf(raw.quality, QUALITY, DEFAULT_SETTINGS.quality),
    motion: oneOf(raw.motion, MOTION, DEFAULT_SETTINGS.motion),
    masterVolume: unit(raw.masterVolume, DEFAULT_SETTINGS.masterVolume),
    musicVolume: unit(raw.musicVolume, DEFAULT_SETTINGS.musicVolume),
    sfxVolume: unit(raw.sfxVolume, DEFAULT_SETTINGS.sfxVolume),
    screenShake: typeof raw.screenShake === 'boolean' ? raw.screenShake : DEFAULT_SETTINGS.screenShake,
    locale: oneOf(raw.locale, LOCALES, DEFAULT_SETTINGS.locale),
  };
}

/** Cycles through an option list, used by the settings screen's arrow buttons. */
export function cycle<T>(options: readonly T[], current: T, step: 1 | -1) {
  const index = options.indexOf(current);
  return options[(index + step + options.length) % options.length];
}

export const QUALITY_OPTIONS = QUALITY;
export const MOTION_OPTIONS = MOTION;
export const LOCALE_OPTIONS = LOCALES;
