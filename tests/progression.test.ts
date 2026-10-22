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
  DAILY_BOARD_SIZE, EMPTY_DAILY, claimDailyBonus, dailyBonus, dailyOperation, hashSeed, normalizeDaily, operationScore,
  previousDateKey, recordDailyScore, streakStatus,
} from '../src/game/progression/DailyOperation';
import {
  allowedThreat, availableThreat, normalizeThreatCleared, recordThreatClear, threatNumeral, threatRewardMultiplier,
} from '../src/game/progression/ThreatLevels';

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
    const tomorrow = recordDailyScore({ ...record, streak: 3, lastPlayedDate: '2026-09-23' }, '2026-09-24', 5);
    // The board resets with the day; the streak does not.
    expect(tomorrow).toEqual({ date: '2026-09-24', bestScore: 5, attempts: 1, scores: [5], streak: 3, lastPlayedDate: '2026-09-23' });
    expect(normalizeDaily({ date: 'bad', scores: [3, -1, 9] })).toEqual({
      date: '', bestScore: 0, attempts: 0, scores: [9, 3, 0], streak: 0, lastPlayedDate: '',
    });
  });

  it('finds the previous calendar day across months, years and leap days', () => {
    expect(previousDateKey('2026-10-22')).toBe('2026-10-21');
    expect(previousDateKey('2026-03-01')).toBe('2026-02-28');
    expect(previousDateKey('2028-03-01')).toBe('2028-02-29');
    expect(previousDateKey('2027-01-01')).toBe('2026-12-31');
  });

  it('pays +20 % per streak day up to a week, x1.5 for a victory', () => {
    expect([1, 2, 7, 8, 30].map(days => dailyBonus(days, false))).toEqual([100, 120, 220, 220, 220]);
    expect(dailyBonus(1, true)).toBe(150);
    expect(dailyBonus(7, true)).toBe(330);
    expect(dailyBonus(0, false)).toBe(100);
  });

  it('pays the first daily of each day once, builds the streak and resets it after a gap', () => {
    const first = claimDailyBonus(EMPTY_DAILY, '2026-10-20', false);
    expect(first).toMatchObject({ bonus: 100, streak: 1 });
    // A second attempt the same day pays nothing and leaves the streak alone.
    expect(claimDailyBonus(first.record, '2026-10-20', true)).toMatchObject({ bonus: 0, streak: 1 });
    const second = claimDailyBonus(first.record, '2026-10-21', true);
    expect(second).toMatchObject({ bonus: 180, streak: 2 });
    // Replaying an older daily (a results-screen retry after midnight) never pays again.
    expect(claimDailyBonus(second.record, '2026-10-20', true).bonus).toBe(0);
    // Missing 22 October breaks the streak.
    expect(claimDailyBonus(second.record, '2026-10-23', false)).toMatchObject({ bonus: 100, streak: 1 });
    expect(claimDailyBonus(EMPTY_DAILY, 'not-a-date', true).bonus).toBe(0);
  });

  it('reports the streak the menu shows', () => {
    const record = { ...EMPTY_DAILY, streak: 4, lastPlayedDate: '2026-10-21' };
    expect(streakStatus(record, '2026-10-21')).toEqual({ streak: 4, claimed: true, next: 4 });
    expect(streakStatus(record, '2026-10-22')).toEqual({ streak: 4, claimed: false, next: 5 });
    expect(streakStatus(record, '2026-10-24')).toEqual({ streak: 0, claimed: false, next: 1 });
    expect(normalizeDaily({ streak: 5 }).streak).toBe(0);
    expect(normalizeDaily({ streak: 5, lastPlayedDate: '2026-10-21' }).streak).toBe(5);
  });
});

describe('threat levels', () => {
  it('opens one level above the best clear per sector, up to V', () => {
    expect(availableThreat([-1, -1, -1], 2)).toBe(0);
    expect(availableThreat([0, 3, 5], 0)).toBe(1);
    expect(availableThreat([0, 3, 5], 1)).toBe(4);
    expect(availableThreat([0, 3, 5], 2)).toBe(5);
    expect(allowedThreat([0, -1, -1], 0, 4)).toBe(1);
    expect(allowedThreat([0, -1, -1], 1, 4)).toBe(0);
    expect(allowedThreat([4, -1, -1], 0, -3)).toBe(0);
  });

  it('records clears without ever lowering them or skipping a level', () => {
    expect(recordThreatClear([-1, -1, -1], 2, 0)).toEqual([-1, -1, 0]);
    expect(recordThreatClear([2, -1, -1], 0, 3)).toEqual([3, -1, -1]);
    expect(recordThreatClear([3, -1, -1], 0, 1)).toEqual([3, -1, -1]);
    // A crafted level above the unlocked one counts only as the unlocked one.
    expect(recordThreatClear([0, -1, -1], 0, 5)).toEqual([1, -1, -1]);
  });

  it('migrates older saves from their sector victories and validates each slot', () => {
    expect(normalizeThreatCleared(undefined, [2, 0, 1])).toEqual([0, -1, 0]);
    expect(normalizeThreatCleared([4, 'x', 9], [0, 3, 0])).toEqual([4, 0, 5]);
    expect(normalizeThreatCleared([-7, 1.8], [0, 0, 0])).toEqual([-1, 1, -1]);
  });

  it('pays +0.25 per level and labels I-V', () => {
    expect([0, 1, 3, 5].map(threatRewardMultiplier)).toEqual([1, 1.25, 1.75, 2.25]);
    expect([0, 1, 4, 5].map(threatNumeral)).toEqual(['', 'I', 'IV', 'V']);
  });
});
