import Phaser from 'phaser';
import type { Equipment } from './Equipment';

export class EquipmentDrop extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number, readonly equipment: Equipment) {
    super(scene, x, y);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const glow = scene.add.circle(0, 0, 31, equipment.color, 0.16).setStrokeStyle(2, equipment.color, 0.8);
    const caseBody = scene.add.rectangle(0, 0, 42, 30, 0x07111f, 0.96).setStrokeStyle(3, equipment.color);
    const icon = scene.add.text(0, -1, equipment.kind === 'weapon' ? '⚡' : '◆', {
      fontFamily: 'Arial Black', fontSize: '19px', color: '#ffffff',
    }).setOrigin(0.5);
    const beam = scene.add.rectangle(0, -55, 5, 75, equipment.color, 0.22);
    this.add([beam, glow, caseBody, icon]);
    this.setSize(52, 48).setDepth(9);
    (this.body as Phaser.Physics.Arcade.Body).setSize(52, 48).setImmovable(true);
    scene.tweens.add({ targets: this, y: y - 8, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: glow, alpha: { from: 0.12, to: 0.42 }, scale: 1.22, duration: 520, yoyo: true, repeat: -1 });
  }
}
