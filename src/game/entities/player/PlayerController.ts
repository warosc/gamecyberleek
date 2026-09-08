import Phaser from 'phaser';

export interface VirtualPlayerInput {
  active: boolean;
  movement: Phaser.Math.Vector2;
  aim: Phaser.Math.Vector2;
  firing: boolean;
  dash: boolean;
  autoFire: boolean;
}

export class PlayerController {
  private readonly movement = new Phaser.Math.Vector2();
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private readonly keys: Record<'up' | 'down' | 'left' | 'right' | 'dash', Phaser.Input.Keyboard.Key>;

  constructor(keyboard: Phaser.Input.Keyboard.KeyboardPlugin) {
    this.cursors = keyboard.createCursorKeys();
    this.keys = {
      up: keyboard.addKey('W'),
      down: keyboard.addKey('S'),
      left: keyboard.addKey('A'),
      right: keyboard.addKey('D'),
      dash: keyboard.addKey('SPACE'),
    };
  }

  getMovement(virtual?: VirtualPlayerInput) {
    this.movement
      .set(
        Number(this.keys.right.isDown || this.cursors.right.isDown) -
          Number(this.keys.left.isDown || this.cursors.left.isDown),
        Number(this.keys.down.isDown || this.cursors.down.isDown) -
          Number(this.keys.up.isDown || this.cursors.up.isDown),
      )
      .normalize();
    // Touch capability controls the HUD; it must never disable a connected keyboard.
    if (this.movement.lengthSq() > 0 || !virtual?.active) return this.movement;
    return this.movement.copy(virtual.movement).normalize();
  }

  wantsDash(virtual?: VirtualPlayerInput) {
    return Phaser.Input.Keyboard.JustDown(this.keys.dash) || Boolean(virtual?.dash);
  }
}
