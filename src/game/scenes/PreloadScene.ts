import Phaser from 'phaser';
import { PLAYER_RIG_LAYERS, PLAYER_RIG_STATES } from '../entities/player/PlayerRigManifest';
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
    this.load.image('leek-hero-clean', 'assets/character/leek/hero-clean-v2.png');
    this.load.image('leek-actions', 'assets/character/leek/actions-reference.png');
    this.load.image('leek-profile', 'assets/character/leek/turnaround-profile.png');
    this.load.image('leek-back', 'assets/character/leek/turnaround-back.png');
    for (const layer of PLAYER_RIG_LAYERS)
      this.load.image(`rig-${layer}`, `assets/character/leek/rig/layers/${layer}.png`);
    for (const state of PLAYER_RIG_STATES)
      this.load.json(`rig-anim-${state}`, `assets/character/leek/rig/animations/${state}.json`);
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
