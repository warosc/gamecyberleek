import type Phaser from 'phaser';
import { detectQualityProfile } from './QualityProfile';

/**
 * Decorative art loaded on demand: each screen queues its own backdrop and icons from its
 * `preload()`, so none of it delays the first menu and screens never visited cost nothing.
 * All files are small WebP (tools/art/import_scene_art.py enforces the budget).
 *
 * Backdrops are skipped on the low quality tier, where the shared menu backdrop stands in: a
 * full-screen texture is the one thing here that costs noticeable GPU memory on a weak phone.
 */
export const BACKDROPS = {
  workshop: 'assets/ui/backdrops/workshop.webp',
  records: 'assets/ui/backdrops/records.webp',
  bestiary: 'assets/ui/backdrops/bestiary.webp',
  systems: 'assets/ui/backdrops/systems.webp',
  victory: 'assets/ui/backdrops/victory.webp',
  defeat: 'assets/ui/backdrops/defeat.webp',
} as const;
export type BackdropId = keyof typeof BACKDROPS;
export const backdropKey = (id: BackdropId) => `backdrop-${id}`;

export const ICON_PATH = (id: string) => `assets/ui/icons/${id}.webp`;
export const iconKey = (id: string) => `icon-${id}`;

/** Queues a screen's backdrop (unless the quality tier opts out) and icons not yet loaded. */
export function queueSceneArt(scene: Phaser.Scene, art: { backdrops?: BackdropId[]; icons?: string[] }) {
  const lowTier = detectQualityProfile().tier === 'low';
  if (!lowTier)
    for (const id of art.backdrops ?? [])
      if (!scene.textures.exists(backdropKey(id))) scene.load.image(backdropKey(id), BACKDROPS[id]);
  for (const id of art.icons ?? [])
    if (!scene.textures.exists(iconKey(id))) scene.load.image(iconKey(id), ICON_PATH(id));
}

/** The screen's own backdrop when it loaded, else the shared menu backdrop. */
export function backdropTexture(scene: Phaser.Scene, id?: BackdropId) {
  return id && scene.textures.exists(backdropKey(id)) ? backdropKey(id) : 'menu-backdrop';
}
