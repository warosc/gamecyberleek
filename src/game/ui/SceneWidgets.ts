import Phaser from 'phaser';
import { AudioManager } from '../managers/AudioManager';

export const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

/**
 * The menu-family button: a stroked panel whose label and hit area share one center, sized for
 * touch. `pointerup` (not down) so a drag that leaves the button does not trigger it.
 */
export function panelButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  color: number,
  action: () => void,
  fontSize = height > 55 ? 22 : 15,
) {
  const box = scene.add.rectangle(x, y, width, height, 0x07111f, 0.94)
    .setStrokeStyle(3, color, 0.9).setInteractive({ useHandCursor: true });
  const text = scene.add.text(x, y, label, {
    fontFamily: 'Arial Black', fontSize: `${fontSize}px`, color: '#eaffff', letterSpacing: 1,
  }).setOrigin(0.5);
  box.on('pointerover', () => box.setFillStyle(color, 0.28));
  box.on('pointerout', () => box.setFillStyle(0x07111f, 0.94));
  box.on('pointerup', action);
  return { box, text };
}

/** Full-screen sub-menu frame shared by the workshop, settings and records screens. */
export function subMenuFrame(scene: Phaser.Scene, width: number, height: number, title: string, subtitle: string, accent: number) {
  scene.cameras.main.setBackgroundColor(0x07111f);
  const music = new AudioManager(scene);
  scene.events.on(Phaser.Scenes.Events.UPDATE, (time: number) => music.updateMusic(time, 'menu'));
  if (scene.textures.exists('menu-backdrop'))
    scene.add.image(width / 2, height / 2, 'menu-backdrop').setDisplaySize(width, height).setAlpha(0.28);
  scene.add.rectangle(width / 2, height / 2, width - 60, height - 50, 0x07111f, 0.9).setStrokeStyle(2, accent, 0.45);
  scene.add.text(width / 2, 62, title, {
    fontFamily: 'Arial Black', fontSize: '36px', color: hex(accent), stroke: '#020710', strokeThickness: 6,
  }).setOrigin(0.5);
  scene.add.text(width / 2, 104, subtitle, {
    fontFamily: 'monospace', fontSize: '13px', color: '#7594a8', letterSpacing: 3,
  }).setOrigin(0.5);
}

/** Binds ESC and a back button to the main menu and releases the key on shutdown. */
export function backToMenu(scene: Phaser.Scene, x: number, y: number, label: string) {
  const leave = () => scene.scene.start('Menu');
  panelButton(scene, x, y, 280, 54, label, 0x21e6ff, leave, 16);
  scene.input.keyboard?.on('keydown-ESC', leave);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.input.keyboard?.off('keydown-ESC', leave));
}
