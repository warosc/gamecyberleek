import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/Constants';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(data: { time: number; level: number; victory: boolean; arenaIndex: number }) {
    this.input.enabled = true;
    this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'menu-backdrop')
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setTint(data.victory ? 0xb8ffd0 : 0x8d6070);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020710, 0.64);
    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 780, 540, 0x07111f, 0.92)
      .setStrokeStyle(3, data.victory ? 0x73ef62 : 0xff476f, 0.8);
    this.add
      .text(GAME_WIDTH / 2, 126, data.victory ? 'OPERATION COMPLETE' : 'OPERATIVE DOWN', {
        fontFamily: 'Arial Black',
        fontSize: '48px',
        color: data.victory ? '#73ef62' : '#ff476f',
        stroke: '#020710',
        strokeThickness: 8,
      })
      .setOrigin(0.5);
    this.add
      .text(
        GAME_WIDTH / 2,
        190,
        data.victory ? 'THE BIO-LAB IS SECURE' : 'MISSION DATA RECOVERED',
        {
          fontFamily: 'Arial Black',
          fontSize: '14px',
          color: '#21e6ff',
          letterSpacing: 4,
        },
      )
      .setOrigin(0.5);

    const seconds = Math.floor(data.time / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    this.statCard(360, 285, 'SURVIVAL', `${minutes}:${String(remainingSeconds).padStart(2, '0')}`);
    this.statCard(640, 285, 'LEVEL REACHED', String(data.level));
    this.statCard(920, 285, 'SECTOR', String(data.arenaIndex + 1));

    this.button(360, 440, 270, 'DEPLOY AGAIN', 0x73ef62, () => {
      this.physics.resume();
      this.scene.stop('UI');
      this.scene.start('Game', { arenaIndex: data.arenaIndex + 1 });
    });
    this.button(650, 440, 270, 'MAIN MENU', 0x21e6ff, () => {
      this.physics.resume();
      this.scene.stop('UI');
      this.scene.start('Menu');
    });
    this.add
      .text(GAME_WIDTH / 2, 555, 'Every operation makes the next operative stronger.', {
        fontSize: '15px',
        color: '#8da8b8',
      })
      .setOrigin(0.5);
  }

  private statCard(x: number, y: number, label: string, value: string) {
    this.add.rectangle(x, y, 220, 105, 0x0b1b2b, 0.95).setStrokeStyle(2, 0x214c65, 0.9);
    this.add
      .text(x, y - 26, label, {
        fontFamily: 'Arial Black',
        fontSize: '12px',
        color: '#7594a8',
        letterSpacing: 2,
      })
      .setOrigin(0.5);
    this.add
      .text(x, y + 18, value, {
        fontFamily: 'Arial Black',
        fontSize: '31px',
        color: '#eaffff',
      })
      .setOrigin(0.5);
  }

  private button(
    x: number,
    y: number,
    width: number,
    label: string,
    color: number,
    action: () => void,
  ) {
    const button = this.add
      .rectangle(x, y, width, 62, 0x07111f, 0.96)
      .setStrokeStyle(3, color, 0.9)
      .setInteractive({ useHandCursor: true });
    const text = this.add
      .text(x, y, label, {
        fontFamily: 'Arial Black',
        fontSize: '18px',
        color: '#eaffff',
      })
      .setOrigin(0.5);
    button.on('pointerover', () => button.setFillStyle(color, 0.28));
    button.on('pointerout', () => button.setFillStyle(0x07111f, 0.96));
    button.on('pointerup', action);
    text.setInteractive({ useHandCursor: true }).on('pointerup', action);
    text.setDepth(button.depth + 1);
  }
}
