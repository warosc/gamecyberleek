import { describe, expect, it, vi } from 'vitest';

// HudLayout's sizing helpers read the live display through SceneWidgets; only the pure layout is tested.
vi.mock('phaser', () => ({ default: {} }));
vi.mock('../src/game/ui/SceneWidgets', () => ({ displayScale: () => 1, fitText: (text: unknown) => text }));
const { touchLayout } = await import('../src/game/ui/HudLayout');

const MIN_TOUCH_CSS = 44;
// The smallest phone scale measured: iPhone Pro Max landscape, 330 CSS px of a 720 logical height.
const PHONE_SCALE = 0.46;

describe('touch layout', () => {
  for (const [label, width, compact] of [['phone', 1600, true], ['tablet', 1280, false]] as const) {
    const layout = touchLayout(width, 720, compact);
    const circles = [layout.dash, ...layout.abilities];

    it(`${label}: every action is a real thumb-sized target`, () => {
      const scale = compact ? PHONE_SCALE : 0.75;
      for (const circle of circles) expect(circle.r * 2 * scale).toBeGreaterThanOrEqual(MIN_TOUCH_CSS);
      expect(layout.auto.hitHeight * scale).toBeGreaterThanOrEqual(MIN_TOUCH_CSS);
      expect(layout.stickRadius * 2 * scale).toBeGreaterThanOrEqual(80);
    });

    it(`${label}: the action buttons never overlap each other`, () => {
      for (let a = 0; a < circles.length; a++)
        for (let b = a + 1; b < circles.length; b++) {
          const gap = Math.hypot(circles[a].x - circles[b].x, circles[a].y - circles[b].y) - circles[a].r - circles[b].r;
          expect(gap, `${a}-${b}`).toBeGreaterThan(6);
        }
    });

    it(`${label}: the cluster sits on the right half, under the live board and over the XP bar`, () => {
      const liveBoardBottom = compact ? 376 : 389;
      for (const circle of circles) {
        expect(circle.x - circle.r).toBeGreaterThan(layout.splitX);
        expect(circle.x + circle.r).toBeLessThanOrEqual(width);
        expect(circle.y - circle.r).toBeGreaterThan(liveBoardBottom);
        expect(circle.y + circle.r).toBeLessThan(720 - 37);
      }
      expect(layout.moveAnchor.x).toBeLessThan(layout.splitX);
      expect(layout.aimAnchor.x).toBeGreaterThan(layout.splitX);
    });
  }
});
