import Phaser from 'phaser';
import { WEAPON_SILHOUETTES, type WeaponMode } from './WeaponSilhouettes';

/** Procedural Cyberleek weapons whose origin is the grip held by the right hand. */
export class WeaponVisual extends Phaser.GameObjects.Container {
  private key = '';
  private slide?: Phaser.GameObjects.Container;
  muzzleDistance = WEAPON_SILHOUETTES.pulse.muzzleDistance;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.name = 'player-aimed-weapon';
  }

  setWeapon(mode: WeaponMode, color: number) {
    const key = `${mode}-${color}`;
    if (key === this.key) return;
    this.key = key;
    this.removeAll(true);
    const spec = WEAPON_SILHOUETTES[mode];
    this.muzzleDistance = spec.muzzleDistance;

    const grip = this.scene.add.graphics();
    grip.fillStyle(0x07111f).fillRoundedRect(-5, -2, 10, 17, 3)
      .lineStyle(2, 0x547383).strokeRoundedRect(-5, -2, 10, 17, 3)
      .fillStyle(0x73ef62).fillCircle(0, 2, 3);
    const body = this.scene.add.graphics();
    body.name = `weapon-${mode}`;
    body.fillStyle(0x07111f).fillRoundedRect(-3, -spec.bodyHeight / 2, spec.bodyLength, spec.bodyHeight, 4)
      .lineStyle(2, 0x66899a).strokeRoundedRect(-3, -spec.bodyHeight / 2, spec.bodyLength, spec.bodyHeight, 4);

    if (mode === 'pulse') {
      body.fillStyle(color).fillRoundedRect(5, -4, 18, 5, 2)
        .fillStyle(0xbaf8ff).fillRect(24, -2, 8, 3)
        .fillStyle(0x234250).fillTriangle(7, 7, 19, 7, 14, 12);
    } else if (mode === 'plasma') {
      body.fillStyle(0x182837).fillCircle(14, 0, 10)
        .lineStyle(3, color, 0.95).strokeCircle(14, 0, 7)
        .fillStyle(color, 0.65).fillCircle(14, 0, 4)
        .fillStyle(0x314b58).fillRoundedRect(25, -6, 18, 12, 3)
        .fillStyle(color).fillCircle(43, 0, 5);
    } else if (mode === 'arc') {
      body.lineStyle(3, color).strokeCircle(14, 0, 7)
        .lineStyle(2, 0xbfffb5).lineBetween(8, 0, 20, 0)
        .fillStyle(0x314b58).fillRoundedRect(22, -5, 12, 10, 2)
        .lineStyle(3, color).lineBetween(34, -4, 41, -8).lineBetween(34, 4, 41, 8);
    } else {
      body.fillStyle(color).fillRect(4, -2, 39, 4)
        .fillStyle(0x263f4d).fillRect(9, -8, 27, 4)
        .fillStyle(0xcdfaff).fillCircle(45, 0, 3);
    }
    this.slide = this.scene.add.container(0, 0, [body]);
    this.add([grip, this.slide]);
  }

  setRecoil(amount: number) {
    this.slide?.setX(-amount * 0.55);
    return this;
  }
}
