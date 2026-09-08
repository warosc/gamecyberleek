import Phaser from 'phaser';
import { BOSS_START_MS, MINIBOSS_START_MS } from '../config/RunPacing';
import { ARENA, Events } from '../config/Constants';
import { Enemy } from '../entities/enemies/Enemy';
import { EnemyType } from '../entities/enemies/EnemyTypes';
import type { Player } from '../entities/player/Player';
import { BOSS_IDENTITY } from '../entities/enemies/BossVisual';

/** Owns encounter milestones; combat and victory resolution remain in GameScene. */
export class EncounterSystem {
  private bossSpawned = false;
  private minibossSpawned = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly enemies: Phaser.Physics.Arcade.Group,
    private readonly player: Player,
    private readonly sector = 0,
  ) {}

  get hasBossSpawned() {
    return this.bossSpawned;
  }

  update(survivalMs: number) {
    if (survivalMs >= MINIBOSS_START_MS && !this.minibossSpawned) this.spawnMiniboss();
    if (survivalMs >= BOSS_START_MS && !this.bossSpawned) this.spawnBoss();
  }

  spawnMiniboss() {
    if (this.minibossSpawned || this.bossSpawned) return false;
    this.minibossSpawned = true;
    const x = Phaser.Math.Clamp(this.player.x + 430, 90, ARENA.width - 90);
    const y = Phaser.Math.Clamp(this.player.y - 230, 90, ARENA.height - 90);
    const miniboss = new Enemy(this.scene, x, y, EnemyType.MINIBOSS);
    const multiplier = 1 + Math.min(this.sector, 2) * 0.18;
    miniboss.health.max = Math.round(miniboss.health.max * multiplier);
    miniboss.health.current = miniboss.health.max;
    this.enemies.add(miniboss);
    this.scene.events.emit(Events.MINIBOSS_SPAWNED, 'REM-Ω', miniboss.health.max);
    this.scene.cameras.main.shake(420, 0.008);
    return true;
  }

  spawnBoss() {
    if (this.bossSpawned) return false;
    this.bossSpawned = true;
    // Clear the teaching wave so the finale can be read without a crowd of old warnings.
    this.enemies.clear(true, true);
    const x = Phaser.Math.Clamp(this.player.x + 520, 100, ARENA.width - 100);
    const y = Phaser.Math.Clamp(this.player.y - 300, 100, ARENA.height - 100);
    const boss = new Enemy(this.scene, x, y, EnemyType.BOSS);
    this.enemies.add(boss);
    this.scene.events.emit(Events.BOSS_SPAWNED, BOSS_IDENTITY.name, boss.health.max);
    this.scene.cameras.main.shake(700, 0.012);
    return true;
  }
}
