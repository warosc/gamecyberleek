import Phaser from 'phaser';
import { ARENA, Events, RUN_DURATION_MS } from '../config/Constants';
import { Enemy } from '../entities/enemies/Enemy';
import { EnemyType } from '../entities/enemies/EnemyTypes';
import type { Player } from '../entities/player/Player';

/** Owns encounter milestones; combat and victory resolution remain in GameScene. */
export class EncounterSystem {
  private bossSpawned = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly enemies: Phaser.Physics.Arcade.Group,
    private readonly player: Player,
  ) {}

  get hasBossSpawned() {
    return this.bossSpawned;
  }

  update(survivalMs: number) {
    if (survivalMs >= RUN_DURATION_MS && !this.bossSpawned) this.spawnBoss();
  }

  spawnBoss() {
    if (this.bossSpawned) return false;
    this.bossSpawned = true;
    const x = Phaser.Math.Clamp(this.player.x + 520, 100, ARENA.width - 100);
    const y = Phaser.Math.Clamp(this.player.y - 300, 100, ARENA.height - 100);
    const boss = new Enemy(this.scene, x, y, EnemyType.BOSS);
    this.enemies.add(boss);
    this.scene.events.emit(Events.BOSS_SPAWNED, 'BROCCOLI COMMANDER', boss.health.max);
    this.scene.cameras.main.shake(700, 0.012);
    return true;
  }
}
