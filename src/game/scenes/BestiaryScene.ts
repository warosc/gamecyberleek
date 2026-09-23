import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/Constants';
import {
  VEGETABLE_ROSTER, vegetableTexture, vegetableTint, type VegetableType,
} from '../entities/enemies/VegetableRoster';
import { t, td } from '../i18n';

const TACTICS: Record<VegetableType, string> = {
  GRUNT: 'Te persigue y prepara un golpe. Al ver el aro rojo, sepárate.',
  RUNNER: 'Marca una línea y embiste. Sal a un lado antes del impulso.',
  TANK: 'Lenta, con mucha resistencia. Evita quedar acorralado.',
  SHOOTER: 'Fija la mira antes de disparar. Sal de la línea naranja.',
  MEDIC: 'Cura a su grupo con un pulso verde. Elimínala primero.',
  BULWARK: 'Su aura azul reduce el daño a sus aliados. Sácalos de ella.',
  BROOD: 'Al caer libera dos zanahorias. No la mates acorralado.',
};

/** A touch-friendly way to inspect the roster before encountering it. */
export class BestiaryScene extends Phaser.Scene {
  constructor() { super('Bestiary'); }

  create() {
    this.cameras.main.setBackgroundColor(0x07111f);
    this.add.text(GAME_WIDTH / 2, 55, td('FUERZAS DE LA BRECHA'), {
      fontFamily: 'Arial Black', fontSize: '34px', color: '#73ef62',
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 98, td('CYBERLEEK  //  ARCHIVO DE ENEMIGOS'), {
      fontFamily: 'monospace', fontSize: '14px', color: '#21e6ff', letterSpacing: 3,
    }).setOrigin(0.5);
    const types = Object.keys(VEGETABLE_ROSTER) as VegetableType[];
    const pitch = 176;
    types.forEach((type, index) => {
      const spec = VEGETABLE_ROSTER[type];
      const x = GAME_WIDTH / 2 + (index - (types.length - 1) / 2) * pitch;
      const color = `#${spec.color.toString(16).padStart(6, '0')}`;
      this.add.rectangle(x, 350, pitch - 10, 420, 0x0b1b2b).setStrokeStyle(2, spec.color, 0.65);
      this.add.ellipse(x, 380, 110, 20, 0x000000, 0.45);
      const sprite = this.add.image(x, 290, vegetableTexture(type));
      sprite.setScale(Math.min(180 / sprite.height, 140 / sprite.width));
      const tint = vegetableTint(type);
      if (tint !== undefined) sprite.setTint(tint);
      this.add.text(x, 420, spec.name, { fontFamily: 'Arial Black', fontSize: '21px', color }).setOrigin(0.5);
      this.add.text(x, 448, td(spec.role), { fontFamily: 'Arial Black', fontSize: '10px', color: '#eaffff' }).setOrigin(0.5);
      this.add.text(x, 505, td(TACTICS[type]), {
        fontFamily: 'Arial', fontSize: '12px', color: '#a9bbc9', align: 'center', lineSpacing: 4,
        wordWrap: { width: pitch - 28 },
      }).setOrigin(0.5);
    });
    const back = this.add.rectangle(GAME_WIDTH / 2, 635, 300, 56, 0x102535)
      .setStrokeStyle(2, 0x21e6ff).setInteractive({ useHandCursor: true });
    this.add.text(GAME_WIDTH / 2, 635, t('common.back'), {
      fontFamily: 'Arial Black', fontSize: '18px', color: '#eaffff',
    }).setOrigin(0.5);
    const leave = () => this.scene.start('Menu');
    back.on('pointerup', leave);
    this.input.keyboard?.on('keydown-ESC', leave);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard?.off('keydown-ESC', leave));
  }
}
