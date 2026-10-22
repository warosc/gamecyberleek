import { describe, expect, it, vi } from 'vitest';

// Only the pure layout and hint rules are under test; the Phaser-backed pieces stay out of node.
vi.mock('phaser', () => ({ default: {} }));
vi.mock('../src/game/ui/SceneWidgets', () => ({ displayScale: () => 1, fitText: (text: unknown) => text }));
vi.mock('../src/game/systems/RuntimeSettings', () => ({ reducedMotion: () => false }));

const { COMPACT_HUD_SCALE, hudTextSize, rightColumn } = await import('../src/game/ui/HudLayout');
const { HINT_SEQUENCE, controlsLearned, hintLabel, nextHint } = await import('../src/game/ui/OnboardingHints');
const { es } = await import('../src/game/i18n/es');
const { en } = await import('../src/game/i18n/en');
type HintAction = Parameters<typeof nextHint>[1] extends ReadonlySet<infer A> ? A : never;

/** iPhone 16 Pro Max in landscape with Safari's bars: ~330 CSS px for the 720 logical rows. */
const PRO_MAX = 330 / 720;

describe('HUD type size', () => {
  it('leaves desktop exactly as it is', () => {
    for (const size of [10, 11, 15, 24, 38]) {
      expect(hudTextSize(size, 1)).toBe(size);
      expect(hudTextSize(size, COMPACT_HUD_SCALE)).toBe(size);
      expect(hudTextSize(size, 1.5)).toBe(size);
    }
  });

  it('lifts small in-run text to about 10 real px on a Pro Max', () => {
    // 10px used to render at 4.6 CSS px there.
    expect(10 * PRO_MAX).toBeLessThan(5);
    for (const size of [10, 11, 12, 15, 19]) {
      expect(hudTextSize(size, PRO_MAX)).toBe(22);
      expect(hudTextSize(size, PRO_MAX) * PRO_MAX).toBeGreaterThanOrEqual(10);
    }
  });

  it('never shrinks text and leaves large headlines alone', () => {
    expect(hudTextSize(24, PRO_MAX)).toBe(24);
    expect(hudTextSize(42, PRO_MAX)).toBe(42);
    for (const scale of [0.3, 0.46, 0.5, 0.57, 0.7])
      for (const size of [8, 10, 13, 16, 30]) expect(hudTextSize(size, scale)).toBeGreaterThanOrEqual(size);
  });

  it('floors text to the menu legibility target on mid-size phones', () => {
    // 844x390 (iPhone 13/14 landscape): 11 / 0.54 = 20.3.
    expect(hudTextSize(10, 390 / 720)).toBe(20);
    expect(hudTextSize(10, 0.7)).toBe(16);
  });

  it('ignores a not-yet-measured display', () => {
    expect(hudTextSize(10, 0)).toBe(10);
    expect(hudTextSize(10, Number.NaN)).toBe(10);
  });
});

describe('right-hand HUD column', () => {
  const spans = (mobile: boolean, compact: boolean) => {
    const column = rightColumn(mobile, compact);
    const momentumHeight = compact ? 76 : 68;
    return {
      column,
      momentum: [column.momentumY - momentumHeight / 2, column.momentumY + momentumHeight / 2] as const,
    };
  };

  it('keeps the chain panel under the 90px phone pause button (14-104)', () => {
    for (const compact of [false, true]) expect(spans(true, compact).momentum[0]).toBeGreaterThan(104);
  });

  it('stacks chain and live board without overlap on a compact display', () => {
    const { column, momentum } = spans(true, true);
    expect(column.liveTop).toBeGreaterThan(momentum[1]);
    // Live board: title + record + rows at 22px must end above the auto-fire pill (398).
    expect(column.liveTop + 67 + 4 + column.liveRows * 26).toBeLessThan(398);
  });

  it('moves the objective under the contract rows on compact displays', () => {
    const column = rightColumn(true, true);
    expect(column.objectiveLeft).toBe(true);
    // Three 46px contract rows with 4px gaps from y=138 end at 284.
    expect(column.objectiveTop).toBeGreaterThan(138 + 3 * 46 + 2 * 4);
  });

  it('keeps the desktop slots it had', () => {
    expect(rightColumn(false)).toMatchObject({ objectiveTop: 92, momentumY: 206, liveTop: 250, objectiveLeft: false });
    expect(rightColumn(true)).toMatchObject({ objectiveTop: 115, momentumY: 225, liveTop: 267, objectiveLeft: false });
  });
});

describe('onboarding hint queue', () => {
  const done = (...actions: HintAction[]) => new Set<HintAction>(actions);

  it('teaches one control at a time, in order, skipping what the player already did', () => {
    expect(nextHint('keyboard', done(), false)).toBe('move');
    expect(nextHint('keyboard', done('move'), false)).toBe('aim');
    expect(nextHint('keyboard', done('move', 'aim', 'fire'), false)).toBe('dash');
    expect(nextHint('keyboard', done('dash'), false)).toBe('move');
    expect(nextHint('keyboard', done('move', 'aim', 'fire', 'dash'), false)).toBeUndefined();
  });

  it('only teaches the special powers once one is charged, and after the controls', () => {
    expect(nextHint('touch', done('move', 'fire', 'dash'), false)).toBeUndefined();
    expect(nextHint('touch', done('move', 'fire', 'dash'), true)).toBe('special');
    expect(nextHint('touch', done('move'), true)).toBe('fire');
    expect(nextHint('pad', done('move', 'aim', 'dash', 'special'), true)).toBeUndefined();
  });

  it('uses each device\'s own vocabulary', () => {
    expect(hintLabel('move', 'keyboard')).toBe('hint.move');
    expect(hintLabel('move', 'touch')).toBe('hint.touchMove');
    expect(hintLabel('move', 'pad')).toBe('hint.padMove');
    expect(hintLabel('special', 'pad')).toBe('hint.padSpecials');
    // A pad's right stick aims and fires together; there is no separate fire hint to show.
    expect(HINT_SEQUENCE.pad).not.toContain('fire');
    expect(HINT_SEQUENCE.touch).not.toContain('aim');
  });

  it('has a translated label for every hint it can show', () => {
    for (const device of ['keyboard', 'touch', 'pad'] as const)
      for (const action of [...HINT_SEQUENCE[device], 'special'] as const) {
        const key = hintLabel(action, device);
        expect(key, `${device}/${action}`).toBeDefined();
        expect(es[key!]).toBeTruthy();
        expect(en[key!]).toBeTruthy();
      }
  });

  it('holds the contract briefing until the player has moved and aimed', () => {
    expect(controlsLearned(done())).toBe(false);
    expect(controlsLearned(done('move'))).toBe(false);
    expect(controlsLearned(done('aim'))).toBe(false);
    expect(controlsLearned(done('move', 'fire'))).toBe(true);
    expect(controlsLearned(done('move', 'aim'))).toBe(true);
  });
});
