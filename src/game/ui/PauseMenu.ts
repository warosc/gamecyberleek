import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/Constants';
import type { GameScene } from '../scenes/GameScene';
import { t } from '../i18n';
import { UI, framePanel, isCompact, panelButton, uiFont } from './SceneWidgets';

/** Builds the pause overlay. The objects are handed to `ModalOverlay`, which owns their life. */
export class PauseMenu {
  constructor(private readonly scene: Phaser.Scene, private readonly game: GameScene) {}

  build(): Phaser.GameObjects.GameObject[] {
    const parts: Phaser.GameObjects.GameObject[] = [];
    parts.push(
      this.scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020710, 0.82),
    );
    parts.push(
      framePanel(this.scene, GAME_WIDTH / 2, GAME_HEIGHT / 2, 680, 580, UI.cyan, {
        fill: 0x071522, fillAlpha: 0.98, band: 0.06, strokeAlpha: 0.85, cut: 24, glow: 0.12,
      }),
    );
    parts.push(
      this.scene.add.circle(GAME_WIDTH / 2, 166, 58, 0x0b2130, 1).setStrokeStyle(4, 0x73ef62, 0.8),
    );
    parts.push(this.scene.add.image(GAME_WIDTH / 2, 166, 'leek-avatar').setDisplaySize(104, 104));
    parts.push(
      this.scene.add
        .text(GAME_WIDTH / 2, 240, t('pause.title'), {
          fontFamily: 'Arial Black',
          fontSize: uiFont(this.scene, 34),
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
            fontSize: uiFont(this.scene, 12),
            color: '#73ef62',
            letterSpacing: 1,
          },
        )
        .setOrigin(0.5),
    );
    const resume = this.button(GAME_WIDTH / 2, 360, t('pause.resume'), 0x73ef62, () => this.game.resumeGame());
    const menu = this.button(GAME_WIDTH / 2, 440, t('pause.menu'), 0x21e6ff, () => this.game.returnToMenu());
    parts.push(...resume, ...menu);
    const volumeLabel = this.scene.add
      .text(GAME_WIDTH / 2, 505, '', {
        fontFamily: 'Arial Black',
        fontSize: uiFont(this.scene, 14),
        color: '#eaffff',
        letterSpacing: 1,
      })
      .setOrigin(0.5);
    const refreshVolume = () =>
      volumeLabel.setText(t('pause.volume', { value: Math.round(this.game.audioVolume * 100) }));
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
    // Keyboard hints mean nothing on a phone.
    if (!isCompact(this.scene)) parts.push(
      this.scene.add
        .text(GAME_WIDTH / 2, 575, t('pause.keys'), {
          fontFamily: 'monospace',
          fontSize: uiFont(this.scene, 12),
          color: UI.muted,
          letterSpacing: 2,
        })
        .setOrigin(0.5),
    );
    return parts;
  }

  private button(x: number, y: number, label: string, color: number, action: () => void, width = 340) {
    return panelButton(this.scene, x, y, width, 60, label, color, action, 17).parts;
  }
}
