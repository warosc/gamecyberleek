import Phaser from 'phaser';
export class Projectile extends Phaser.Physics.Arcade.Image {
  damage = 0;
  critical = false;
  born = 0;
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'energy');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setBlendMode(Phaser.BlendModes.ADD);
  }
}
