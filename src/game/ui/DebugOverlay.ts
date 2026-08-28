import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import { reportPerf } from '../systems/DevTelemetry';

export class DebugOverlay {
  private worstFrameMs = 0;
  private reportedWorstFrameMs = 0;
  private frameWindowMs = 0;

  constructor(private readonly game: Phaser.Game, private readonly scene: GameScene, private readonly text: Phaser.GameObjects.Text) {}

  update(delta: number) {
    const seconds = Math.floor(this.scene.survivalMs / 1000);
    this.worstFrameMs = Math.max(this.worstFrameMs, delta);
    this.frameWindowMs += delta;
    if (this.frameWindowMs >= 1000) {
      this.reportedWorstFrameMs = this.worstFrameMs;
      this.worstFrameMs = 0;
      this.frameWindowMs = 0;
    }
    const displayObjects = this.scene.children.length;
    const tweens = this.scene.tweens.getTweens().length;
    const enemies = this.scene.enemies.countActive(true);
    const projectiles = this.scene.projectiles.group.countActive(true);
    const enemyProjectiles = this.scene.enemyProjectiles.group.countActive(true);
    const orbs = this.scene.orbs.countActive(true);
    reportPerf({ runSeconds: seconds, fps: Math.round(this.game.loop.actualFps), worstFrameMs: Math.round(Math.max(this.reportedWorstFrameMs, this.worstFrameMs)), displayObjects, tweens, enemies, projectiles, orbs });
    this.text.setText([
      `FPS ${Math.round(this.game.loop.actualFps)}  worst ${Math.round(this.reportedWorstFrameMs)}ms`,
      `Display objs ${displayObjects}  tweens ${tweens}`,
      `Enemies ${enemies}`,
      `Projectiles ${projectiles}  enemy ${enemyProjectiles}`,
      `XP orbs ${orbs}`,
      `HP ${Math.ceil(this.scene.player.health.current)}/${this.scene.player.health.max}`,
      `Player ${Math.round(this.scene.player.x)}, ${Math.round(this.scene.player.y)}`,
      `State ${this.scene.state}`,
      `Run ${Math.floor(this.scene.survivalMs / 1000)}s`,
      `Weapon ${this.scene.player.stats.weaponName}`,
      `Rig ${this.scene.player.usesLayeredRig ? 'LAYERED' : 'FALLBACK'}  Anim ${this.scene.player.animationState}`,
      `Effects ${this.scene.player.isShieldActive() ? 'SHIELD ' : ''}${this.scene.player.isOverdriveActive() ? 'OVERDRIVE' : ''}`,
    ]);
  }
}
