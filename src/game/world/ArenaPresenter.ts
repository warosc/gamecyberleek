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
    if (theme.id === 'greenhouse') {
      this.drawGreenhouse(theme, random);
      return;
    }
    if (theme.id === 'reactor') {
      this.drawFrozenReactor(theme, random);
      return;
    }
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

  private drawGreenhouse(theme: ArenaTheme, random: Phaser.Math.RandomDataGenerator) {
    const animated = this.quality.tier !== 'low';
    const layer = this.scene.add.container(0, 0).setDepth(-5).setName('arena-biome-greenhouse');
    // Thick segmented roots cross the floor in irregular silhouettes without becoming collision walls.
    const roots = this.scene.add.graphics();
    for (let root = 0; root < 7; root++) {
      let x = root % 2 ? 0 : ARENA.width;
      let y = 120 + root * 155;
      roots.lineStyle(18 - root % 3 * 3, root % 2 ? 0x174c30 : 0x285b38, 0.65).beginPath().moveTo(x, y);
      for (let segment = 1; segment <= 6; segment++) {
        x += (root % 2 ? 1 : -1) * ARENA.width / 6;
        y += random.between(-70, 70);
        roots.lineTo(x, y);
      }
      roots.strokePath();
    }
    layer.add(roots);
    // Spore pools create large landmarks that read differently from laboratory machinery.
    for (const [x, y, scale] of [[300, 250, 1], [1680, 890, 1.2], [1010, 970, 0.8]] as const) {
      const pool = this.scene.add.ellipse(x, y, 210 * scale, 90 * scale, 0x183f2b, 0.78)
        .setStrokeStyle(5, theme.accent, 0.28);
      const core = this.scene.add.ellipse(x, y, 120 * scale, 48 * scale, theme.secondary, 0.12);
      layer.add([pool, core]);
      if (animated) this.scene.tweens.add({ targets: core, scale: 1.18, alpha: 0.26,
        duration: 1800 + x % 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
    const towers = this.quality.tier === 'low' ? 5 : 9;
    for (let index = 0; index < towers; index++) {
      const x = 130 + (index * 223) % (ARENA.width - 220);
      const y = index % 2 ? 130 : ARENA.height - 130;
      const stem = this.scene.add.rectangle(x, y, 18, 76, 0x285b38, 0.85);
      const cap = this.scene.add.ellipse(x, y - 42, 82, 34, 0x703b83, 0.9).setStrokeStyle(3, 0xd566ff, 0.5);
      const spores = this.scene.add.circle(x, y - 43, 7, theme.accent, 0.65).setBlendMode(Phaser.BlendModes.ADD);
      layer.add([stem, cap, spores]);
      if (animated) this.scene.tweens.add({ targets: spores, scale: 2.2, alpha: 0.12,
        duration: 1300 + index * 90, yoyo: true, repeat: -1 });
    }
  }

  private drawFrozenReactor(theme: ArenaTheme, random: Phaser.Math.RandomDataGenerator) {
    const animated = this.quality.tier !== 'low';
    const layer = this.scene.add.container(0, 0).setDepth(-5).setName('arena-biome-reactor');
    const pipes = this.scene.add.graphics();
    pipes.lineStyle(28, 0x18264d, 0.9).lineBetween(0, 155, 760, 155).lineBetween(1240, 1045, ARENA.width, 1045)
      .lineBetween(170, 0, 170, 430).lineBetween(1830, 770, 1830, ARENA.height)
      .lineStyle(5, theme.accent, 0.32).lineBetween(0, 155, 760, 155).lineBetween(1240, 1045, ARENA.width, 1045);
    layer.add(pipes);
    for (const [x, y] of [[760, 155], [1240, 1045], [170, 430], [1830, 770]] as const) {
      const rupture = this.scene.add.circle(x, y, 31, 0x091020, 1).setStrokeStyle(6, 0x76a9ff, 0.55);
      layer.add(rupture);
      const vaporCount = this.quality.tier === 'low' ? 1 : 3;
      for (let mote = 0; mote < vaporCount; mote++) {
        const vapor = this.scene.add.circle(x, y, 13 + mote * 5, 0xbce8ff, 0.13);
        layer.add(vapor);
        if (animated) this.scene.tweens.add({ targets: vapor, x: x + random.between(-55, 55), y: y - 95,
          scale: 1.8, alpha: 0, duration: 2200 + mote * 500, delay: mote * 420, repeat: -1 });
      }
    }
    const crystalCount = this.quality.tier === 'low' ? 9 : 16;
    for (let index = 0; index < crystalCount; index++) {
      const x = 90 + random.between(0, ARENA.width - 180);
      const y = index % 2 ? 80 + random.between(0, 120) : ARENA.height - 80 - random.between(0, 120);
      const height = random.between(35, 82);
      const crystal = this.scene.add.graphics().setPosition(x, y)
        .fillStyle(index % 3 ? 0x527ed1 : 0x9bdcff, 0.52)
        .fillTriangle(-18, 15, 0, -height, 18, 15)
        .lineStyle(2, 0xccefff, 0.55).strokeTriangle(-18, 15, 0, -height, 18, 15);
      layer.add(crystal);
      if (animated) this.scene.tweens.add({ targets: crystal, alpha: { from: 0.55, to: 0.9 },
        duration: 1200 + index * 70, yoyo: true, repeat: -1 });
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
