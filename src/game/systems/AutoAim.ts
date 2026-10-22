/** Reach of auto-aim in world px: about the half-width the phone camera shows at its zoom. */
export const AUTO_AIM_RANGE = 680;

interface Candidate {
  x: number;
  y: number;
  active: boolean;
}

/**
 * The enemy auto-aim fires at: the nearest active one within `range`, or undefined.
 *
 * On phones auto-fire used to shoot wherever the last touch had been (usually the move stick, so
 * down and to the left) unless the player also held the aim stick: two thumbs busy all the time.
 * With a target picked here, the left thumb alone plays the run. Iterates instead of building an
 * array, since it runs every frame over up to 32 enemies.
 */
export function autoAimTarget<T extends Candidate>(origin: { x: number; y: number }, candidates: Iterable<T>, range = AUTO_AIM_RANGE) {
  let best: T | undefined;
  let bestDistance = range * range;
  for (const candidate of candidates) {
    if (!candidate.active) continue;
    const dx = candidate.x - origin.x;
    const dy = candidate.y - origin.y;
    const distance = dx * dx + dy * dy;
    if (distance <= bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}
