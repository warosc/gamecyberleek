import { describe, expect, it } from 'vitest';
import { runPhase, BOSS_START_MS, FINAL_CHEST_MS, MINIBOSS_START_MS, RUN_PHASE_CALLOUTS, RUN_PHASES, UPGRADE_MILESTONES } from '../src/game/config/RunPacing';
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
    expect(MINIBOSS_START_MS).toBeGreaterThan(UPGRADE_MILESTONES[1]);
    expect(MINIBOSS_START_MS).toBeLessThan(UPGRADE_MILESTONES[2]);
    expect(RUN_PHASE_CALLOUTS[30000].title).toBe('EMBESTIDA DETECTADA');
    expect(RUN_PHASE_CALLOUTS[210000].brief).toContain('COMANDANTE');
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
  it('builds pressure into the commander instead of easing off before it', () => {
    const combat = RUN_PHASES.filter(phase => phase.cap > 0);
    for (let index = 1; index < combat.length; index++) {
      expect(combat[index].interval, combat[index].label).toBeLessThan(combat[index - 1].interval);
      expect(combat[index].cap, combat[index].label).toBeGreaterThanOrEqual(combat[index - 1].cap);
    }
    expect(runPhase(BOSS_START_MS - 1)).toMatchObject({ interval: 600, cap: 32 });
  });
  it('drops the guaranteed supply chest in the last wave, before the commander', () => {
    expect(FINAL_CHEST_MS).toBeGreaterThanOrEqual(runPhase(BOSS_START_MS - 1).at);
    expect(FINAL_CHEST_MS).toBeLessThan(BOSS_START_MS);
  });
});
