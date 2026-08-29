import Phaser from 'phaser';
import { ARENA, GAMEPLAY } from '../config/Constants';
import type { EnemyFactory } from '../entities/enemies/EnemyFactory';
import { EnemyType, type EliteAffix } from '../entities/enemies/EnemyTypes';
export class SpawnSystem {
  private elapsed = 0;
  private next = 500;
  constructor(
    private factory: EnemyFactory,
    private group: Phaser.Physics.Arcade.Group,
    private readonly sector = 0,
  ) {}
  update(delta: number, player: { x: number; y: number }) {
    this.elapsed += delta;
    if (this.elapsed < this.next) return;
    this.next = this.elapsed + Math.max(
      GAMEPLAY.spawnMinimumIntervalMs,
      GAMEPLAY.spawnBaseIntervalMs - this.elapsed / 180,
    );
    if (this.group.countActive(true) >= GAMEPLAY.maxEnemies) return;
    const angle = Math.random() * Math.PI * 2;
    const distance = 500 + Math.random() * 180;
    const x = Phaser.Math.Clamp(player.x + Math.cos(angle) * distance, 40, ARENA.width - 40);
    const y = Phaser.Math.Clamp(player.y + Math.sin(angle) * distance, 40, ARENA.height - 40);
    const roll = Math.random();
    const type =
      roll < Math.min(0.14, this.elapsed / 90000)
        ? EnemyType.TANK
        : roll < 0.32
          ? EnemyType.SHOOTER
          : roll < 0.52
            ? EnemyType.RUNNER
            : EnemyType.GRUNT;
    const enemy = this.factory.create(type, x, y);
    if (
      this.elapsed > GAMEPLAY.eliteStartMs &&
      Math.random() < Math.min(GAMEPLAY.eliteMaxChance, this.elapsed / 1200000)
    )
      enemy.eliteAffix = this.rollEliteAffix();
      enemy.makeElite();
    this.group.add(enemy);
  }

  private rollEliteAffix(): EliteAffix {
    const weights = GAMEPLAY.eliteAffixWeightsBySector[
      Math.min(this.sector, GAMEPLAY.eliteAffixWeightsBySector.length - 1)
    ] ?? GAMEPLAY.eliteAffixWeights;
    const total = weights.OVERCHARGED + weights.ARMORED + weights.SWIFT;
    const roll = Math.random() * total;
    if (roll < weights.OVERCHARGED) return 'OVERCHARGED';
    if (roll < weights.OVERCHARGED + weights.ARMORED) return 'ARMORED';
    return 'SWIFT';
  }
}
