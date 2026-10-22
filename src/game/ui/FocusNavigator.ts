/**
 * Engine-free focus movement for menus driven by arrows and the d-pad (the gamepad bridge replays
 * the pad as arrow keys). Kept apart from Phaser so the rules can be unit tested.
 *
 * Every slot sits on a row and has a horizontal position. LEFT / RIGHT walk the focused row by
 * position; UP / DOWN jump to the nearest slot on the next row that has one. Both wrap around, so
 * a player never reaches a dead end, and disabled slots are skipped as if absent.
 */
export type FocusDirection = 'up' | 'down' | 'left' | 'right';

export interface FocusSlot {
  row: number;
  x: number;
  /** Read on every move: a button can be disabled after the group is built. */
  enabled?: () => boolean;
}

export class FocusNavigator {
  private current = 0;

  constructor(private readonly slots: readonly FocusSlot[], initial = 0) {
    this.current = this.firstEnabledFrom(initial);
  }

  get index() {
    return this.current;
  }

  /** Focuses `index` when it exists and is enabled; returns whether focus moved there. */
  focus(index: number) {
    if (!this.usable(index)) return false;
    this.current = index;
    return true;
  }

  /** Moves focus and returns the new index (unchanged when there is nowhere to go). */
  move(direction: FocusDirection) {
    if (!this.usable(this.current)) this.current = this.firstEnabledFrom(this.current);
    if (!this.usable(this.current)) return this.current;
    const next = direction === 'left' || direction === 'right'
      ? this.alongRow(direction === 'right' ? 1 : -1)
      : this.acrossRows(direction === 'down' ? 1 : -1);
    this.current = next;
    return next;
  }

  private usable(index: number) {
    const slot = this.slots[index];
    return slot !== undefined && (slot.enabled?.() ?? true);
  }

  /** The first enabled slot at or after `start` in registration order, wrapping; else `start`. */
  private firstEnabledFrom(start: number) {
    const count = this.slots.length;
    if (count === 0) return 0;
    const from = Math.min(Math.max(0, Math.trunc(start)), count - 1);
    for (let offset = 0; offset < count; offset++) {
      const index = (from + offset) % count;
      if (this.usable(index)) return index;
    }
    return from;
  }

  /** Enabled slots of `row`, left to right; registration order breaks ties in position. */
  private rowSlots(row: number) {
    return this.slots
      .map((slot, index) => ({ slot, index }))
      .filter(({ slot, index }) => slot.row === row && this.usable(index))
      .sort((a, b) => a.slot.x - b.slot.x || a.index - b.index)
      .map(({ index }) => index);
  }

  private alongRow(step: 1 | -1) {
    const row = this.rowSlots(this.slots[this.current].row);
    const at = row.indexOf(this.current);
    return row[(at + step + row.length) % row.length];
  }

  private acrossRows(step: 1 | -1) {
    const rows = [...new Set(this.slots.filter((_, index) => this.usable(index)).map(slot => slot.row))]
      .sort((a, b) => a - b);
    const here = this.slots[this.current];
    const at = rows.indexOf(here.row);
    const target = this.rowSlots(rows[(at + step + rows.length) % rows.length]);
    // Nearest by position, so DOWN from the right-hand button lands on the right-hand button.
    return target.reduce((best, index) =>
      Math.abs(this.slots[index].x - here.x) < Math.abs(this.slots[best].x - here.x) ? index : best);
  }
}
