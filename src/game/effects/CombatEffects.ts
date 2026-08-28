import Phaser from 'phaser';
import { COLORS, GAMEPLAY } from '../config/Constants';

/** Scene-owned, presentation-only transient combat effects. */
export class CombatEffects {
  private readonly transient = new Set<Phaser.GameObjects.GameObject>();
  private readonly maxTransient = GAMEPLAY.maxTransientEffects;

  constructor(private readonly scene: Phaser.Scene) {}

  private track<T extends Phaser.GameObjects.GameObject>(object: T): T | undefined {
    if (this.transient.size >= this.maxTransient) {
      object.destroy();
      return undefined;
    }
    this.transient.add(object);
    return object;
  }

  private release(object: Phaser.GameObjects.GameObject) {
    this.transient.delete(object);
    if (object.active) object.destroy();
  }

  muzzle(x: number, y: number, angle: number) {
    const flash = this.track(this.scene.add
      .circle(x + Math.cos(angle) * 50, y + Math.sin(angle) * 50, 8, COLORS.cyan, 0.8)
      .setDepth(20));
    if (!flash) return;
    this.scene.tweens.add({
      targets: flash,
      scale: 2,
      alpha: 0,
      duration: 90,
      onComplete: () => this.release(flash),
    });
  }

  impact(x: number, y: number) {
    for (let index = 0; index < 5; index++) {
      const dot = this.track(this.scene.add.circle(x, y, 2, COLORS.cyan).setDepth(20));
      if (!dot) break;
      const angle = Math.random() * Math.PI * 2;
      this.scene.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * 25,
        y: y + Math.sin(angle) * 25,
        alpha: 0,
        duration: 180,
        onComplete: () => this.release(dot),
      });
    }
  }

  explosion(x: number, y: number, radius: number) {
    const blast = this.track(this.scene.add
      .circle(x, y, 18, 0xff7b35, 0.55)
      .setStrokeStyle(5, 0xffd166)
      .setDepth(20));
    if (!blast) return;
    this.scene.tweens.add({
      targets: blast,
      scale: radius / 18,
      alpha: 0,
      duration: 330,
      onComplete: () => this.release(blast),
    });
  }

  deathBurst(x: number, y: number, color: number = COLORS.cyan, boss = false) {
    const count = boss ? 12 : 6;
    for (let index = 0; index < count; index++) {
      const shard = this.track(this.scene.add.rectangle(x, y, boss ? 7 : 4, boss ? 12 : 8, color, 0.9));
      if (!shard) break;
      const angle = (Math.PI * 2 * index) / count + Math.random() * 0.2;
      const distance = boss ? 90 : 38;
      shard.setRotation(angle);
      this.scene.tweens.add({
        targets: shard,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.25,
        duration: boss ? 420 : 240,
        ease: 'Quad.Out',
        onComplete: () => this.release(shard),
      });
    }
  }

  floatingText(x: number, y: number, text: string, color: string) {
    const label = this.track(this.scene.add
      .text(x, y, text, { fontFamily: 'Arial Black', fontSize: '18px', color })
      .setOrigin(0.5)
      .setDepth(30));
    if (!label) return;
    this.scene.tweens.add({
      targets: label,
      y: y - 35,
      alpha: 0,
      duration: 550,
      onComplete: () => this.release(label),
    });
  }
}
