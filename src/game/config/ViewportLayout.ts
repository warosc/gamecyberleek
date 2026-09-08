export interface ViewportShape {
  width: number;
  height: number;
  coarsePointer: boolean;
}

export const DESIGN_HEIGHT = 720;
export const DESKTOP_WIDTH = 1280;
export const MAX_MOBILE_WIDTH = 1600;

/**
 * Phones are much wider than 16:9 in landscape. Matching that aspect ratio avoids shrinking a
 * 1280x720 canvas inside pillarboxes. The upper bound keeps ultrawide devices from exposing an
 * excessive amount of the arena or stretching the HUD too far apart.
 */
export function logicalWidthForViewport(viewport: ViewportShape) {
  if (!viewport.coarsePointer) return DESKTOP_WIDTH;
  const longEdge = Math.max(viewport.width, viewport.height);
  const shortEdge = Math.max(1, Math.min(viewport.width, viewport.height));
  return Math.round(Math.min(MAX_MOBILE_WIDTH, Math.max(DESKTOP_WIDTH, DESIGN_HEIGHT * longEdge / shortEdge)));
}

export function currentViewportShape(): ViewportShape {
  if (typeof window === 'undefined')
    return { width: DESKTOP_WIDTH, height: DESIGN_HEIGHT, coarsePointer: false };
  const viewport = window.visualViewport;
  return {
    width: viewport?.width ?? window.innerWidth,
    height: viewport?.height ?? window.innerHeight,
    coarsePointer: window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0,
  };
}

export const mobileWorldZoom = (coarsePointer: boolean) => coarsePointer ? 1.35 : 1;
