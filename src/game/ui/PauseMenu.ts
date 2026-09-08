import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/Constants';
import type { GameScene } from '../scenes/GameScene';

/** Builds the pause overlay. The objects are handed to `ModalOverlay`, which owns their life. */
export class PauseMenu {
  constructor(private readonly scene: Phaser.Scene, private readonly game: GameScene) {}

  build(): Phaser.GameObjects.GameObject[] {
    const parts: Phaser.GameObjects.GameObject[] = [];
    parts.push(
      this.scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020710, 0.82),
    );
    parts.push(
      this.scene.add
        .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 650, 560, 0x071522, 0.98)
        .setStrokeStyle(3, 0x21e6ff, 0.8),
    );
    parts.push(
      this.scene.add.circle(GAME_WIDTH / 2, 166, 58, 0x0b2130, 1).setStrokeStyle(4, 0x73ef62, 0.8),
    );
    parts.push(this.scene.add.image(GAME_WIDTH / 2, 166, 'leek-avatar').setDisplaySize(104, 104));
    parts.push(
      this.scene.add
        .text(GAME_WIDTH / 2, 240, 'OPERACIÓN EN PAUSA', {
          fontFamily: 'Arial Black',
          fontSize: '34px',
          color: '#eaffff',
        })
        .setOrigin(0.5),
    );
    parts.push(
      this.scene.add
        .text(
          GAME_WIDTH / 2,
          286,
          `NIVEL ${this.game.xp.level}   ·   ${this.game.player.stats.weaponName}   ·   ARMOR ${Math.round(this.game.player.stats.damageReduction * 100)}%`,
          {
            fontFamily: 'Arial Black',
            fontSize: '12px',
            color: '#73ef62',
            letterSpacing: 1,
          },
        )
        .setOrigin(0.5),
    );
    const resume = this.button(GAME_WIDTH / 2, 360, 'CONTINUAR', 0x73ef62, () => this.game.resumeGame());
    const menu = this.button(GAME_WIDTH / 2, 440, 'MENÚ PRINCIPAL', 0x21e6ff, () => this.game.returnToMenu());
    parts.push(...resume, ...menu);
    const volumeLabel = this.scene.add
      .text(GAME_WIDTH / 2, 505, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#eaffff',
        letterSpacing: 2,
      })
      .setOrigin(0.5);
    const refreshVolume = () =>
      volumeLabel.setText(`VOLUME ${Math.round(this.game.audioVolume * 100)}%`);
    const volumeDown = this.button(GAME_WIDTH / 2 - 145, 505, '−', 0xd566ff, () => {
      this.game.adjustAudioVolume(-0.1);
      refreshVolume();
    }, 70);
    const volumeUp = this.button(GAME_WIDTH / 2 + 145, 505, '+', 0xd566ff, () => {
      this.game.adjustAudioVolume(0.1);
      refreshVolume();
    }, 70);
    refreshVolume();
    parts.push(volumeLabel, ...volumeDown, ...volumeUp);
    parts.push(
      this.scene.add
        .text(GAME_WIDTH / 2, 570, 'ESC  ·  VOLVER AL COMBATE', {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#7594a8',
          letterSpacing: 2,
        })
        .setOrigin(0.5),
    );
    return parts;
  }

  private button(x: number, y: number, label: string, color: number, action: () => void, width = 330) {
    const button = this.scene.add
      .rectangle(x, y, width, 58, 0x0b1b2b, 1)
      .setStrokeStyle(3, color, 0.85)
      .setInteractive({ useHandCursor: true });
    const text = this.scene.add
      .text(x, y, label, {
        fontFamily: 'Arial Black',
        fontSize: '17px',
        color: '#eaffff',
        letterSpacing: 2,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    button.on('pointerup', action);
    text.on('pointerup', action);
    button.on('pointerover', () => button.setFillStyle(color, 0.25));
    button.on('pointerout', () => button.setFillStyle(0x0b1b2b, 1));
    return [button, text];
  }
}
