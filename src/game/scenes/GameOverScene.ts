import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/Constants';

const BUTTON_WIDTH = 270;
const BUTTON_GAP = 20;

export class GameOverScene extends Phaser.Scene {
  private navigating = false;

  constructor() {
    super('GameOver');
  }

  create(data: { time: number; level: number; victory: boolean; arenaIndex: number }) {
    this.input.enabled = true;
    this.navigating = false;
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

    // A clear run earns the next sector; dying retries the one that beat you.
    const nextArenaIndex = data.victory ? data.arenaIndex + 1 : data.arenaIndex;
    // Guarded so a double click or a click racing the keyboard cannot start two scenes.
    const go = (key: string, sceneData?: object) => () => {
      if (this.navigating) return;
      this.navigating = true;
      this.scene.start(key, sceneData);
    };
    const redeploy = go('Game', { arenaIndex: nextArenaIndex });
    const mainMenu = go('Menu');

    const offset = (BUTTON_WIDTH + BUTTON_GAP) / 2;
    this.button(
      GAME_WIDTH / 2 - offset,
      440,
      data.victory ? 'NEXT SECTOR' : 'RETRY SECTOR',
      0x73ef62,
      redeploy,
    );
    this.button(GAME_WIDTH / 2 + offset, 440, 'MAIN MENU', 0x21e6ff, mainMenu);

    // No manual teardown: KeyboardPlugin.shutdown() already drops its keys and listeners.
    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-ENTER', redeploy);
    keyboard?.on('keydown-SPACE', redeploy);
    keyboard?.on('keydown-ESC', mainMenu);

    this.add
      .text(GAME_WIDTH / 2, 545, 'ENTER  REDEPLOY        ESC  MAIN MENU', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#7594a8',
        letterSpacing: 1,
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

  private button(x: number, y: number, label: string, color: number, action: () => void) {
    const button = this.add
      .rectangle(x, y, BUTTON_WIDTH, 62, 0x07111f, 0.96)
      .setStrokeStyle(3, color, 0.9)
      .setInteractive({ useHandCursor: true });
    // The label stays non-interactive on purpose: input is topOnly, so an interactive label
    // would swallow the rectangle's pointerover/pointerout and break the hover highlight.
    const text = this.add
      .text(x, y, label, {
        fontFamily: 'Arial Black',
        fontSize: '18px',
        color: '#eaffff',
      })
      .setOrigin(0.5);
    button.on('pointerover', () => {
      button.setFillStyle(color, 0.28);
      text.setColor('#ffffff');
    });
    button.on('pointerout', () => {
      button.setFillStyle(0x07111f, 0.96);
      text.setColor('#eaffff');
    });
    button.on('pointerup', action);
  }
}
