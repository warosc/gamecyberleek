import Phaser from 'phaser';
import { detectQualityProfile } from '../../config/QualityProfile';

export const BOSS_IDENTITY = {
  name: 'BRÓK-9',
  title: 'COMANDANTE DE LA BRECHA',
  texture: 'brok9-commander',
  asset: 'assets/enemies/brok9/commander.png',
  phases: ['CONTENCIÓN', 'SOBRECARGA', 'RUPTURA'],
  colors: [0xd566ff, 0xffb52e, 0xff476f],
} as const;

/** The production sprite stays upright like Cyberleek; only presentation follows its pose. */
export class BossVisual extends Phaser.GameObjects.Container {
  private readonly model: Phaser.GameObjects.Container;
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly ground: Phaser.GameObjects.Graphics;
  private readonly core: Phaser.GameObjects.Arc;
  private readonly ports: Phaser.GameObjects.Arc[];
  private readonly vents: Phaser.GameObjects.Rectangle[];
  private readonly motion = detectQualityProfile().tier !== 'low';
  private phase = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.name = 'brok9-visual';
    this.shadow = scene.add.ellipse(0, 51, 125, 25, 0x000000, 0.55);
    this.ground = scene.add.graphics().setPosition(0, 40).setScale(1, 0.36);
    this.sprite = scene.add.image(0, 0, BOSS_IDENTITY.texture).setOrigin(0.5, 0.68);
    this.sprite.setScale(200 / this.sprite.height);
    this.sprite.name = 'brok9-production-sprite';
    this.core = scene.add.circle(5, -41, 5, 0xd566ff, 0.35).setBlendMode(Phaser.BlendModes.ADD);
    this.ports = [-65, 67].map(x => scene.add.circle(x, 5, 6, 0xff70f8, 0.2)
      .setBlendMode(Phaser.BlendModes.ADD));
    this.vents = [-1, 1].map(side => scene.add.rectangle(side * 48, -75, 17, 3, 0x21e6ff, 0.7)
      .setAngle(side * -24).setBlendMode(Phaser.BlendModes.ADD));
    this.model = scene.add.container(0, 0, [this.sprite, this.core, ...this.ports, ...this.vents]);
    this.add([this.shadow, this.ground, this.model]);
  }

  updatePose(time: number, phase: number, charging: boolean, recoil: number,
    hit: number, moving: boolean, facingLeft: boolean) {
    const color = BOSS_IDENTITY.colors[phase - 1] ?? BOSS_IDENTITY.colors[0];
    if (phase !== this.phase) {
      this.phase = phase;
      this.ground.clear().lineStyle(4, color, 0.6);
      for (let index = 0; index < 6; index++) {
        const angle = index * Math.PI / 3;
        this.ground.beginPath().arc(0, 0, 77, angle, angle + 0.65).strokePath();
      }
      this.core.setFillStyle(color);
      this.ports.forEach(port => port.setFillStyle(color));
    }
    const wave = Math.sin(time * (moving ? 0.009 : 0.0025));
    const motion = this.motion ? 1 : 0;
    this.model.y = (-Math.abs(wave) * (moving ? 3 : 1.2) - recoil * 4) * motion;
    this.model.rotation = (moving ? wave * 0.018 : 0) * motion;
    this.model.scaleX = facingLeft ? -1 : 1;
    this.shadow.setScale(1 - Math.abs(wave) * 0.04 * motion, 1);
    this.ground.rotation = this.motion ? time * 0.00035 * phase : 0;
    const charge = charging ? 0.7 + Math.sin(time * 0.02) * 0.2 * motion : 0.25;
    this.core.setAlpha(Math.max(charge, recoil)).setScale(charging ? 1.5 : 1);
    this.ports.forEach(port => port.setAlpha(Math.max(charging ? 0.8 : 0.1, recoil))
      .setScale(1 + recoil * 1.3 * motion));
    this.vents.forEach(vent => vent.setAlpha(0.4 + (phase - 1) * 0.25));
    if (hit > 0.6) {
      this.sprite.setTint(0xeaffff);
      this.sprite.setTintFill();
    }
    else this.sprite.clearTint();
  }
}
