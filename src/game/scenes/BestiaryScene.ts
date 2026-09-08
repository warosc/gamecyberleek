import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/Constants';
import { VEGETABLE_ROSTER, vegetableTexture, type VegetableType } from '../entities/enemies/VegetableRoster';

const TACTICS = {
  GRUNT: 'Te persigue y golpea de cerca.\nMantén distancia de sus puños.',
  RUNNER: 'Rápida y ligera.\nUsa el dash para separarte.',
  TANK: 'Lenta, con mucha resistencia.\nEvita quedar acorralado.',
  SHOOTER: 'Dispara y mantiene distancia.\nEsquiva cuando carga su cañón.',
};

/** A touch-friendly way to inspect the new characters before encountering them. */
export class BestiaryScene extends Phaser.Scene {
  constructor() { super('Bestiary'); }

  create() {
    this.cameras.main.setBackgroundColor(0x07111f);
    this.add.text(GAME_WIDTH / 2, 55, 'FUERZAS DE LA BRECHA', {
      fontFamily: 'Arial Black', fontSize: '34px', color: '#73ef62',
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 98, 'CYBERLEEK  //  ARCHIVO DE ENEMIGOS', {
      fontFamily: 'monospace', fontSize: '14px', color: '#21e6ff', letterSpacing: 3,
    }).setOrigin(0.5);
    (Object.keys(VEGETABLE_ROSTER) as VegetableType[]).forEach((type, index) => {
      const spec = VEGETABLE_ROSTER[type];
      const x = 184 + index * 304;
      const color = `#${spec.color.toString(16).padStart(6, '0')}`;
      this.add.rectangle(x, 350, 282, 420, 0x0b1b2b).setStrokeStyle(2, spec.color, 0.65);
      this.add.ellipse(x, 405, 145, 24, 0x000000, 0.45);
      const sprite = this.add.image(x, 300, vegetableTexture(type));
      sprite.setScale(Math.min(220 / sprite.height, 225 / sprite.width));
      this.add.text(x, 447, spec.name, { fontFamily: 'Arial Black', fontSize: '27px', color }).setOrigin(0.5);
      this.add.text(x, 480, spec.role, { fontFamily: 'Arial Black', fontSize: '12px', color: '#eaffff' }).setOrigin(0.5);
      this.add.text(x, 521, TACTICS[type], { fontFamily: 'Arial', fontSize: '14px', color: '#a9bbc9',
        align: 'center', lineSpacing: 6 }).setOrigin(0.5);
    });
    const back = this.add.rectangle(GAME_WIDTH / 2, 635, 300, 56, 0x102535)
      .setStrokeStyle(2, 0x21e6ff).setInteractive({ useHandCursor: true });
    this.add.text(GAME_WIDTH / 2, 635, 'VOLVER AL MENÚ', {
      fontFamily: 'Arial Black', fontSize: '18px', color: '#eaffff',
    }).setOrigin(0.5);
    const leave = () => this.scene.start('Menu');
    back.on('pointerup', leave);
    this.input.keyboard?.on('keydown-ESC', leave);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard?.off('keydown-ESC', leave));
  }
}
