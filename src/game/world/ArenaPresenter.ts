import Phaser from 'phaser';
import { ARENA } from '../config/Constants';
import type { ArenaTheme } from '../config/ArenaDefinitions';
import { detectQualityProfile } from '../config/QualityProfile';

/**
 * Arena decoration: floor, grid, landmarks and ambient machinery. Presentation only —
 * it owns no gameplay state and nothing here is read back by the simulation. Every object and
 * tween is scene-owned, so Phaser disposes of them at scene shutdown.
 *
 * Layout is seeded from the theme name, so a given arena always decorates identically.
 */
export class ArenaPresenter {
  private readonly quality = detectQualityProfile();
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
    this.drawLivingLab(theme, random);
  }

  /** Fixed decoration budget: no emitters, timers spawning objects, or per-frame allocations. */
  private drawLivingLab(theme: ArenaTheme, random: Phaser.Math.RandomDataGenerator) {
    const animated = this.quality.tier !== 'low';
    const centerX = ARENA.width / 2;
    const centerY = ARENA.height / 2;
    const rotor = this.scene.add.graphics().setPosition(centerX, centerY).setDepth(-6);
    rotor.name = 'arena-reactor-rotor';
    rotor.lineStyle(5, theme.accent, 0.32);
    for (let index = 0; index < 6; index++) {
      const angle = index * Math.PI / 3;
      rotor.beginPath().arc(0, 0, 116, angle, angle + 0.48).strokePath();
      rotor.fillStyle(theme.secondary, 0.5).fillCircle(Math.cos(angle) * 140, Math.sin(angle) * 140, 3);
    }
    if (animated) this.scene.tweens.add({ targets: rotor, angle: 360, duration: 24000, repeat: -1 });

    // Four specimen chambers frame the starting area without obscuring combat silhouettes.
    for (const side of [-1, 1]) for (const row of [-1, 1]) {
      const x = centerX + side * 430;
      const y = centerY + row * 210;
      const chamber = this.scene.add.graphics().setPosition(x, y).setDepth(-5);
      chamber.fillStyle(0x020810, 0.85).fillRoundedRect(-48, -75, 96, 150, 16);
      chamber.fillStyle(theme.accent, 0.08).fillRoundedRect(-36, -61, 72, 116, 20);
      chamber.lineStyle(2, theme.accent, 0.35).strokeRoundedRect(-36, -61, 72, 116, 20);
      chamber.fillStyle(0x193142).fillRoundedRect(-48, -75, 96, 14, 4).fillRoundedRect(-48, 55, 96, 20, 4);
      chamber.fillStyle(theme.secondary, 0.8).fillRect(-27, 63, 16, 3).fillRect(-4, 63, 6, 3);
      const specimen = this.scene.add.graphics().setPosition(x, y).setDepth(-4);
      specimen.fillStyle(theme.secondary, 0.25).fillEllipse(0, 4, 24, 42);
      specimen.fillStyle(theme.secondary, 0.4).fillTriangle(0, -10, -21, -30, -4, -23)
        .fillTriangle(0, -10, 18, -35, 8, -15);
      if (animated) this.scene.tweens.add({ targets: specimen, y: y - 8, angle: 5 * side,
        duration: 2300 + row * 250, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      const count = animated ? 3 : 1;
      for (let bubble = 0; bubble < count; bubble++) {
        const mote = this.scene.add.circle(x - 23 + bubble * 21, y + 40, 2 + bubble % 2, theme.accent, 0.35).setDepth(-4);
        if (animated) this.scene.tweens.add({ targets: mote, y: y - 48, alpha: 0,
          duration: 2400 + bubble * 700, delay: bubble * 550, repeat: -1 });
      }
    }
    if (!animated) return;
    // Energy packets travel along the existing central conduit.
    for (let index = 0; index < 6; index++) {
      const packet = this.scene.add.rectangle(120, centerY, 22, 3, theme.accent, 0.7)
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(-5);
      this.scene.tweens.add({ targets: packet, x: ARENA.width - 120,
        duration: 7000, delay: index * 1150, repeat: -1 });
    }
    const moteCount = this.quality.tier === 'high' ? 24 : 12;
    for (let index = 0; index < moteCount; index++) {
      const x = random.between(100, ARENA.width - 100);
      const y = random.between(120, ARENA.height - 100);
      const mote = this.scene.add.circle(x, y, random.between(1, 3), theme.secondary, 0.18).setDepth(-2);
      this.scene.tweens.add({ targets: mote, x: x + random.between(-35, 35), y: y - 65,
        alpha: 0.04, duration: random.between(4000, 7000), yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
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
      if (this.quality.tier === 'low') continue;
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
      if (this.quality.tier === 'low') return;
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
    core.setAlpha(0.8);
  }
}
