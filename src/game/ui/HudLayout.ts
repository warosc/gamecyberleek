/**
 * The right-hand HUD column as one stack, so its panels can never land on each other again: the
 * chain (momentum) panel used to open straight over the optional objective, and the weapon and
 * armor tags ran under both. Values are logical-pixel centres (objective, momentum) and the live
 * board's top edge. Panels keep their slot even while hidden, so nothing jumps mid-run.
 *
 * Desktop: sector card 14-86 (with weapon and armor on its second line), objective 92-162,
 * chain 172-240, live board from 250.
 * Phone: pause button 14-104, objective 115-185, chain 191-259, live board 267 to ~389, clear of
 * the aim/fire label that starts near 399.
 */
export function rightColumn(mobile: boolean) {
  return mobile
    ? { objectiveY: 150, momentumY: 225, liveTop: 267 }
    : { objectiveY: 127, momentumY: 206, liveTop: 250 };
}

/** Horizontal centres that line the column's panels up on one right edge (GAME_WIDTH - 20). */
export const RIGHT_EDGE_INSET = 20;
