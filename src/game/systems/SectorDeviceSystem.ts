import Phaser from 'phaser';
import { SECTOR_DEVICES, SECTOR_DEVICE_POSITIONS, type SectorDeviceEffect } from '../config/SectorDevices';
import type { Projectile } from '../entities/projectiles/Projectile';

export interface SectorDeviceActivation {
  x: number;
  y: number;
  radius: number;
  damage: number;
  heal: number;
  effect: SectorDeviceEffect;
  color: number;
  name: string;
}

/** Three single-use tactical props. Their fixed count keeps their rendering cost predictable. */
export class SectorDeviceSystem {
  readonly group: Phaser.Physics.Arcade.StaticGroup;
  private readonly definition;

  constructor(private readonly scene: Phaser.Scene, sector: number,
    private readonly onActivate: (activation: SectorDeviceActivation) => void) {
    this.definition = SECTOR_DEVICES[Math.min(Math.max(sector, 0), 2)];
    this.group = scene.physics.add.staticGroup();
    for (const [x, y] of SECTOR_DEVICE_POSITIONS) this.createDevice(x, y, sector);
  }

  bindProjectiles(projectiles: Phaser.Physics.Arcade.Group) {
    this.scene.physics.add.overlap(projectiles, this.group, (projectile, device) =>
      this.hit(projectile as Projectile, device as Phaser.GameObjects.Arc));
  }

  private createDevice(x: number, y: number, sector: number) {
    const halo = this.scene.add.circle(x, y, 35, this.definition.color, 0.08)
      .setStrokeStyle(3, this.definition.color, 0.5).setDepth(4);
    const core = this.scene.add.circle(x, y, 22, sector === 1 ? 0x24472c : 0x101a35, 1)
      .setStrokeStyle(4, this.definition.color, 0.95).setDepth(5).setName(`sector-device-${this.definition.effect}`);
    const icon = this.scene.add.text(x, y, sector === 0 ? '⚡' : sector === 1 ? '✦' : '❄', {
      fontFamily: 'Arial Black', fontSize: '19px', color: `#${this.definition.color.toString(16).padStart(6, '0')}`,
    }).setOrigin(0.5).setDepth(6);
    core.setData({ armed: true, halo, icon });
    this.group.add(core);
    this.scene.tweens.add({ targets: halo, scale: 1.18, alpha: 0.22, duration: 850, yoyo: true, repeat: -1 });
  }

  private hit(projectile: Projectile, device: Phaser.GameObjects.Arc) {
    if (!device.active || !(device.getData('armed') as boolean)) return;
    device.setData('armed', false);
    projectile.disableBody(true, true);
    const x = device.x; const y = device.y;
    const halo = device.getData('halo') as Phaser.GameObjects.Arc;
    const icon = device.getData('icon') as Phaser.GameObjects.Text;
    this.scene.tweens.killTweensOf(halo);
    halo.destroy(); icon.destroy(); device.destroy();
    this.onActivate({ x, y, ...this.definition });
  }
}
