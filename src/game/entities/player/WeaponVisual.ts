import Phaser from 'phaser';
import { WEAPON_SILHOUETTES, type WeaponMode } from './WeaponSilhouettes';

/** Procedural Cyberleek weapons whose origin is the grip held by the right hand. */
export class WeaponVisual extends Phaser.GameObjects.Container {
  private key = '';
  private slide?: Phaser.GameObjects.Container;
  private readonly energyParts: Phaser.GameObjects.GameObject[] = [];
  private mode: WeaponMode = 'pulse';
  private tier = 1;
  muzzleDistance = WEAPON_SILHOUETTES.pulse.muzzleDistance;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.name = 'player-aimed-weapon';
  }

  setWeapon(mode: WeaponMode, color: number, tier = 1) {
    const key = `${mode}-${color}-${tier}`;
    if (key === this.key) return;
    this.key = key;
    this.mode = mode;
    this.tier = tier;
    this.removeAll(true);
    this.energyParts.length = 0;
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
    const energy = this.scene.add.circle(
      mode === 'plasma' ? 14 : mode === 'arc' ? 15 : mode === 'laser' ? 32 : 13,
      mode === 'arc' ? 0 : -1,
      mode === 'plasma' ? 5 : 3,
      color,
      0.75,
    ).setBlendMode(Phaser.BlendModes.ADD).setName(`weapon-${mode}-energy`);
    this.energyParts.push(energy);
    if (tier > 1) {
      const crown = this.scene.add.graphics();
      crown.name = 'weapon-evolution-crown';
      crown.lineStyle(2, color, 0.9)
        .lineBetween(6, -spec.bodyHeight / 2 - 3, 13, -spec.bodyHeight / 2 - 8)
        .lineBetween(13, -spec.bodyHeight / 2 - 8, 20, -spec.bodyHeight / 2 - 3)
        .lineStyle(1, 0xeaffff, 0.8).lineBetween(23, -spec.bodyHeight / 2 - 4, 34, -spec.bodyHeight / 2 - 4);
      this.energyParts.push(crown);
      this.add(crown);
    }
    this.slide = this.scene.add.container(0, 0, [body]);
    this.slide.add(energy);
    this.add([grip, this.slide]);
  }

  setRecoil(amount: number) {
    this.slide?.setX(-amount * 0.55);
    return this;
  }

  animate(time: number, firing: boolean) {
    const pulse = 0.72 + Math.sin(time * (this.mode === 'arc' ? 0.018 : 0.009)) * 0.22;
    for (const [index, part] of this.energyParts.entries()) {
      const visual = part as unknown as Phaser.GameObjects.Components.Alpha & Phaser.GameObjects.Components.Transform;
      visual.setAlpha(Math.min(1, pulse + (firing ? 0.25 : 0)));
      if (index === 0) visual.setScale(1 + Math.sin(time * 0.014) * 0.12 + (this.tier - 1) * 0.08);
    }
    if (this.mode === 'arc' && this.slide) this.slide.setAngle(Math.sin(time * 0.02) * 1.5);
    return this;
  }
}
