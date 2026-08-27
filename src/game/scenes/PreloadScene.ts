import Phaser from 'phaser';
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }
  preload() {
    this.load.image(
      'leek-placeholder-front',
      'assets/character/leek/placeholder-front-reference.png',
    );
    this.load.image('leek-avatar', 'assets/character/leek/avatar.png');
    this.load.image('leek-actions', 'assets/character/leek/actions-reference.png');
    this.load.image('leek-profile', 'assets/character/leek/turnaround-profile.png');
    this.load.image('leek-back', 'assets/character/leek/turnaround-back.png');
    this.load.image('lab-floor', 'assets/maps/cyber-vegetable-lab-floor.png');
    this.load.image('menu-backdrop', 'assets/ui/menu-backdrop.png');
  }
  create() {
    const actions = this.textures.get('leek-actions');
    actions.add('move', 0, 13, 35, 129, 184);
    actions.add('dash', 0, 150, 5, 125, 135);
    actions.add('attack', 0, 365, 12, 220, 210);
    this.scene.start('Menu');
  }
}
