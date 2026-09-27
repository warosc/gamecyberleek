import Phaser from 'phaser';

export const MINIBOSS_VARIANTS = [
  { name: 'REM-Ω', title: 'CENTINELA REMOLACHA', armor: 0x75133f, accent: 0xff3b76, leaf: 0x17634d },
  { name: 'REM-Φ', title: 'GUARDIÁN DE ESPORAS', armor: 0x5b244f, accent: 0x73ef62, leaf: 0x2a7c4c },
  { name: 'REM-Δ', title: 'VERDUGO CRIOGÉNICO', armor: 0x303b73, accent: 0x76a9ff, leaf: 0x38567a },
] as const;

/** Layered procedural rig for the mid-run beet warden. */
export class MinibossVisual extends Phaser.GameObjects.Container {
  readonly identity;
  private readonly rig: Phaser.GameObjects.Container;
  private readonly leaves: Phaser.GameObjects.Graphics;
  private readonly visor: Phaser.GameObjects.Rectangle;
  private readonly core: Phaser.GameObjects.Arc;
  private readonly nodes: Phaser.GameObjects.Arc[] = [];

  constructor(scene: Phaser.Scene, sector: number) {
    super(scene, 0, 0);
    this.identity = MINIBOSS_VARIANTS[Math.min(Math.max(sector, 0), 2)];
    const shadow = scene.add.ellipse(0, 29, 92, 28, 0x000000, 0.45);
    this.leaves = scene.add.graphics()
      .fillStyle(this.identity.leaf).fillTriangle(-25, -27, -14, -72, -2, -31)
      .fillStyle(this.identity.leaf, 0.9).fillTriangle(-8, -32, 7, -82, 16, -29)
      .fillStyle(this.identity.leaf, 0.8).fillTriangle(8, -28, 34, -63, 27, -20);
    const bulb = scene.add.graphics()
      .fillStyle(0x100914).fillCircle(0, 2, 47)
      .fillStyle(this.identity.armor).fillCircle(0, 1, 41)
      .lineStyle(4, this.identity.accent, 0.95).strokeCircle(0, 1, 42)
      .lineStyle(2, 0xffffff, 0.16).arc(0, 1, 33, 3.5, 5.8)
      .fillStyle(0x150d1c).fillRoundedRect(-33, -12, 66, 24, 7);
    this.visor = scene.add.rectangle(0, -3, 50, 10, this.identity.accent, 0.92).setStrokeStyle(2, 0xeaffff, 0.8);
    this.core = scene.add.circle(0, 21, 7, this.identity.accent, 0.8).setStrokeStyle(2, 0xffffff, 0.7)
      .setBlendMode(Phaser.BlendModes.ADD);
    const legs = scene.add.graphics().lineStyle(6, 0x182338, 1)
      .lineBetween(-24, 28, -35, 49).lineBetween(24, 28, 35, 49)
      .lineStyle(3, this.identity.accent, 0.8).lineBetween(-35, 49, -47, 49).lineBetween(35, 49, 47, 49);
    this.rig = scene.add.container(0, 0, [this.leaves, legs, bulb, this.visor, this.core]);
    for (let index = 0; index < 3; index++) {
      const node = scene.add.circle(0, 0, 4, this.identity.accent, 0.85).setBlendMode(Phaser.BlendModes.ADD);
      this.nodes.push(node); this.rig.add(node);
    }
    this.add([shadow, this.rig]);
    scene.add.existing(this);
  }

  updatePose(time: number, moving: boolean, preparing: boolean, recoil: number, hit: number, faceLeft: boolean) {
    const gait = Math.sin(time * 0.009);
    this.rig.scaleX = (faceLeft ? -1 : 1) * (1 + hit * 0.14);
    this.rig.scaleY = 1 - hit * 0.08;
    this.rig.y = moving ? -Math.abs(gait) * 4 : Math.sin(time * 0.003) * 2;
    this.rig.rotation = moving ? gait * 0.045 : 0;
    this.leaves.rotation = gait * 0.08 - recoil * 0.12;
    this.visor.setAlpha(preparing ? 1 : 0.72 + Math.sin(time * 0.006) * 0.18)
      .setScale(preparing ? 1.12 : 1, preparing ? 1.35 : 1);
    this.core.setScale(preparing ? 1.8 : 0.85 + Math.sin(time * 0.008) * 0.18)
      .setAlpha(preparing ? 1 : 0.65);
    this.nodes.forEach((node, index) => {
      const angle = time * (preparing ? 0.004 : 0.0015) + index * Math.PI * 2 / 3;
      const radius = preparing ? 57 : 50;
      node.setPosition(Math.cos(angle) * radius, Math.sin(angle) * radius)
        .setScale(preparing ? 1.6 : 1);
    });
    this.rig.setAlpha(hit > 0.65 ? 0.55 : 1);
  }
}
