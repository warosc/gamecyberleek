import { describe, expect, it } from 'vitest';
import { BOSS_PHASE_CALLOUTS, BOSS_REINFORCEMENTS } from '../src/game/config/BossPhases';

describe('BRÓK-9 phase plan', () => {
  it('gives both transitions bounded sector-specific reinforcements', () => {
    expect(BOSS_REINFORCEMENTS).toHaveLength(3);
    for (const sector of BOSS_REINFORCEMENTS) {
      expect(sector.phase2).toHaveLength(3);
      expect(sector.phase3).toHaveLength(4);
    }
    expect(BOSS_PHASE_CALLOUTS[2].title).not.toBe(BOSS_PHASE_CALLOUTS[3].title);
  });
});
