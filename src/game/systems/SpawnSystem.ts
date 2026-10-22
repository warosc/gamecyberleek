import Phaser from 'phaser';
import { runPhase } from '../config/RunPacing';
import { ARENA, GAMEPLAY } from '../config/Constants';
import type { EnemyFactory } from '../entities/enemies/EnemyFactory';
import { EnemyType, type EliteAffix } from '../entities/enemies/EnemyTypes';
import { runRandom } from './RunRandom';

/** Families each sector adds to the base waves, from `FAMILY_START_MS`. */
export const SECTOR_FAMILIES: readonly (readonly EnemyType[])[] = [
  [EnemyType.BROOD],
  [EnemyType.MEDIC, EnemyType.BROOD],
  [EnemyType.BULWARK, EnemyType.MEDIC],
];
export const FAMILY_START_MS = 100000;
export const FAMILY_CHANCE = 0.18;
export class SpawnSystem {
  private elapsed = 0;
  private next = 500;
  constructor(
    private factory: EnemyFactory,
    private group: Phaser.Physics.Arcade.Group,
    private readonly sector = 0,
    /** Threat level (AMENAZA); multiplies wave health on top of time and sector. */
    private readonly threat = 0,
  ) {}
  /**
   * `survivalMs` is the scene's gameplay clock, which drives enemy health scaling. The spawn
   * clock is a separate counter that only advances when this is called, so the scene's clock is
   * the source of truth; `elapsed` is only the fallback for callers that do not pass it.
   */
  update(delta: number, player: { x: number; y: number }, survivalMs?: number) {
    this.elapsed += delta;
    if (this.elapsed < this.next) return;
    const phase = runPhase(this.elapsed);
    this.next = this.elapsed + phase.interval;
    if (this.group.countActive(true) >= Math.min(GAMEPLAY.maxEnemies, phase.cap)) return;
    const angle = runRandom('spawn') * Math.PI * 2;
    const distance = 500 + runRandom('spawn') * 180;
    const x = Phaser.Math.Clamp(player.x + Math.cos(angle) * distance, 40, ARENA.width - 40);
    const y = Phaser.Math.Clamp(player.y + Math.sin(angle) * distance, 40, ARENA.height - 40);
    let type: EnemyType | undefined = phase.types[Math.floor(runRandom('spawn') * phase.types.length)];
    if (!type) return;
    const families = SECTOR_FAMILIES[Math.min(this.sector, SECTOR_FAMILIES.length - 1)];
    if (this.elapsed >= FAMILY_START_MS && runRandom('spawn') < FAMILY_CHANCE)
      type = families[Math.floor(runRandom('spawn') * families.length)];
    // Health scales with run time, sector and threat before any elite roll, so an affix multiplies
    // the already scaled pool instead of being overwritten by it.
    const enemy = this.factory.create(type, x, y, survivalMs ?? this.elapsed, this.sector, this.threat);
    // Both statements are the elite branch. Without the braces `makeElite()` ran
    // unconditionally, so every spawn from the first second was an elite: the crown and
    // affix label stopped meaning anything and every grunt carried 2.2x health.
    if (
      this.elapsed > GAMEPLAY.eliteStartMs &&
      runRandom('spawn') < Math.min(GAMEPLAY.eliteMaxChance, this.elapsed / 1200000)
    ) {
      enemy.eliteAffix = this.rollEliteAffix();
      enemy.makeElite();
    }
    this.group.add(enemy);
  }

  private rollEliteAffix(): EliteAffix {
    const weights = GAMEPLAY.eliteAffixWeightsBySector[
      Math.min(this.sector, GAMEPLAY.eliteAffixWeightsBySector.length - 1)
    ] ?? GAMEPLAY.eliteAffixWeights;
    const total = weights.OVERCHARGED + weights.ARMORED + weights.SWIFT;
    const roll = runRandom('spawn') * total;
    if (roll < weights.OVERCHARGED) return 'OVERCHARGED';
    if (roll < weights.OVERCHARGED + weights.ARMORED) return 'ARMORED';
    return 'SWIFT';
  }
}
