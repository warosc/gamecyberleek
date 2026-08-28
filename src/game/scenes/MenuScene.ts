import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/Constants';
import { loadProfile } from '../systems/ProfileStore';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    const profile = loadProfile();
    const backdrop = this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'menu-backdrop')
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020710, 0.18);
    this.add.rectangle(350, GAME_HEIGHT / 2, 610, GAME_HEIGHT, 0x020710, 0.52);
    this.add
      .rectangle(30, 28, 570, 664, 0x07111f, 0.74)
      .setOrigin(0)
      .setStrokeStyle(2, 0x21e6ff, 0.3);

    this.add
      .text(72, 72, 'LEEK OPS', {
        fontFamily: 'Arial Black',
        fontSize: '76px',
        color: '#73ef62',
        stroke: '#07111f',
        strokeThickness: 12,
      })
      .setShadow(0, 0, '#21e6ff', 18, true, true);
    this.add.text(78, 160, 'TACTICAL VEGETABLE DIVISION', {
      fontFamily: 'Arial Black',
      fontSize: '15px',
      color: '#21e6ff',
      letterSpacing: 5,
    });
    this.add.rectangle(80, 210, 470, 1, 0x21e6ff, 0.5).setOrigin(0, 0.5);

    this.add.text(80, 242, 'OPERATION', {
      fontFamily: 'Arial Black',
      fontSize: '12px',
      color: '#7594a8',
      letterSpacing: 3,
    });
    this.add.text(80, 354, `BIO-CRÉDITOS  ${profile.bioCredits}   ·   MEJOR NIVEL  ${profile.bestLevel}`, {
      fontFamily: 'Arial Black', fontSize: '12px', color: '#73ef62', letterSpacing: 1,
    });
    this.add.text(80, 270, 'CYBER VEGETABLE LAB', {
      fontFamily: 'Arial Black',
      fontSize: '25px',
      color: '#eaffff',
    });
    this.add.text(
      80,
      310,
      'Survive the bio-lab breach. Upgrade your arsenal.\nDefeat the Broccoli Commander.',
      {
        fontSize: '16px',
        color: '#a9bbc9',
        lineSpacing: 8,
      },
    );

    this.createButton(80, 392, 330, 66, 'DEPLOY', 0x73ef62, () => this.scene.start('Game'));
    this.createButton(80, 474, 220, 48, 'HOW TO PLAY', 0x21e6ff, () =>
      controls.setVisible(!controls.visible),
    );
    const controls = this.add
      .text(80, 540, 'WASD  MOVE        MOUSE  AIM / FIRE\nSPACE  DASH       Q / E / R  POWERS', {
        fontFamily: 'Arial Black',
        fontSize: '13px',
        color: '#ccebf2',
        backgroundColor: '#06101de6',
        padding: { x: 18, y: 14 },
        lineSpacing: 9,
      })
      .setVisible(false);

    this.createAtmosphere();
    this.createHeroShowcase();
    this.add
      .text(GAME_WIDTH - 38, GAME_HEIGHT - 30, 'BUILD 0.1.0  //  FIELD TEST', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#7594a8',
      })
      .setOrigin(1);
    this.add
      .text(GAME_WIDTH - 38, 30, 'HECHO POR HARLANDER GT', {
        fontFamily: 'Arial Black',
        fontSize: '14px',
        color: '#eaffff',
        letterSpacing: 2,
      })
      .setOrigin(1, 0)
      .setDepth(8)
      .setShadow(0, 0, '#21e6ff', 8, true, true);
    backdrop.setInteractive();
  }

  private createAtmosphere() {
    const portal = this.add.ellipse(972, 360, 410, 520, 0x21e6ff, 0.055).setDepth(1);
    portal.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: portal,
      scaleX: { from: 0.92, to: 1.06 },
      scaleY: { from: 0.98, to: 1.03 },
      alpha: { from: 0.025, to: 0.11 },
      duration: 2100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    for (let index = 0; index < 12; index++) {
      const x = 670 + ((index * 79) % 520);
      const y = 730 + (index % 4) * 18;
      const mote = this.add.circle(x, y, 3 + (index % 3) * 2, index % 2 ? 0x73ef62 : 0x21e6ff, 0.12).setDepth(2);
      mote.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: mote,
        x: x + ((index % 3) - 1) * 75,
        y: 110 + (index % 5) * 40,
        alpha: { from: 0, to: 0.34 },
        scale: { from: 0.45, to: 1.8 },
        duration: 4800 + index * 310,
        delay: index * 240,
        repeat: -1,
      });
    }
    for (let index = 0; index < 5; index++) {
      const smoke = this.add.ellipse(760 + index * 92, 665, 90, 34, 0xbdefff, 0.055).setDepth(2);
      this.tweens.add({
        targets: smoke,
        y: 470 - index * 12,
        x: smoke.x + (index % 2 ? 55 : -35),
        scaleX: 2.1,
        scaleY: 2.8,
        alpha: { from: 0.08, to: 0 },
        duration: 4400 + index * 380,
        delay: index * 700,
        repeat: -1,
        ease: 'Sine.easeOut',
      });
    }
    const scan = this.add.rectangle(940, 155, 510, 2, 0x21e6ff, 0.24).setDepth(5);
    scan.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: scan, y: 630, alpha: { from: 0, to: 0.32 }, duration: 2800, repeat: -1 });
  }

  private createHeroShowcase() {
    const shadow = this.add.ellipse(910, 628, 290, 58, 0x000000, 0.58).setDepth(2);
    const glow = this.add.ellipse(910, 438, 280, 390, 0x73ef62, 0.045).setDepth(2);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    // Keep the showcase inside the right-hand panel on wide desktop and landscape mobile.
    // Explicit dimensions prevent the high-resolution source texture from dictating layout.
    const hero = this.add.image(0, 0, 'leek-hero-clean').setDisplaySize(270, 494);
    const container = this.add.container(960, 438, [hero]).setDepth(4);
    this.tweens.add({
      targets: container,
      y: 428,
      angle: { from: -0.8, to: 0.8 },
      duration: 1450,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: hero,
      scaleX: { from: 0.985, to: 1.015 },
      scaleY: { from: 1.015, to: 0.985 },
      duration: 920,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: [shadow, glow],
      scaleX: { from: 0.88, to: 1.06 },
      alpha: { from: 0.035, to: 0.1 },
      duration: 1450,
      yoyo: true,
      repeat: -1,
    });
  }

  private createButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    color: number,
    action: () => void,
  ) {
    const button = this.add
      .rectangle(x, y, width, height, 0x07111f, 0.94)
      .setOrigin(0)
      .setStrokeStyle(3, color, 0.9)
      .setInteractive({ useHandCursor: true });
    const text = this.add
      .text(x + width / 2, y + height / 2, label, {
        fontFamily: 'Arial Black',
        fontSize: height > 55 ? '25px' : '16px',
        color: '#eaffff',
        letterSpacing: 2,
      })
      .setOrigin(0.5);
    button.on('pointerover', () => {
      button.setFillStyle(color, 0.28);
      text.setColor('#ffffff');
    });
    button.on('pointerout', () => button.setFillStyle(0x07111f, 0.94));
    button.on('pointerdown', action);
    return this.add.container(0, 0, [button, text]);
  }
}
