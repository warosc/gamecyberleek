import Phaser from 'phaser';
import { Projectile } from '../entities/projectiles/Projectile';

export const BARREL_CONFIG = {
  damage: 75,
  radius: 175,
  positions: [[420, 330], [1580, 340], [470, 910], [1510, 880], [1000, 250], [1000, 960]],
} as const;

export class ExplosiveBarrelSystem {
  readonly group: Phaser.Physics.Arcade.StaticGroup;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onExplode: (x: number, y: number, damage: number, radius: number) => void,
  ) {
    this.group = scene.physics.add.staticGroup();
    for (const [x, y] of BARREL_CONFIG.positions) {
      const barrel = scene.add.rectangle(x, y, 34, 46, 0x7a2a25, 1)
        .setStrokeStyle(3, 0xffb52e, 0.9).setDepth(5);
      const stripe = scene.add.rectangle(x, y, 30, 8, 0xffb52e, 0.65).setDepth(6);
      barrel.setData({ armed: true, stripe });
      this.group.add(barrel);
    }
  }

  bindProjectiles(projectiles: Phaser.Physics.Arcade.Group) {
    this.scene.physics.add.overlap(projectiles, this.group, (projectile, barrel) =>
      this.hit(projectile as Projectile, barrel as Phaser.GameObjects.Rectangle),
    );
  }

  private hit(projectile: Projectile, barrel: Phaser.GameObjects.Rectangle) {
    if (!barrel.active || !(barrel.getData('armed') as boolean)) return;
    barrel.setData('armed', false);
    projectile.disableBody(true, true);
    const x = barrel.x;
    const y = barrel.y;
    (barrel.getData('stripe') as Phaser.GameObjects.Rectangle | undefined)?.destroy();
    barrel.destroy();
    this.onExplode(x, y, BARREL_CONFIG.damage, BARREL_CONFIG.radius);
    this.scene.cameras.main.shake(180, 0.008);
  }
}
