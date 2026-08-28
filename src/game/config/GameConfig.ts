import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './Constants';
import { BootScene } from '../scenes/BootScene';
import { MenuScene } from '../scenes/MenuScene';
import { GameScene } from '../scenes/GameScene';
import { UIScene } from '../scenes/UIScene';
import { GameOverScene } from '../scenes/GameOverScene';
import { PreloadScene } from '../scenes/PreloadScene';
export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#07111f',
  physics: { default: 'arcade', arcade: { debug: false } },
  // Nothing in the game uses `this.sound`; all audio goes through AudioManager's own Web Audio
  // context. Without this Phaser still builds a WebAudioSoundManager and tries to unlock it,
  // burning one of the few concurrent AudioContexts iOS Safari allows per document.
  audio: { noAudio: true },
  input: { activePointers: 4, touch: { capture: true } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, PreloadScene, MenuScene, GameScene, UIScene, GameOverScene],
  render: { antialias: true },
};
