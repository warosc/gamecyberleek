import Phaser from 'phaser';
import { GAMEPLAY } from '../../config/Constants';

export class EnemyProjectileManager {
  readonly group: Phaser.Physics.Arcade.Group;
  constructor(private scene: Phaser.Scene) {
    this.group = scene.physics.add.group({ maxSize: GAMEPLAY.maxEnemyProjectiles });
  }
  fire(x: number, y: number, angle: number, speed = 280, damage = 10, gameplayTime = 0) {
    const projectile = this.group.get(x, y, 'enemy-energy') as Phaser.Physics.Arcade.Image | null;
    if (!projectile) return;
    projectile
      .enableBody(true, x, y, true, true)
      .setData('born', gameplayTime)
      .setData('damage', damage);
    projectile.setBlendMode(Phaser.BlendModes.ADD).setScale(damage > 15 ? 1.5 : 1);
    this.scene.physics.velocityFromRotation(angle, speed, projectile.body!.velocity);
  }
  update(time: number) {
    this.group.getChildren().forEach((object) => {
      const projectile = object as Phaser.Physics.Arcade.Image;
      if (projectile.active && time - (projectile.getData('born') as number) > 3500)
        projectile.disableBody(true, true);
    });
  }
}
