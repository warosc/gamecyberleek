import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/Constants';
import {
  VEGETABLE_ROSTER, resolveVegetableArt, type VegetableType,
} from '../entities/enemies/VegetableRoster';
import { t, td } from '../i18n';
import { UI, fitText, framePanel, hex, panelButton, uiFont } from '../ui/SceneWidgets';
import { backdropTexture, queueSceneArt } from '../config/SceneArt';

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

  preload() {
    queueSceneArt(this, { backdrops: ['bestiary'] });
  }

  create() {
    this.cameras.main.setBackgroundColor(0x07111f);
    const backdrop = backdropTexture(this, 'bestiary');
    if (this.textures.exists(backdrop))
      this.add.image(GAME_WIDTH / 2, 360, backdrop).setDisplaySize(GAME_WIDTH, 720).setAlpha(backdrop === 'menu-backdrop' ? 0.22 : 0.8);
    this.add.text(GAME_WIDTH / 2, 52, td('FUERZAS DE LA BRECHA'), {
      fontFamily: 'Arial Black', fontSize: uiFont(this, 34), color: '#73ef62', stroke: '#020710', strokeThickness: 6,
    }).setOrigin(0.5).setShadow(0, 0, '#73ef62', 12, false, true);
    this.add.text(GAME_WIDTH / 2, 96, td('CYBERLEEK  //  ARCHIVO DE ENEMIGOS'), {
      fontFamily: 'Arial Black', fontSize: uiFont(this, 13), color: '#21e6ff', letterSpacing: 2,
    }).setOrigin(0.5);
    const types = Object.keys(VEGETABLE_ROSTER) as VegetableType[];
    // Wide phone canvases get wider cards, which the larger phone type needs.
    const pitch = Math.min(212, (GAME_WIDTH - 80) / types.length);
    types.forEach((type, index) => {
      const spec = VEGETABLE_ROSTER[type];
      const x = GAME_WIDTH / 2 + (index - (types.length - 1) / 2) * pitch;
      const color = hex(spec.color);
      framePanel(this, x, 360, pitch - 12, 456, spec.color, { strokeAlpha: 0.6, band: 0.08, cut: 14 });
      this.add.ellipse(x, 350, 110, 20, 0x000000, 0.45);
      const art = resolveVegetableArt(this.textures, type);
      const sprite = this.add.image(x, 262, art.key);
      sprite.setScale(Math.min(180 / sprite.height, (pitch - 36) / sprite.width));
      if (art.tint !== undefined) sprite.setTint(art.tint);
      fitText(this.add.text(x, 392, spec.name, { fontFamily: 'Arial Black', fontSize: uiFont(this, 21), color }).setOrigin(0.5), pitch - 24);
      fitText(this.add.text(x, 422, td(spec.role), {
        fontFamily: 'Arial Black', fontSize: uiFont(this, 11), color: UI.text,
      }).setOrigin(0.5), pitch - 24);
      this.add.rectangle(x, 442, pitch - 48, 1, spec.color, 0.5);
      this.add.text(x, 454, td(TACTICS[type]), {
        fontFamily: 'Arial', fontSize: uiFont(this, 12), color: UI.body, align: 'center', lineSpacing: 2,
        wordWrap: { width: pitch - 30 },
      }).setOrigin(0.5, 0);
    });
    const leave = () => this.scene.start('Menu');
    panelButton(this, GAME_WIDTH / 2, 636, 300, 56, t('common.back'), UI.cyan, leave, 17);
    this.input.keyboard?.on('keydown-ESC', leave);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard?.off('keydown-ESC', leave));
  }
}
