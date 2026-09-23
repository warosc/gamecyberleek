import Phaser from 'phaser';
import { ARENA, Events } from '../config/Constants';
import type { Player } from '../entities/player/Player';
import { HAZARD_FIRST_MS, HAZARD_INTERVAL_MS, HAZARD_LEAD_MS, SECTOR_HAZARDS, sectorHazardHits } from '../config/SectorHazards';

/** One bounded, gameplay-time-driven arena hazard; pausing cannot release it behind a modal. */
export class SectorHazardSystem {
  private nextAt = HAZARD_FIRST_MS;
  private pending?: { origin: Phaser.Math.Vector2; releaseAt: number; visual: Phaser.GameObjects.Graphics };
  private introduced = false;
  private readonly definition;

  constructor(private readonly scene: Phaser.Scene, private readonly player: Player, private readonly sector: number) {
    this.definition = SECTOR_HAZARDS[Math.min(Math.max(sector, 0), 2)];
  }

  update(gameTime: number, enabled: boolean) {
    if (!enabled) {
      if (this.pending) {
        this.scene.tweens.killTweensOf(this.pending.visual);
        this.pending.visual.destroy();
        this.pending = undefined;
      }
      return;
    }
    if (!this.pending && gameTime >= this.nextAt) this.warn(gameTime);
    if (!this.pending || gameTime < this.pending.releaseAt) return;
    const pending = this.pending;
    this.pending = undefined;
    if (sectorHazardHits(this.sector, this.player, pending.origin)) this.player.takeDamage(this.definition.damage);
    this.release(pending.visual);
  }

  private warn(gameTime: number) {
    this.nextAt = gameTime + HAZARD_INTERVAL_MS;
    const origin = new Phaser.Math.Vector2(this.player.x, this.player.y);
    const visual = this.scene.add.graphics().setDepth(4);
    visual.fillStyle(this.definition.color, 0.1).lineStyle(3, this.definition.color, 0.9);
    if (this.sector === 0) {
      visual.fillRect(origin.x - 42, 0, 84, ARENA.height).strokeRect(origin.x - 42, 0, 84, ARENA.height);
      visual.fillRect(0, origin.y - 42, ARENA.width, 84).strokeRect(0, origin.y - 42, ARENA.width, 84);
    } else if (this.sector === 1) {
      visual.fillCircle(origin.x, origin.y, 145).strokeCircle(origin.x, origin.y, 145);
      visual.strokeCircle(origin.x, origin.y, 95).strokeCircle(origin.x, origin.y, 48);
    } else {
      for (const offset of [-150, 0, 150])
        visual.fillRect(origin.x + offset - 48, 0, 96, ARENA.height)
          .strokeRect(origin.x + offset - 48, 0, 96, ARENA.height);
    }
    visual.setAlpha(0.25);
    this.scene.tweens.add({ targets: visual, alpha: 0.9, duration: HAZARD_LEAD_MS / 3, yoyo: true, repeat: 1 });
    this.pending = { origin, releaseAt: gameTime + HAZARD_LEAD_MS, visual };
    this.scene.events.emit('enemy-warning', 'hazard');
    if (!this.introduced) {
      this.introduced = true;
      this.scene.events.emit(Events.RUN_PHASE_CHANGED, this.definition);
    }
  }

  private release(visual: Phaser.GameObjects.Graphics) {
    visual.setAlpha(1).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.cameras.main.flash(110, (this.definition.color >> 16) & 255,
      (this.definition.color >> 8) & 255, this.definition.color & 255, false);
    this.scene.tweens.add({ targets: visual, alpha: 0, duration: 260, onComplete: () => visual.destroy() });
  }
}
