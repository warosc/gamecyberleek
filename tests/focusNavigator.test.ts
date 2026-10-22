import { describe, expect, it } from 'vitest';
import { FocusNavigator, type FocusSlot } from '../src/game/ui/FocusNavigator';

/** The main menu's shape: a selector, two pairs, a row of three and the loadout. */
const menu = (): FocusSlot[] => [
  { row: 0, x: 315 },
  { row: 1, x: 245 }, { row: 1, x: 485 },
  { row: 2, x: 190 }, { row: 2, x: 430 },
  { row: 3, x: 155 }, { row: 3, x: 315 }, { row: 3, x: 475 },
  { row: 4, x: 920 },
];

describe('focus navigator', () => {
  it('walks a vertical list and wraps at both ends', () => {
    const nav = new FocusNavigator([{ row: 0, x: 0 }, { row: 1, x: 0 }, { row: 2, x: 0 }]);
    expect(nav.move('down')).toBe(1);
    expect(nav.move('down')).toBe(2);
    expect(nav.move('down')).toBe(0);
    expect(nav.move('up')).toBe(2);
  });

  it('walks a row left to right by position, not registration order, and wraps', () => {
    const nav = new FocusNavigator([{ row: 0, x: 300 }, { row: 0, x: 100 }, { row: 0, x: 200 }], 1);
    expect(nav.move('right')).toBe(2);
    expect(nav.move('right')).toBe(0);
    expect(nav.move('right')).toBe(1);
    expect(nav.move('left')).toBe(0);
  });

  it('stays put moving sideways in a single-item row', () => {
    const nav = new FocusNavigator([{ row: 0, x: 0 }, { row: 1, x: 0 }]);
    expect(nav.move('left')).toBe(0);
    expect(nav.move('right')).toBe(0);
  });

  it('lands on the nearest item of the next row', () => {
    const nav = new FocusNavigator(menu(), 2);
    // From DAILY (right of the pair) down to the right-hand button of the next row.
    expect(nav.move('down')).toBe(4);
    expect(nav.move('down')).toBe(7);
    expect(nav.move('down')).toBe(8);
    // The loadout sits far right, so up from it returns to the rightmost button.
    expect(nav.move('up')).toBe(7);
    // Up from the left-hand button of a row of three picks the left-hand one above.
    nav.focus(5);
    expect(nav.move('up')).toBe(3);
    // Wraps from the top row to the bottom one.
    nav.focus(0);
    expect(nav.move('up')).toBe(8);
  });

  it('skips disabled items, including whole rows of them', () => {
    let online = false;
    const nav = new FocusNavigator([
      { row: 0, x: 0 },
      { row: 1, x: -100, enabled: () => online }, { row: 1, x: 100, enabled: () => online },
      { row: 2, x: 0 },
    ]);
    expect(nav.move('down')).toBe(3);
    expect(nav.move('down')).toBe(0);
    online = true;
    expect(nav.move('down')).toBe(1);
    expect(nav.move('right')).toBe(2);
  });

  it('starts on the first enabled item at or after the requested one', () => {
    const nav = new FocusNavigator([{ row: 0, x: 0 }, { row: 1, x: 0, enabled: () => false }, { row: 2, x: 0 }], 1);
    expect(nav.index).toBe(2);
    // An out-of-range request is clamped, which a panel rebuilt with fewer items relies on.
    expect(new FocusNavigator([{ row: 0, x: 0 }, { row: 1, x: 0 }], 9).index).toBe(1);
  });

  it('refuses focus on a missing or disabled item', () => {
    const nav = new FocusNavigator([{ row: 0, x: 0 }, { row: 1, x: 0, enabled: () => false }]);
    expect(nav.focus(1)).toBe(false);
    expect(nav.focus(5)).toBe(false);
    expect(nav.index).toBe(0);
  });

  it('copes with an empty group', () => {
    const nav = new FocusNavigator([]);
    expect(nav.move('down')).toBe(0);
    expect(nav.move('right')).toBe(0);
  });
});
