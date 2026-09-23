import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/Constants';
import { ARENA_THEMES, sectorRewardMultiplier } from '../config/ArenaDefinitions';
import { loadProfile } from '../systems/ProfileStore';
import { isSectorUnlocked } from '../systems/UnlockRegistry';
import { AudioManager } from '../managers/AudioManager';
import { STARTER_WEAPONS, starterWeapon, type StarterWeaponId } from '../weapons/WeaponRegistry';
import { masteryRank, type WeaponMastery } from '../weapons/WeaponMastery';
import { dailyOperation } from '../progression/DailyOperation';
import { t, td, type StringKey } from '../i18n';
import { hex } from '../ui/SceneWidgets';

/** Last sector chosen in this session, so returning from a sub-menu keeps the selection. */
const SECTOR_REGISTRY_KEY = 'menu-sector';

export class MenuScene extends Phaser.Scene {
  private audio?: AudioManager;
  private selectedWeaponId: StarterWeaponId = 'pulse';
  private sector = 0;
  private selectWeapon?: (index: number) => void;
  constructor() {
    super('Menu');
  }

  create() {
    this.game.canvas.dataset.scene = 'Menu';
    this.audio = new AudioManager(this);
    this.selectedWeaponId = 'pulse';
    const profile = loadProfile();
    const stored = Number(this.registry.get(SECTOR_REGISTRY_KEY) ?? 0);
    this.sector = isSectorUnlocked(stored, profile.unlocks) ? stored : 0;
    const backdrop = this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'menu-backdrop')
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020710, 0.18);
    this.add.rectangle(350, GAME_HEIGHT / 2, 610, GAME_HEIGHT, 0x020710, 0.52);
    this.add
      .rectangle(30, 28, 570, 664, 0x07111f, 0.74)
      .setOrigin(0)
      .setStrokeStyle(2, 0x21e6ff, 0.3);

    this.add
      .text(72, 72, 'LEEK OPS', {
        fontFamily: 'Arial Black',
        fontSize: '76px',
        color: '#73ef62',
        stroke: '#07111f',
        strokeThickness: 12,
      })
      .setShadow(0, 0, '#21e6ff', 18, true, true);
    this.add.text(78, 160, t('menu.tagline'), {
      fontFamily: 'Arial Black',
      fontSize: '15px',
      color: '#21e6ff',
      letterSpacing: 5,
    });
    this.add.rectangle(80, 210, 470, 1, 0x21e6ff, 0.5).setOrigin(0, 0.5);

    this.add.text(80, 228, t('menu.operation'), {
      fontFamily: 'Arial Black',
      fontSize: '12px',
      color: '#7594a8',
      letterSpacing: 3,
    });
    this.createSectorSelector(profile.unlocks);
    this.add.text(80, 322, t('menu.brief'), {
      fontSize: '14px',
      color: '#a9bbc9',
      lineSpacing: 6,
    });
    this.add.text(80, 370, t('menu.stats', { credits: profile.bioCredits, level: profile.bestLevel }), {
      fontFamily: 'Arial Black', fontSize: '12px', color: '#73ef62', letterSpacing: 1,
    }).setName('menu-stats');

    const deploy = () => this.scene.start('Game', { weaponId: this.selectedWeaponId, arenaIndex: this.sector });
    const daily = dailyOperation();
    const deployDaily = () => this.scene.start('Game', {
      weaponId: daily.weaponId, arenaIndex: daily.sector, daily: { date: daily.date, mutator: daily.mutator.id },
    });
    // DEPLOY keeps its original rectangle: browser tests and muscle memory both click its centre.
    this.createButton(80, 392, 330, 66, t('menu.deploy'), 0x73ef62, deploy);
    this.createButton(420, 392, 130, 66, t('menu.daily'), 0xffc857, deployDaily, 12, 'menu-daily');
    this.createButton(80, 474, 220, 48, t('menu.howToPlay'), 0x21e6ff, () =>
      controls.setVisible(!controls.visible),
    );
    this.createButton(320, 474, 220, 48, t('menu.enemies'), 0xffb52e, () => this.scene.start('Bestiary'));
    this.createButton(80, 532, 150, 48, t('menu.workshop'), 0xffc857, () => this.scene.start('Workshop'), 14, 'menu-workshop');
    this.createButton(240, 532, 150, 48, t('menu.settings'), 0xd566ff, () => this.scene.start('Settings'), 14, 'menu-settings');
    this.createButton(400, 532, 150, 48, t('menu.records'), 0x21e6ff, () => this.scene.start('Records'), 14, 'menu-records');
    this.add.text(80, 598,
      profile.unlocks.length > 0
        ? t('menu.unlocks', { list: profile.unlocks.join('  ·  ').toUpperCase() })
        : t('menu.noUnlocks'), {
        fontFamily: 'monospace', fontSize: '10px', color: '#21e6ff', letterSpacing: 1,
      });
    const controls = this.add
      .text(80, 590, t('menu.controls'), {
        fontFamily: 'Arial Black',
        fontSize: '12px',
        color: '#ccebf2',
        backgroundColor: '#06101de6',
        padding: { x: 16, y: 12 },
        lineSpacing: 7,
      })
      .setDepth(20)
      .setVisible(false);

    this.createWeaponSelector(profile.weaponMastery);

    this.createAtmosphere();
    this.createHeroShowcase();
    this.add.text(80, 668, t('menu.build', { version: '0.2.0' }), {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#5d7688',
    });
    this.add
      .text(GAME_WIDTH - 38, 30, t('menu.madeBy'), {
        fontFamily: 'Arial Black',
        fontSize: '14px',
        color: '#eaffff',
        letterSpacing: 2,
      })
      .setOrigin(1, 0)
      .setDepth(8)
      .setShadow(0, 0, '#21e6ff', 8, true, true);
    const dailyLines = [t('menu.dailyInfo', {
      date: daily.date,
      sector: ARENA_THEMES[daily.sector].subtitle,
      weapon: starterWeapon(daily.weaponId).name,
      mutator: td(daily.mutator.name),
    })];
    if (profile.daily.date === daily.date && profile.daily.bestScore > 0)
      dailyLines.push(t('menu.dailyBest', { score: profile.daily.bestScore }));
    this.add.text(GAME_WIDTH - 38, 58, dailyLines.join('\n'), {
      fontFamily: 'monospace', fontSize: '11px', color: '#ffc857', align: 'right', lineSpacing: 4,
      backgroundColor: '#06101dcc', padding: { x: 8, y: 5 },
    }).setOrigin(1, 0).setDepth(8).setName('menu-daily-info');

    // Keyboard and gamepad: the gamepad bridge replays pad input as these same keys.
    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-ENTER', deploy);
    keyboard?.on('keydown-UP', () => this.selectWeapon?.(this.weaponIndex() - 1));
    keyboard?.on('keydown-DOWN', () => this.selectWeapon?.(this.weaponIndex() + 1));
    backdrop.setInteractive();
  }

  update(time: number) {
    this.audio?.updateMusic(time, 'menu');
  }

  private weaponIndex() {
    return STARTER_WEAPONS.findIndex(weapon => weapon.id === this.selectedWeaponId);
  }

  private createSectorSelector(unlocks: readonly string[]) {
    const name = this.add.text(315, 266, '', {
      fontFamily: 'Arial Black', fontSize: '22px', color: '#eaffff',
    }).setOrigin(0.5).setName('menu-sector-name');
    const detail = this.add.text(315, 295, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#7594a8', letterSpacing: 1,
    }).setOrigin(0.5).setName('menu-sector-detail');
    const render = () => {
      const theme = ARENA_THEMES[this.sector];
      name.setText(theme.name).setColor(hex(theme.accent));
      detail.setText(`${theme.subtitle}  ·  ${t('menu.sectorReward', { multiplier: sectorRewardMultiplier(this.sector) })}`);
    };
    const step = (direction: 1 | -1) => () => {
      // Skip locked sectors; the first sector is always available, so this terminates.
      let next = this.sector;
      do next = (next + direction + ARENA_THEMES.length) % ARENA_THEMES.length;
      while (!isSectorUnlocked(next, unlocks));
      if (next === this.sector) {
        this.audio?.play('ui_deny');
        const locked = ARENA_THEMES.findIndex((_, index) => !isSectorUnlocked(index, unlocks));
        if (locked >= 0)
          detail.setText(t('menu.sectorLocked', { requirement: t(`unlock.sector-${locked + 1}` as StringKey) }));
        return;
      }
      this.sector = next;
      this.registry.set(SECTOR_REGISTRY_KEY, next);
      this.audio?.play('ui_confirm');
      render();
    };
    this.createButton(80, 250, 44, 60, '<', 0x21e6ff, step(-1), 20, 'menu-sector-prev');
    this.createButton(506, 250, 44, 60, '>', 0x21e6ff, step(1), 20, 'menu-sector-next');
    this.input.keyboard?.on('keydown-LEFT', step(-1));
    this.input.keyboard?.on('keydown-RIGHT', step(1));
    render();
  }

  private createWeaponSelector(mastery: WeaponMastery) {
    const cards: Phaser.GameObjects.Rectangle[] = [];
    const label = this.add.text(920, 532, t('menu.loadout'), {
      fontFamily: 'Arial Black', fontSize: '12px', color: '#eaffff', letterSpacing: 2,
      backgroundColor: '#06101dcc', padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setDepth(9);
    const select = (index: number) => {
      const wrapped = (index + STARTER_WEAPONS.length) % STARTER_WEAPONS.length;
      const weapon = STARTER_WEAPONS[wrapped];
      this.selectedWeaponId = weapon.id;
      cards.forEach((item, cardIndex) => item
        .setFillStyle(cardIndex === wrapped ? weapon.color : 0x06101d, cardIndex === wrapped ? 0.2 : 0.9)
        .setStrokeStyle(2, STARTER_WEAPONS[cardIndex].color, cardIndex === wrapped ? 1 : 0.42));
      label.setText(t('menu.loadoutReady', { weapon: weapon.name }));
    };
    this.selectWeapon = select;
    STARTER_WEAPONS.forEach((weapon, index) => {
      const x = 700 + index * 220;
      const color = hex(weapon.color);
      const card = this.add.rectangle(x, 620, 202, 126, 0x06101d, 0.9)
        .setStrokeStyle(2, weapon.color, index === 0 ? 1 : 0.42)
        .setInteractive({ useHandCursor: true }).setDepth(9).setName(`weapon-${weapon.id}`);
      this.add.text(x - 82, 574, String(index + 1), {
        fontFamily: 'Arial Black', fontSize: '14px', color,
      }).setOrigin(0.5).setDepth(10);
      this.add.text(x, 600, weapon.name, {
        fontFamily: 'Arial Black', fontSize: '15px', color: '#ffffff', align: 'center',
      }).setOrigin(0.5).setDepth(10);
      this.add.text(x, 624, t(`weapon.${weapon.id}.role` as StringKey), {
        fontFamily: 'monospace', fontSize: '10px', color,
      }).setOrigin(0.5).setDepth(10);
      this.add.text(x, 642, t('menu.mastery', { rank: masteryRank(mastery[weapon.id]), points: mastery[weapon.id] }), {
        fontFamily: 'monospace', fontSize: '9px', color: '#ffc857',
      }).setOrigin(0.5).setDepth(10);
      this.add.text(x, 666, t(`weapon.${weapon.id}.desc` as StringKey), {
        fontFamily: 'Arial', fontSize: '11px', color: '#a9bbc9', align: 'center', wordWrap: { width: 180 },
      }).setOrigin(0.5).setDepth(10);
      card.on('pointerup', () => select(index));
      cards.push(card);
      this.input.keyboard?.on(`keydown-${index + 1}`, () => select(index));
    });
  }

  private createAtmosphere() {
    const portal = this.add.ellipse(972, 360, 410, 520, 0x21e6ff, 0.055).setDepth(1);
    portal.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: portal,
      scaleX: { from: 0.92, to: 1.06 },
      scaleY: { from: 0.98, to: 1.03 },
      alpha: { from: 0.025, to: 0.11 },
      duration: 2100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    for (let index = 0; index < 12; index++) {
      const x = 670 + ((index * 79) % 520);
      const y = 730 + (index % 4) * 18;
      const mote = this.add.circle(x, y, 3 + (index % 3) * 2, index % 2 ? 0x73ef62 : 0x21e6ff, 0.12).setDepth(2);
      mote.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: mote,
        x: x + ((index % 3) - 1) * 75,
        y: 110 + (index % 5) * 40,
        alpha: { from: 0, to: 0.34 },
        scale: { from: 0.45, to: 1.8 },
        duration: 4800 + index * 310,
        delay: index * 240,
        repeat: -1,
      });
    }
    for (let index = 0; index < 5; index++) {
      const smoke = this.add.ellipse(760 + index * 92, 665, 90, 34, 0xbdefff, 0.055).setDepth(2);
      this.tweens.add({
        targets: smoke,
        y: 470 - index * 12,
        x: smoke.x + (index % 2 ? 55 : -35),
        scaleX: 2.1,
        scaleY: 2.8,
        alpha: { from: 0.08, to: 0 },
        duration: 4400 + index * 380,
        delay: index * 700,
        repeat: -1,
        ease: 'Sine.easeOut',
      });
    }
    const scan = this.add.rectangle(940, 155, 510, 2, 0x21e6ff, 0.24).setDepth(5);
    scan.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: scan, y: 630, alpha: { from: 0, to: 0.32 }, duration: 2800, repeat: -1 });
  }

  private createHeroShowcase() {
    const shadow = this.add.ellipse(910, 628, 290, 58, 0x000000, 0.58).setDepth(2);
    const glow = this.add.ellipse(910, 438, 280, 390, 0x73ef62, 0.045).setDepth(2);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    // Keep the showcase inside the right-hand panel on wide desktop and landscape mobile.
    // Explicit dimensions prevent the high-resolution source texture from dictating layout.
    const hero = this.add.image(0, 0, 'leek-hero-clean').setDisplaySize(270, 494);
    const heroScale = hero.scaleX;
    const container = this.add.container(960, 438, [hero]).setDepth(4);
    this.tweens.add({
      targets: container,
      y: 428,
      angle: { from: -0.8, to: 0.8 },
      duration: 1450,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: hero,
      scaleX: { from: heroScale * 0.985, to: heroScale * 1.015 },
      scaleY: { from: heroScale * 1.015, to: heroScale * 0.985 },
      duration: 920,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: [shadow, glow],
      scaleX: { from: 0.88, to: 1.06 },
      alpha: { from: 0.035, to: 0.1 },
      duration: 1450,
      yoyo: true,
      repeat: -1,
    });
  }

  private createButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    color: number,
    action: () => void,
    fontSize = height > 55 ? 25 : 16,
    name?: string,
  ) {
    const button = this.add
      .rectangle(x, y, width, height, 0x07111f, 0.94)
      .setOrigin(0)
      .setStrokeStyle(3, color, 0.9)
      .setInteractive({ useHandCursor: true });
    if (name) button.setName(name);
    const text = this.add
      .text(x + width / 2, y + height / 2, label, {
        fontFamily: 'Arial Black',
        fontSize: `${fontSize}px`,
        color: '#eaffff',
        letterSpacing: fontSize > 13 ? 2 : 1,
        align: 'center',
        wordWrap: { width: width - 12 },
      })
      .setOrigin(0.5);
    button.on('pointerover', () => {
      button.setFillStyle(color, 0.28);
      text.setColor('#ffffff');
    });
    button.on('pointerout', () => button.setFillStyle(0x07111f, 0.94));
    button.on('pointerdown', action);
    return this.add.container(0, 0, [button, text]);
  }
}
