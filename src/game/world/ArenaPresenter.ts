import Phaser from 'phaser';
import { ARENA } from '../config/Constants';
import type { ArenaTheme } from '../config/ArenaDefinitions';

/**
 * Static arena decoration: floor, grid, landmarks and ambient scan lines. Presentation only —
 * it owns no gameplay state and nothing here is read back by the simulation. Every object and
 * tween is scene-owned, so Phaser disposes of them at scene shutdown.
 *
 * Layout is seeded from the theme name, so a given arena always decorates identically.
 */
export class ArenaPresenter {
  constructor(private readonly scene: Phaser.Scene) {}

  draw(theme: ArenaTheme) {
    const random = new Phaser.Math.RandomDataGenerator([theme.name]);
    this.scene.cameras.main.setBackgroundColor(theme.background);
    this.scene.add
      .tileSprite(ARENA.width / 2, ARENA.height / 2, ARENA.width, ARENA.height, 'lab-floor')
      .setTint(theme.floorTint)
      .setAlpha(0.62)
      .setDepth(-12);
    this.scene.add
      .grid(
        ARENA.width / 2,
        ARENA.height / 2,
        ARENA.width,
        ARENA.height,
        80,
        80,
        theme.background,
        1,
        theme.grid,
        0.2,
      )
      .setDepth(-10);
    this.scene.add
      .rectangle(ARENA.width / 2, ARENA.height / 2, ARENA.width - 10, ARENA.height - 10)
      .setStrokeStyle(8, theme.accent, 0.55)
      .setDepth(-5);
    this.drawLandmarks(theme);
    this.drawDebris(theme, random);
    this.scene.add
      .text(ARENA.width / 2, 70, `${theme.name}  //  ${theme.subtitle}`, {
        fontFamily: 'Arial Black',
        fontSize: '24px',
        color: `#${theme.accent.toString(16).padStart(6, '0')}`,
      })
      .setOrigin(0.5)
      .setAlpha(0.35)
      .setDepth(-4);
    this.drawScanLines(theme);
  }

  private drawDebris(theme: ArenaTheme, random: Phaser.Math.RandomDataGenerator) {
    for (let index = 0; index < 38; index++) {
      const x = 80 + random.frac() * (ARENA.width - 160);
      const y = 80 + random.frac() * (ARENA.height - 160);
      this.scene.add
        .rectangle(x, y, 34 + random.frac() * 70, 8, theme.secondary, 0.18)
        .setAngle(random.frac() > 0.5 ? 0 : 90)
        .setDepth(-7);
      this.scene.add.circle(x, y, 3, theme.accent, 0.65).setDepth(-6);
    }
  }

  private drawScanLines(theme: ArenaTheme) {
    for (let index = 0; index < 4; index++) {
      const scan = this.scene.add
        .rectangle(ARENA.width / 2, 220 + index * 260, ARENA.width - 100, 2, theme.accent, 0.08)
        .setDepth(-3);
      this.scene.tweens.add({
        targets: scan,
        alpha: { from: 0.03, to: 0.16 },
        duration: 1400 + index * 230,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  private drawLandmarks(theme: ArenaTheme) {
    const graphics = this.scene.add.graphics().setDepth(-8);
    const stations = [
      { x: 250, y: 245 },
      { x: ARENA.width - 250, y: 245 },
      { x: 250, y: ARENA.height - 245 },
      { x: ARENA.width - 250, y: ARENA.height - 245 },
    ];
    stations.forEach(({ x, y }, index) => {
      graphics.fillStyle(0x020710, 0.48).fillCircle(x, y, 92);
      graphics.lineStyle(5, theme.accent, 0.2).strokeCircle(x, y, 78);
      graphics.lineStyle(2, theme.secondary, 0.34).strokeCircle(x, y, 53);
      graphics.fillStyle(theme.accent, 0.16).fillCircle(x, y, 29);
      graphics.lineStyle(7, index % 2 ? 0xffc857 : theme.secondary, 0.22);
      for (let stripe = -2; stripe <= 2; stripe++)
        graphics.lineBetween(x - 84 + stripe * 24, y + 96, x - 62 + stripe * 24, y + 74);
      const light = this.scene.add.circle(x, y, 8, theme.accent, 0.55).setDepth(-6);
      light.setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({
        targets: light,
        alpha: { from: 0.2, to: 0.85 },
        scale: { from: 0.7, to: 1.5 },
        duration: 900 + index * 170,
        yoyo: true,
        repeat: -1,
      });
    });
    graphics.lineStyle(16, 0x06101d, 0.72);
    graphics.lineBetween(110, ARENA.height / 2, ARENA.width - 110, ARENA.height / 2);
    graphics.lineStyle(3, theme.accent, 0.18);
    graphics.lineBetween(110, ARENA.height / 2, ARENA.width - 110, ARENA.height / 2);
    for (let x = 150; x < ARENA.width - 100; x += 155) {
      graphics
        .fillStyle(theme.secondary, 0.22)
        .fillTriangle(x, ARENA.height / 2 - 11, x + 22, ARENA.height / 2, x, ARENA.height / 2 + 11);
    }
    this.scene.add
      .circle(ARENA.width / 2, ARENA.height / 2, 150, 0x020710, 0.22)
      .setStrokeStyle(4, theme.accent, 0.25)
      .setDepth(-7);
    const core = this.scene.add
      .circle(ARENA.width / 2, ARENA.height / 2, 92)
      .setStrokeStyle(2, theme.secondary, 0.24)
      .setDepth(-6);
    this.scene.tweens.add({ targets: core, angle: 360, duration: 10000, repeat: -1 });
  }
}
