import Phaser from 'phaser';
import { calculateDamage } from '../../systems/CombatSystem';
import type { PlayerStats } from '../player/PlayerStats';
import { Projectile } from './Projectile';
export class ProjectileManager {
  readonly group: Phaser.Physics.Arcade.Group;
  constructor(private scene: Phaser.Scene) {
    this.group = scene.physics.add.group({
      classType: Projectile,
      maxSize: 90,
      runChildUpdate: false,
    });
  }
  fire(
    x: number,
    y: number,
    angle: number,
    stats: PlayerStats,
    time: number,
    damageMultiplier = 1,
  ) {
    const p = this.group.get(
      x + Math.cos(angle) * 38,
      y + Math.sin(angle) * 38,
    ) as Projectile | null;
    if (!p) return;
    const hit = calculateDamage(stats.attackDamage * damageMultiplier, stats.criticalChance);
    p.damage = hit.amount;
    p.critical = hit.critical;
    p.born = time;
    p.enableBody(true, p.x, p.y, true, true);
    p.setTint(stats.projectileColor);
    p.setScale(stats.projectileScale * (hit.critical ? 1.5 : 1));
    this.scene.physics.velocityFromRotation(angle, stats.projectileSpeed, p.body!.velocity);
    this.scene.events.emit('weapon-fired', x, y, angle);
  }
  update(time: number) {
    this.group.getChildren().forEach((o) => {
      const p = o as Projectile;
      if (p.active && time - p.born > 1400) p.disableBody(true, true);
    });
  }
}
