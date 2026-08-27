import Phaser from 'phaser';
import { resolveDamage } from '../../systems/CombatSystem';
import type { PlayerStats } from '../player/PlayerStats';
import { Projectile } from './Projectile';
import { GAMEPLAY } from '../../config/Constants';
export class ProjectileManager {
  readonly group: Phaser.Physics.Arcade.Group;
  constructor(private scene: Phaser.Scene) {
    this.group = scene.physics.add.group({
      classType: Projectile,
      maxSize: GAMEPLAY.maxPlayerProjectiles,
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
    const hit = resolveDamage({
      baseAmount: stats.attackDamage * damageMultiplier,
      type: stats.weaponMode === 'plasma' ? 'plasma' : 'energy',
      source: 'player',
      criticalChance: stats.criticalChance,
    });
    p.damage = hit.amount;
    p.critical = hit.critical;
    p.born = time;
    p.mode = stats.weaponMode;
    p.hitsRemaining = stats.projectilePiercing;
    p.splashRadius = stats.splashRadius;
    p.hitTargets.clear();
    p.enableBody(true, p.x, p.y, true, true);
    p.setTint(stats.projectileColor);
    const scale = stats.projectileScale * (hit.critical ? 1.5 : 1);
    p.setScale(stats.weaponMode === 'laser' ? scale * 2.2 : scale, stats.weaponMode === 'laser' ? scale * 0.42 : scale);
    p.setRotation(angle);
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
