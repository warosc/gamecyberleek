import Phaser from 'phaser';

/** Owns the single modal container used by level-up, chest and pause overlays. */
export class ModalOverlay {
  private container?: Phaser.GameObjects.Container;

  constructor(private readonly scene: Phaser.Scene) {}

  get active() {
    return !!this.container?.active;
  }

  replace(parts: Phaser.GameObjects.GameObject[], depth: number) {
    this.clear();
    this.container = this.scene.add.container(0, 0, parts).setDepth(depth);
    return this.container;
  }

  clear() {
    this.container?.destroy();
    this.container = undefined;
  }
}
