/**
 * Speed an experience orb flies toward the player, or 0 when it is left alone.
 *
 * An orb that once entered the magnet radius stays captured and homes until collected. Without
 * that, a player walking away at moveSpeed outran the 200 px/s edge pull, the orb left the radius
 * still carrying its velocity, and it drifted off the arena for good.
 */
export function orbPullSpeed(distance: number, radius: number, captured: boolean, moveSpeed: number) {
  if (!captured && distance >= radius) return 0;
  // Accelerate as the orb closes. At a constant speed the pickup felt like the orb was being
  // dragged; ramping it makes the last few pixels snap in, which is the part that reads as a reward.
  const closeness = 1 - Math.min(distance / radius, 1);
  return Math.max(200 + closeness ** 2 * 700, moveSpeed * 1.4);
}
