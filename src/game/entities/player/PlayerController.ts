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
  private readonly keys: Record<'up' | 'down' | 'left' | 'right' | 'dash', Phaser.Input.Keyboard.Key>;

  constructor(keyboard: Phaser.Input.Keyboard.KeyboardPlugin) {
    this.keys = {
      up: keyboard.addKey('W'),
      down: keyboard.addKey('S'),
      left: keyboard.addKey('A'),
      right: keyboard.addKey('D'),
      dash: keyboard.addKey('SPACE'),
    };
  }

  getMovement(virtual?: VirtualPlayerInput) {
    if (virtual?.active) return this.movement.copy(virtual.movement).normalize();
    return this.movement
      .set(
        Number(this.keys.right.isDown) - Number(this.keys.left.isDown),
        Number(this.keys.down.isDown) - Number(this.keys.up.isDown),
      )
      .normalize();
  }

  wantsDash(virtual?: VirtualPlayerInput) {
    return Phaser.Input.Keyboard.JustDown(this.keys.dash) || Boolean(virtual?.dash);
  }
}
