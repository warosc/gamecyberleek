import Phaser from 'phaser';
import { BOSS_START_MS, MINIBOSS_START_MS } from '../config/RunPacing';
import { ARENA, Events } from '../config/Constants';
import { Enemy } from '../entities/enemies/Enemy';
import { EnemyType } from '../entities/enemies/EnemyTypes';
import type { Player } from '../entities/player/Player';
import { bossVariant } from '../entities/enemies/BossVisual';
import { MINIBOSS_VARIANTS } from '../entities/enemies/MinibossVisual';
import { shakeCamera } from './RuntimeSettings';
import { combatRating } from './BuildProgression';
import { bossHealth, minibossHealth, sectorDamageMultiplier } from '../config/EnemyScaling';

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
    const miniboss = new Enemy(this.scene, x, y, EnemyType.MINIBOSS, this.sector);
    // Scaled like the wave it arrives with (time factor at 2:30, ×2.0), not a flat +18 % per
    // sector that left it a 560 HP speed bump for a mid-run build.
    const base = miniboss.health.max;
    miniboss.applyScaling(minibossHealth(base, this.sector) / base, sectorDamageMultiplier(this.sector));
    this.enemies.add(miniboss);
    const identity = MINIBOSS_VARIANTS[Math.min(this.sector, 2)];
    this.scene.events.emit(Events.MINIBOSS_SPAWNED, identity.name, identity.title, identity.accent, miniboss.health.max);
    shakeCamera(this.scene.cameras.main, 420, 0.008);
    return true;
  }

  spawnBoss() {
    if (this.bossSpawned) return false;
    this.bossSpawned = true;
    // A miniboss still alive withdraws with the wave. It was not defeated, so it drops nothing,
    // but its health bar listens for 0 to hide and would otherwise stay up for the whole fight.
    for (const object of this.enemies.getChildren()) {
      const enemy = object as Enemy;
      if (enemy.active && enemy.enemyType === EnemyType.MINIBOSS)
        this.scene.events.emit(Events.MINIBOSS_HEALTH, 0, enemy.health.max);
    }
    // Clear the teaching wave so the finale can be read without a crowd of old warnings.
    this.enemies.clear(true, true);
    const x = Phaser.Math.Clamp(this.player.x + 520, 100, ARENA.width - 100);
    const y = Phaser.Math.Clamp(this.player.y - 300, 100, ARENA.height - 100);
    const identity = bossVariant(this.sector);
    const boss = new Enemy(this.scene, x, y, EnemyType.BOSS, this.sector);
    // Sized against the build that has to beat it: a flat 1800 HP fell in 2–5 s to a level-12
    // build, so phases 2 and 3 were almost never seen. See bossHealth for the floor and cap.
    const base = boss.health.max;
    const hp = bossHealth(base, this.sector, combatRating(this.player.stats).dps);
    boss.applyScaling(hp / base, sectorDamageMultiplier(this.sector));
    this.enemies.add(boss);
    this.scene.events.emit(Events.BOSS_SPAWNED, identity.name, boss.health.max);
    shakeCamera(this.scene.cameras.main, 700, 0.012);
    return true;
  }
}
