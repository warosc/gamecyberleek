import Phaser from 'phaser';
import { ARENA, Events, GAMEPLAY } from '../config/Constants';
import { BOSS_PHASE_CALLOUTS, BOSS_REINFORCEMENTS } from '../config/BossPhases';
import { Enemy } from '../entities/enemies/Enemy';

/** Owns one-shot phase transitions, leaving the boss itself focused on attack behavior. */
export class BossPhaseDirector {
  private readonly entered = new Set<number>();
  constructor(private readonly scene: Phaser.Scene, private readonly enemies: Phaser.Physics.Arcade.Group,
    private readonly sector: number) {}

  enter(phase: 2 | 3, boss: Enemy) {
    if (this.entered.has(phase)) return false;
    this.entered.add(phase);
    this.scene.events.emit(Events.RUN_PHASE_CHANGED, BOSS_PHASE_CALLOUTS[phase]);
    const definition = BOSS_REINFORCEMENTS[Math.min(Math.max(this.sector, 0), 2)];
    const types = phase === 2 ? definition.phase2 : definition.phase3;
    const available = Math.max(0, GAMEPLAY.maxEnemies - this.enemies.countActive(true));
    types.slice(0, available).forEach((type, index) => {
      const angle = index * Math.PI * 2 / types.length + (phase === 3 ? Math.PI / 4 : 0);
      const x = Phaser.Math.Clamp(boss.x + Math.cos(angle) * 210, 70, ARENA.width - 70);
      const y = Phaser.Math.Clamp(boss.y + Math.sin(angle) * 210, 70, ARENA.height - 70);
      this.enemies.add(new Enemy(this.scene, x, y, type));
    });
    const ring = this.scene.add.circle(boss.x, boss.y, 75, phase === 3 ? 0xff476f : 0xffb52e, 0.06)
      .setStrokeStyle(6, phase === 3 ? 0xff476f : 0xffb52e, 0.95).setDepth(15);
    this.scene.tweens.add({ targets: ring, scale: phase === 3 ? 7 : 5, alpha: 0,
      duration: 650, ease: 'Quad.Out', onComplete: () => ring.destroy() });
    return true;
  }
}
