import { describe, expect, it } from 'vitest';
import { PAD, applyDeadzone, buildFrame, stickDirection } from '../src/game/input/GamepadBridge';

const reading = (axes: number[], pressed: number[] = [], rt = 0) => {
  const buttons = Array.from({ length: 17 }, (_, index) => pressed.includes(index));
  const values = buttons.map(Number);
  values[PAD.RT] = rt;
  return { axes, pressed: buttons, values };
};

describe('gamepad bridge', () => {
  it('ignores drift inside the deadzone and rescales outside it', () => {
    expect(applyDeadzone(0.1, 0.1)).toEqual({ x: 0, y: 0 });
    const full = applyDeadzone(1, 0);
    expect(full.x).toBeCloseTo(1);
  });

  it('fires from the right stick or the trigger, and reports edges once', () => {
    const aimed = buildFrame(reading([0, 0, 0.9, 0]), []);
    expect(aimed.aiming && aimed.firing).toBe(true);
    const trigger = buildFrame(reading([0, 0, 0, 0], [], 0.8), []);
    expect(trigger.firing).toBe(true);
    expect(trigger.aiming).toBe(false);
    const first = buildFrame(reading([0, 0, 0, 0], [PAD.A]), []);
    expect(first.justPressed.has(PAD.A)).toBe(true);
    const held = buildFrame(reading([0, 0, 0, 0], [PAD.A]), first.justPressed.size ? [true] : []);
    expect(held.justPressed.has(PAD.A)).toBe(false);
  });

  it('moves with the d-pad when the stick is centred', () => {
    const frame = buildFrame(reading([0, 0, 0, 0], [PAD.LEFT, PAD.DOWN]), []);
    expect(frame.movement).toEqual({ x: -1, y: 1 });
    expect(frame.active).toBe(true);
  });

  it('maps a strong stick push to one navigation direction', () => {
    expect(stickDirection([0.9, 0.2])).toBe('RIGHT');
    expect(stickDirection([-0.1, -0.8])).toBe('UP');
    expect(stickDirection([0.3, 0.3])).toBeUndefined();
  });
});
