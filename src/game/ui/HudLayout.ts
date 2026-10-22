import type Phaser from 'phaser';
import { displayScale } from './SceneWidgets';

/** Below this display scale the HUD uses its larger-type layout. Mirrors `isCompact`. */
export const COMPACT_HUD_SCALE = 0.75;

/**
 * In-run type size for a given display scale (real CSS px per logical px).
 *
 * The canvas keeps a 720-high logical size, so on an iPhone 16 Pro Max in landscape (about 330
 * CSS px of height, a 0.46 scale) the HUD's 10px labels drew at 4.6 CSS px and the 15px hints at
 * 7. Compact displays take the menus' legibility floor (about 11 real px, capped at 22 logical),
 * but not their growth: the HUD sits over the fight, text that is already 22px or more reads at
 * 10+ CSS px, and growing it would only cover more of the arena. Desktop is left exactly as it is.
 */
export function hudTextSize(size: number, scale: number) {
  if (!(scale > 0) || scale >= COMPACT_HUD_SCALE) return size;
  const floor = Math.min(22, Math.max(12, 11 / scale));
  return Math.round(Math.max(size, floor));
}

export const hudPx = (scene: Phaser.Scene, size: number) => hudTextSize(size, displayScale(scene));
export const hudFont = (scene: Phaser.Scene, size: number) => `${hudPx(scene, size)}px`;
export const isCompactHud = (scene: Phaser.Scene) => displayScale(scene) < COMPACT_HUD_SCALE;

export interface HudColumn {
  /** Top edge of the optional-objective panel. */
  objectiveTop: number;
  /** Compact displays move the objective under the contract rows on the left. */
  objectiveLeft: boolean;
  objectiveWidth: number;
  /** Centre of the chain (momentum) panel, and its width. */
  momentumY: number;
  momentumWidth: number;
  /** Top edge of the live board, its width and how many player rows it lists. */
  liveTop: number;
  liveWidth: number;
  liveRows: number;
}

/**
 * The right-hand HUD column as one stack, so its panels can never land on each other again: the
 * chain (momentum) panel used to open straight over the optional objective, and the weapon and
 * armor tags ran under both. Panels keep their slot even while hidden, so nothing jumps mid-run.
 *
 * Desktop: sector card 14-86 (with weapon and armor on its second line), objective 92-162,
 * chain 172-240, live board from 250.
 * Phone: pause button 14-104, objective 115-185, chain 191-259, live board 267 to ~389, clear of
 * the aim/fire label that starts near 399.
 * Compact display (phone-sized type): at 22px the objective needs two lines for its brief and the
 * three panels no longer fit between the pause button (ends 104) and the auto-fire pill (starts
 * 398). The objective moves left, under the contract rows (which end at 284), and the column
 * keeps the chain at 112-188 and the live board from 198 to ~376.
 */
export function rightColumn(mobile: boolean, compact = false): HudColumn {
  if (compact)
    return {
      objectiveTop: 296, objectiveLeft: true, objectiveWidth: 400,
      momentumY: 150, momentumWidth: 300,
      liveTop: 198, liveWidth: 400, liveRows: 4,
    };
  return mobile
    ? {
      objectiveTop: 115, objectiveLeft: false, objectiveWidth: 330,
      momentumY: 225, momentumWidth: 220,
      liveTop: 267, liveWidth: 330, liveRows: 4,
    }
    : {
      objectiveTop: 92, objectiveLeft: false, objectiveWidth: 330,
      momentumY: 206, momentumWidth: 220,
      liveTop: 250, liveWidth: 330, liveRows: 6,
    };
}

/** Horizontal centres that line the column's panels up on one right edge (GAME_WIDTH - 20). */
export const RIGHT_EDGE_INSET = 20;
