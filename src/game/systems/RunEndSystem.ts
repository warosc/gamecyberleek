import Phaser from 'phaser';
import { loadProfile, saveRun } from './ProfileStore';
import { masteryEarnedForRun } from '../weapons/WeaponMastery';
import type { StarterWeaponId } from '../weapons/WeaponRegistry';
import type { ContractOutcome } from './ContractSystem';
import type { RunRecord } from './RunTelemetry';
import type { RunFacts } from '../progression/Achievements';
import { ACHIEVEMENTS } from '../progression/Achievements';
import { onlineService } from '../online/OnlinePorts';
import { submitDailyRun } from '../online/OnlineSync';
import { dailyBonus } from '../progression/DailyOperation';
import { allowedThreat, availableThreat } from '../progression/ThreatLevels';

export interface RunEndData {
  time: number;
  level: number;
  victory: boolean;
  arenaIndex: number;
  /** Threat level (AMENAZA) the run was played at; 0 when absent and always 0 for the daily. */
  threat?: number;
  weaponId: StarterWeaponId;
  contracts: ContractOutcome;
  summary: Readonly<RunRecord>;
  equipment: string[];
  synergy?: string;
  facts: RunFacts;
  daily?: { date: string; mutator: string; score: number };
  /** The server ticket for this daily run, requested when it started. */
  dailyTicket?: Promise<string | undefined>;
}

/** Owns the one-way handoff from gameplay into the result screen. */
export class RunEndSystem {
  private ended = false;

  constructor(private readonly scene: Phaser.Scene, private readonly stopUi: () => void) {}

  finish(data: RunEndData) {
    if (this.ended) return false;
    this.ended = true;
    const before = loadProfile();
    const after = saveRun(data.level, data.victory, data.weaponId, data.contracts, data.facts,
      data.daily && { date: data.daily.date, score: data.daily.score }, { threat: data.daily ? 0 : data.threat });
    const newUnlocks = after.unlocks.filter(id => !before.unlocks.includes(id));
    // Fire and forget: a network outage must never hold up the results screen.
    const online = onlineService();
    const daily = data.daily;
    if (daily) void (data.dailyTicket ?? Promise.resolve(undefined)).then(ticket => submitDailyRun(online, daily.date, {
      kills: data.facts.kills, level: data.level, durationMs: data.facts.durationMs, victory: data.victory, ticket,
    }));
    // A 409 means another device is further ahead: the cloud copy is kept and the menu says so.
    if (online.online) void online.uploadProfile(after).catch(() => undefined);
    const newAchievements = ACHIEVEMENTS.filter(achievement =>
      after.achievements.includes(achievement.id) && !before.achievements.includes(achievement.id))
      .map(({ name, reward }) => ({ name, reward }));
    const dailyBest = Boolean(data.daily && (before.daily.date !== data.daily.date || data.daily.score > before.daily.bestScore));
    // The bonus was paid exactly when the paid date moved; the streak it counted is the saved one.
    const dailyPaid = Boolean(data.daily && after.daily.lastPlayedDate !== before.daily.lastPlayedDate);
    const sector = data.arenaIndex;
    const threatUnlocked = !data.daily && availableThreat(after.threatCleared, sector) > availableThreat(before.threatCleared, sector)
      ? availableThreat(after.threatCleared, sector) : undefined;
    this.stopUi();
    this.scene.scene.start('GameOver', {
      ...data,
      threat: data.daily ? 0 : allowedThreat(before.threatCleared, sector, data.threat ?? 0),
      dailyBonus: dailyPaid ? dailyBonus(after.daily.streak, data.victory) : 0,
      dailyStreak: data.daily ? after.daily.streak : undefined,
      threatUnlocked,
      masteryEarned: masteryEarnedForRun(data.level, data.victory),
      creditsEarned: after.bioCredits - before.bioCredits,
      newUnlocks,
      newAchievements,
      dailyBest,
    });
    return true;
  }
}
