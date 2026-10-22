import { describe, expect, it } from 'vitest';
import { AUTO_AIM_RANGE, autoAimTarget } from '../src/game/systems/AutoAim';

const enemy = (x: number, y: number, active = true) => ({ x, y, active });

describe('auto-aim', () => {
  it('picks the nearest active enemy', () => {
    const near = enemy(130, 100);
    const target = autoAimTarget({ x: 100, y: 100 }, [enemy(400, 100), near, enemy(105, 100, false)]);
    expect(target).toBe(near);
  });

  it('ignores enemies beyond its reach and returns nothing in an empty arena', () => {
    expect(autoAimTarget({ x: 0, y: 0 }, [enemy(AUTO_AIM_RANGE + 1, 0)])).toBeUndefined();
    expect(autoAimTarget({ x: 0, y: 0 }, [])).toBeUndefined();
  });

  it('accepts any iterable, such as a Phaser group set', () => {
    const near = enemy(10, 0);
    expect(autoAimTarget({ x: 0, y: 0 }, new Set([enemy(50, 0), near]))).toBe(near);
  });
});
