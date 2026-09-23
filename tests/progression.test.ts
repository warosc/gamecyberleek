import { describe, expect, it } from 'vitest';
import { createPlayerStats } from '../src/game/entities/player/PlayerStats';
import {
  EMPTY_WORKSHOP, WORKSHOP_UPGRADES, applyWorkshop, creditMultiplier, nextRankCost, normalizeWorkshop, purchaseRank,
} from '../src/game/progression/Workshop';
import { DEFAULT_SETTINGS, cycle, normalizeSettings, QUALITY_OPTIONS } from '../src/game/progression/Settings';
import {
  ACHIEVEMENTS, EMPTY_LIFETIME, NO_RUN_FACTS, newlyEarned, normalizeHistory, normalizeLifetime,
} from '../src/game/progression/Achievements';
import {
  DAILY_BOARD_SIZE, EMPTY_DAILY, dailyOperation, hashSeed, normalizeDaily, operationScore, recordDailyScore,
} from '../src/game/progression/DailyOperation';

describe('workshop', () => {
  it('charges the next rank and refuses when short or maxed', () => {
    const bought = purchaseRank('plating', EMPTY_WORKSHOP, 100);
    expect(bought).toEqual({ credits: 40, ranks: { ...EMPTY_WORKSHOP, plating: 1 } });
    expect(purchaseRank('plating', EMPTY_WORKSHOP, 59)).toBeUndefined();
    const maxed = { ...EMPTY_WORKSHOP, magnet: 3 };
    expect(nextRankCost('magnet', maxed)).toBeUndefined();
    expect(purchaseRank('magnet', maxed, 99999)).toBeUndefined();
  });

  it('keeps every upgrade priced in ascending order', () => {
    for (const upgrade of WORKSHOP_UPGRADES)
      upgrade.costs.forEach((cost, index) => { if (index) expect(cost).toBeGreaterThan(upgrade.costs[index - 1]); });
  });

  it('applies ranks as small permanent stat changes', () => {
    const stats = createPlayerStats();
    applyWorkshop(stats, { plating: 5, firepower: 5, magnet: 3, dash: 3, salvage: 3 });
    expect(stats.maxHp).toBe(150);
    expect(stats.attackDamage).toBeCloseTo(24);
    expect(stats.magnetRadius).toBe(196);
    expect(stats.dashCooldown).toBeCloseTo(790);
    expect(creditMultiplier({ ...EMPTY_WORKSHOP, salvage: 3 })).toBeCloseTo(1.3);
  });

  it('clamps corrupted ranks instead of trusting storage', () => {
    expect(normalizeWorkshop({ plating: 99, magnet: -4, dash: 'x', salvage: 1.8 }))
      .toEqual({ ...EMPTY_WORKSHOP, plating: 5, salvage: 1 });
    expect(normalizeWorkshop(null)).toEqual(EMPTY_WORKSHOP);
  });
});

describe('settings', () => {
  it('falls back per field on invalid values', () => {
    expect(normalizeSettings({ quality: 'ultra', masterVolume: 4, locale: 'en', screenShake: 'no' }))
      .toEqual({ ...DEFAULT_SETTINGS, masterVolume: 1, locale: 'en' });
  });
  it('cycles in both directions and wraps', () => {
    expect(cycle(QUALITY_OPTIONS, 'auto', -1)).toBe('low');
    expect(cycle(QUALITY_OPTIONS, 'low', 1)).toBe('auto');
  });
});

describe('achievements', () => {
  const context = { runs: 1, victories: 0, perfectContracts: 0, weaponMastery: { pulse: 0, spore: 0, arc: 0 }, lifetime: EMPTY_LIFETIME };

  it('awards run-based achievements once', () => {
    const run = { ...NO_RUN_FACTS, victory: true, damageTaken: 20, kills: 260, shotsFired: 200, hits: 150 };
    const earned = newlyEarned([], { ...context, victories: 1 }, run).map(a => a.id);
    expect(earned).toEqual(['first-harvest', 'exterminator', 'untouchable', 'marksman']);
    expect(newlyEarned(earned, { ...context, victories: 1 }, run)).toEqual([]);
  });

  it('requires a win with every starter weapon for the arsenal achievement', () => {
    const lifetime = { ...EMPTY_LIFETIME, victoriesByWeapon: { pulse: 2, spore: 1, arc: 0 } };
    const run = { ...NO_RUN_FACTS, victory: false };
    expect(newlyEarned([], { ...context, lifetime }, run).map(a => a.id)).not.toContain('full-arsenal');
    lifetime.victoriesByWeapon.arc = 1;
    expect(newlyEarned([], { ...context, lifetime }, run).map(a => a.id)).toContain('full-arsenal');
  });

  it('has unique ids and positive rewards', () => {
    expect(new Set(ACHIEVEMENTS.map(a => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const achievement of ACHIEVEMENTS) expect(achievement.reward).toBeGreaterThan(0);
  });

  it('drops malformed history entries and bounds lifetime counters', () => {
    const history = normalizeHistory([{ at: 'x', weaponId: 'pulse', victory: true, level: 3 }, { at: 1 }, null]);
    expect(history).toHaveLength(1);
    expect(normalizeLifetime({ kills: -5, victoriesBySector: [1, 'a'] }).victoriesBySector).toEqual([1, 0, 0]);
  });
});

describe('daily operation', () => {
  it('is stable for a date and varies across dates', () => {
    expect(dailyOperation('2026-09-23')).toEqual(dailyOperation('2026-09-23'));
    const week = ['01', '02', '03', '04', '05', '06', '07'].map(day => dailyOperation(`2026-10-${day}`));
    expect(new Set(week.map(op => `${op.sector}-${op.weaponId}-${op.mutator.id}`)).size).toBeGreaterThan(3);
    expect(hashSeed('a')).not.toBe(hashSeed('b'));
  });

  it('scores a faster victory above a slower one', () => {
    const facts = { kills: 200, level: 12, victory: true };
    expect(operationScore({ ...facts, durationMs: 300_000 })).toBeGreaterThan(operationScore({ ...facts, durationMs: 400_000 }));
    expect(operationScore({ ...facts, victory: false, durationMs: 100_000 })).toBe(200 * 10 + 12 * 150 + 100 * 4);
  });

  it('keeps a bounded board per day and resets on a new day', () => {
    let record = EMPTY_DAILY;
    for (const score of [10, 50, 30, 70, 20, 60]) record = recordDailyScore(record, '2026-09-23', score);
    expect(record.scores).toEqual([70, 60, 50, 30, 20]);
    expect(record.scores).toHaveLength(DAILY_BOARD_SIZE);
    expect(record.attempts).toBe(6);
    const tomorrow = recordDailyScore(record, '2026-09-24', 5);
    expect(tomorrow).toEqual({ date: '2026-09-24', bestScore: 5, attempts: 1, scores: [5] });
    expect(normalizeDaily({ date: 'bad', scores: [3, -1, 9] })).toEqual({ date: '', bestScore: 0, attempts: 0, scores: [9, 3, 0] });
  });
});
