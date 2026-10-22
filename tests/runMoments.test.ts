import { describe, expect, it } from 'vitest';
import { EMPTY_LIFETIME, LIVE_ACHIEVEMENTS, newlyEarned, NO_RUN_FACTS, type AchievementContext } from '../src/game/progression/Achievements';
import { RunMoments, type LiveRunFacts, type RunMomentsStart } from '../src/game/systems/RunMoments';

const context = (overrides: Partial<AchievementContext> = {}): AchievementContext => ({
  runs: 3, victories: 0, perfectContracts: 0, weaponMastery: { pulse: 0, spore: 0, arc: 0 },
  lifetime: { ...EMPTY_LIFETIME, victoriesByWeapon: { pulse: 0, spore: 0, arc: 0 }, victoriesBySector: [0, 0, 0] },
  ...overrides,
});
const start = (overrides: Partial<RunMomentsStart> = {}): RunMomentsStart => ({
  owned: [], context: context(), bestLevel: 8, sector: 0, ...overrides,
});
const facts = (overrides: Partial<LiveRunFacts> = {}): LiveRunFacts => ({
  kills: 0, damageTaken: 100, durationMs: 120000, perfectContracts: false, ...overrides,
});
const ids = (moments: { kind: string; id?: string }[]) => moments.filter(m => m.kind === 'achievement').map(m => m.id);

describe('run moments', () => {
  it('announces EXTERMINADOR at 250 kills, once', () => {
    const moments = new RunMoments(start());
    expect(ids(moments.achievements(facts({ kills: 249 })))).toEqual([]);
    expect(ids(moments.achievements(facts({ kills: 250 })))).toEqual(['exterminator']);
    expect(ids(moments.achievements(facts({ kills: 300 })))).toEqual([]);
  });

  it('announces CONTRATISTA when the third contract lands and COSECHADOR from the lifetime total', () => {
    const lifetime = { ...context().lifetime, kills: 4990 };
    const moments = new RunMoments(start({ context: context({ lifetime }) }));
    expect(ids(moments.achievements(facts({ kills: 10, perfectContracts: true })))).toEqual(['contractor', 'harvester']);
  });

  it('never repeats an achievement the profile already owns', () => {
    const moments = new RunMoments(start({ owned: ['exterminator'] }));
    expect(ids(moments.achievements(facts({ kills: 400 })))).toEqual([]);
  });

  it('only announces achievements that cannot be lost before the run ends', () => {
    // Even with a fresh profile and a run that would earn many at the end.
    const moments = new RunMoments(start({ context: context({ runs: 24, victories: 2 }) }));
    const announced = ids(moments.achievements(facts({ kills: 400, damageTaken: 0, perfectContracts: true })));
    for (const id of announced) expect(LIVE_ACHIEVEMENTS).toContain(id);
    // VETERANO (25 runs) and victory achievements wait for the results screen.
    expect(announced).not.toContain('veteran');
    expect(announced).not.toContain('first-harvest');
  });

  // An announced achievement must be one saveRun pays with the same facts, or the plate lies.
  it('agrees with what saveRun awards for the same run', () => {
    const base = context({ runs: 4, lifetime: { ...context().lifetime, kills: 4900 } });
    const moments = new RunMoments(start({ context: base }));
    const run = facts({ kills: 260, damageTaken: 200, perfectContracts: true });
    const live = ids(moments.achievements(run));
    expect(live.length).toBeGreaterThan(0);
    for (const victory of [false, true]) {
      const saved = {
        ...base, runs: base.runs + 1, victories: base.victories + Number(victory), perfectContracts: base.perfectContracts + 1,
        lifetime: { ...base.lifetime, kills: base.lifetime.kills + 260 },
      };
      const paid = newlyEarned([], saved, { ...NO_RUN_FACTS, kills: 260, damageTaken: 200, durationMs: run.durationMs, victory }).map(a => a.id);
      for (const id of live) expect(paid).toContain(id);
    }
  });

  it('marks a new best level once, and not for a first-time player', () => {
    const moments = new RunMoments(start({ bestLevel: 8 }));
    expect(moments.levelReached(8)).toEqual([]);
    expect(moments.levelReached(9)).toEqual([{ kind: 'record', record: 'level', level: 9 }]);
    expect(moments.levelReached(10)).toEqual([]);
    expect(new RunMoments(start({ bestLevel: 1 })).levelReached(5)).toEqual([]);
  });

  it('calls kill-chain milestones once per chain and re-arms them when the chain breaks', () => {
    const moments = new RunMoments(start());
    const calls = (from: number, to: number) => {
      const out: number[] = [];
      for (let chain = from; chain <= to; chain++)
        for (const moment of moments.chainReached(chain)) if (moment.kind === 'streak') out.push(moment.chain);
      return out;
    };
    expect(calls(1, 30)).toEqual([10, 25]);
    expect(calls(1, 12)).toEqual([10]);
  });
});
