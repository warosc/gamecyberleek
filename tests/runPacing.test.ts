import { describe, expect, it } from 'vitest';
import { runPhase, BOSS_START_MS, RUN_PHASE_CALLOUTS, UPGRADE_MILESTONES } from '../src/game/config/RunPacing';
import { EnemyType } from '../src/game/entities/enemies/EnemyTypes';
import { getAbilityById } from '../src/game/abilities/AbilityRegistry';
import { createPlayerStats } from '../src/game/entities/player/PlayerStats';

describe('five-minute combat pacing', () => {
  it('teaches pursuit before charge, and charge before ranged attacks', () => {
    expect(runPhase(29999).types).toEqual([EnemyType.GRUNT]);
    expect(runPhase(30000).types).toContain(EnemyType.RUNNER);
    expect(runPhase(74999).types).not.toContain(EnemyType.SHOOTER);
    expect(runPhase(75000).types).toContain(EnemyType.SHOOTER);
    expect(runPhase(BOSS_START_MS).cap).toBe(0);
    expect(runPhase(300000).types).toEqual([]);
    expect(UPGRADE_MILESTONES.every(time=>time<BOSS_START_MS)).toBe(true);
    expect(RUN_PHASE_CALLOUTS[30000].title).toBe('EMBESTIDA DETECTADA');
    expect(RUN_PHASE_CALLOUTS[210000].brief).toContain('BROK-9');
  });
  it('offers distinct benefits and preserves piercing when a weapon changes', () => {
    const s=createPlayerStats();
    getAbilityById('breach')!.apply(s,1);
    s.projectilePiercing=0;
    expect(s.bonusPiercing).toBe(1);
    getAbilityById('fan')!.apply(s,1);
    expect(s.projectileCount).toBe(2);
    getAbilityById('phase_dash')!.apply(s,1);
    expect(s.dashCooldown).toBe(800);
    expect(s.moveSpeed).toBe(240);
  });
});
