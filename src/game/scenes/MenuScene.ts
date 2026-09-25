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
import { UI, drawFrame, fitText, framePanel, hex, isCompact, panelButton, uiFont } from '../ui/SceneWidgets';
import { onlineService } from '../online/OnlinePorts';
import { iconKey, queueSceneArt } from '../config/SceneArt';

/** Last sector chosen in this session, so returning from a sub-menu keeps the selection. */
const SECTOR_REGISTRY_KEY = 'menu-sector';

export class MenuScene extends Phaser.Scene {
  private audio?: AudioManager;
  private selectedWeaponId: StarterWeaponId = 'pulse';
  private sector = 0;
  private selectWeapon?: (index: number) => void;
  /** Horizontal shift for the right-hand showcase, which centres itself on wide phone canvases. */
  private showcaseX = 0;
  constructor() {
    super('Menu');
  }

  /** The loadout icons: three small files, cached after the first menu. */
  preload() {
    queueSceneArt(this, { icons: STARTER_WEAPONS.map(weapon => `weapon-${weapon.id}`) });
  }

  create() {
    this.game.canvas.dataset.scene = 'Menu';
    this.audio = new AudioManager(this);
    this.selectedWeaponId = 'pulse';
    this.showcaseX = (GAME_WIDTH - 1280) / 2;
    const compact = isCompact(this);
    const profile = loadProfile();
    const stored = Number(this.registry.get(SECTOR_REGISTRY_KEY) ?? 0);
    this.sector = isSectorUnlocked(stored, profile.unlocks) ? stored : 0;
    const backdrop = this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'menu-backdrop')
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020710, 0.18);
    this.add.rectangle(350, GAME_HEIGHT / 2, 610, GAME_HEIGHT, 0x020710, 0.52);
    framePanel(this, 315, 360, 572, 668, UI.cyan, {
      fill: 0x07111f, fillAlpha: 0.8, band: 0.05, strokeAlpha: 0.45, cut: 26, glow: 0.08,
    });

    this.add
      .text(72, 70, 'LEEK OPS', {
        fontFamily: 'Arial Black',
        fontSize: '76px',
        color: '#73ef62',
        stroke: '#07111f',
        strokeThickness: 12,
      })
      .setShadow(0, 0, '#21e6ff', 18, true, true);
    fitText(this.add.text(78, 160, t('menu.tagline'), {
      fontFamily: 'Arial Black',
      fontSize: uiFont(this, 15),
      color: '#21e6ff',
      letterSpacing: compact ? 2 : 5,
    }), 480);
    this.add.rectangle(80, 206, 470, 1, UI.cyan, 0.35).setOrigin(0, 0.5);
    this.add.rectangle(80, 206, 90, 3, UI.cyan, 0.9).setOrigin(0, 0.5);

    this.add.text(80, 222, t('menu.operation'), {
      fontFamily: 'Arial Black',
      fontSize: uiFont(this, 12),
      color: UI.muted,
      letterSpacing: 3,
    });
    this.createSectorSelector(profile.unlocks);
    // The two-line brief is flavour; on a phone the larger type needs its room for the controls.
    if (!compact)
      this.add.text(80, 322, t('menu.brief'), {
        fontSize: '14px',
        color: UI.body,
        lineSpacing: 6,
      });
    fitText(this.add.text(80, compact ? 350 : 372, t('menu.stats', { credits: profile.bioCredits, level: profile.bestLevel }), {
      fontFamily: 'Arial Black', fontSize: uiFont(this, 12), color: '#73ef62', letterSpacing: 1,
    }).setOrigin(0, 0.5).setName('menu-stats'), 470);

    const deploy = () => this.scene.start('Game', { weaponId: this.selectedWeaponId, arenaIndex: this.sector });
    const daily = dailyOperation();
    const deployDaily = () => this.scene.start('Game', {
      weaponId: daily.weaponId, arenaIndex: daily.sector, daily: { date: daily.date, mutator: daily.mutator.id },
    });
    // DEPLOY keeps its original rectangle: browser tests and muscle memory both click its centre.
    this.createButton(80, 392, 330, 66, t('menu.deploy'), UI.green, deploy, 25, undefined, true);
    this.createButton(420, 392, 130, 66, t('menu.daily'), UI.gold, deployDaily, 12, 'menu-daily');
    this.createButton(80, 474, 220, 48, t('menu.howToPlay'), UI.cyan, () =>
      controls.setVisible(!controls.visible),
    );
    this.createButton(320, 474, 220, 48, t('menu.enemies'), 0xffb52e, () => this.scene.start('Bestiary'));
    this.createButton(80, 532, 150, 48, t('menu.workshop'), UI.gold, () => this.scene.start('Workshop'), 14, 'menu-workshop');
    this.createButton(240, 532, 150, 48, t('menu.settings'), UI.violet, () => this.scene.start('Settings'), 14, 'menu-settings');
    this.createButton(400, 532, 150, 48, t('menu.records'), UI.cyan, () => this.scene.start('Records'), 14, 'menu-records');
    this.add.text(80, 596,
      profile.unlocks.length > 0
        ? t('menu.unlocks', { list: profile.unlocks.join('  ·  ').toUpperCase() })
        : t('menu.noUnlocks'), {
        fontFamily: 'Arial Black', fontSize: uiFont(this, 10), color: '#21e6ff', letterSpacing: 1,
        wordWrap: { width: 480 }, lineSpacing: 2,
      });
    const controls = this.add
      .text(80, 590, t('menu.controls'), {
        fontFamily: 'Arial Black',
        fontSize: uiFont(this, 12),
        color: '#ccebf2',
        backgroundColor: '#06101df2',
        padding: { x: 16, y: 12 },
        lineSpacing: 7,
      })
      .setDepth(20)
      .setVisible(false);
    // Anchored above the bottom edge so the larger phone type never runs off screen.
    controls.setY(Math.min(590, GAME_HEIGHT - 18 - controls.height));
    fitText(controls, 500);

    this.createWeaponSelector(profile.weaponMastery, compact);

    this.createAtmosphere();
    this.createHeroShowcase();
    // The build tag gives its line to the unlock note, which wraps to three lines on a phone.
    if (!compact)
      this.add.text(80, 690, t('menu.build', { version: '0.2.0' }), {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#5d7688',
      }).setOrigin(0, 1);
    this.add
      .text(GAME_WIDTH - 38, 30, t('menu.madeBy'), {
        fontFamily: 'Arial Black',
        fontSize: uiFont(this, 14),
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
    const dailyChip = this.add.graphics().setDepth(7);
    const dailyInfo = this.add.text(GAME_WIDTH - 50, 72, '', {
      fontFamily: 'Arial Black', fontSize: uiFont(this, 11), color: '#ffc857', align: 'right', lineSpacing: 5,
    }).setOrigin(1, 0).setDepth(8).setName('menu-daily-info');
    const setDaily = (lines: string[]) => {
      dailyInfo.setFontSize(uiFont(this, 11)).setText(lines.join('\n'));
      fitText(dailyInfo, GAME_WIDTH - 700);
      const width = dailyInfo.width + 32;
      const height = dailyInfo.height + 18;
      dailyChip.setPosition(GAME_WIDTH - 50 - dailyInfo.width / 2, 72 + dailyInfo.height / 2);
      drawFrame(dailyChip, width, height, UI.gold, { fill: 0x06101d, fillAlpha: 0.88, band: 0.08, strokeAlpha: 0.6, cut: 10 });
    };
    setDaily(dailyLines);
    this.showOnlineStatus(daily.date, setDaily, dailyLines, profile.runs, profile.operative?.code, () => 72 + dailyInfo.height + 26);

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

  /** Online extras for the menu; silently absent offline or on any network failure. */
  private showOnlineStatus(
    date: string, setDaily: (lines: string[]) => void, lines: string[], localRuns: number, code: string | undefined,
    below: () => number,
  ) {
    const online = onlineService();
    if (!online.online) return;
    void online.fetchDailyBoard(date).then(board => {
      const top = board[0];
      if (!top || !this.sys.isActive()) return;
      lines.push(t('menu.topToday', { callsign: top.displayName, score: top.score }));
      setDaily(lines);
    }).catch(() => undefined);
    if (!code) return;
    void online.cloudSaveInfo(code).then(cloud => {
      if (!cloud || cloud.runs <= localRuns || !this.sys.isActive()) return;
      fitText(this.add.text(GAME_WIDTH - 50, below(), t('menu.cloudAhead', { runs: cloud.runs }), {
        fontFamily: 'Arial Black', fontSize: uiFont(this, 11), color: '#ff476f', align: 'right',
        backgroundColor: '#06101dee', padding: { x: 10, y: 6 },
      }).setOrigin(1, 0).setDepth(8).setName('menu-cloud-ahead'), GAME_WIDTH - 700);
    }).catch(() => undefined);
  }

  private weaponIndex() {
    return STARTER_WEAPONS.findIndex(weapon => weapon.id === this.selectedWeaponId);
  }

  private createSectorSelector(unlocks: readonly string[]) {
    framePanel(this, 315, 280, 370, 64, UI.cyan, { strokeAlpha: 0.25, band: 0.05, cut: 10, brackets: false });
    const name = this.add.text(315, 266, '', {
      fontFamily: 'Arial Black', fontSize: uiFont(this, 22), color: '#eaffff',
    }).setOrigin(0.5).setName('menu-sector-name');
    const detail = this.add.text(315, 296, '', {
      fontFamily: 'Arial Black', fontSize: uiFont(this, 11), color: UI.muted, letterSpacing: 1,
    }).setOrigin(0.5).setName('menu-sector-detail');
    const render = () => {
      const theme = ARENA_THEMES[this.sector];
      name.setFontSize(uiFont(this, 22)).setText(theme.name).setColor(hex(theme.accent));
      fitText(name, 350);
      detail.setFontSize(uiFont(this, 11)).setText(`${theme.subtitle}  ·  ${t('menu.sectorReward', { multiplier: sectorRewardMultiplier(this.sector) })}`);
      fitText(detail, 360);
    };
    const step = (direction: 1 | -1) => () => {
      // Skip locked sectors; the first sector is always available, so this terminates.
      let next = this.sector;
      do next = (next + direction + ARENA_THEMES.length) % ARENA_THEMES.length;
      while (!isSectorUnlocked(next, unlocks));
      if (next === this.sector) {
        this.audio?.play('ui_deny');
        const locked = ARENA_THEMES.findIndex((_, index) => !isSectorUnlocked(index, unlocks));
        if (locked >= 0) {
          detail.setText(t('menu.sectorLocked', { requirement: t(`unlock.sector-${locked + 1}` as StringKey) }));
          fitText(detail, 360);
        }
        return;
      }
      this.sector = next;
      this.registry.set(SECTOR_REGISTRY_KEY, next);
      this.audio?.play('ui_confirm');
      render();
    };
    this.createButton(80, 248, 50, 64, '<', UI.cyan, step(-1), 20, 'menu-sector-prev');
    this.createButton(500, 248, 50, 64, '>', UI.cyan, step(1), 20, 'menu-sector-next');
    this.input.keyboard?.on('keydown-LEFT', step(-1));
    this.input.keyboard?.on('keydown-RIGHT', step(1));
    render();
  }

  private createWeaponSelector(mastery: WeaponMastery, compact: boolean) {
    const cards: { frame: Phaser.GameObjects.Graphics; color: number; icon?: Phaser.GameObjects.Image; iconY: number }[] = [];
    const centre = 920 + this.showcaseX;
    const cardHeight = compact ? 134 : 130;
    const cardY = 620;
    const top = cardY - cardHeight / 2;
    // With icons the badges stand over the cards' top edge, so the label sits above them.
    const withIcons = STARTER_WEAPONS.every(weapon => this.textures.exists(iconKey(`weapon-${weapon.id}`)));
    const label = this.add.text(centre, withIcons ? 488 : 522, t(compact ? 'menu.loadoutTouch' : 'menu.loadout'), {
      fontFamily: 'Arial Black', fontSize: uiFont(this, 12), color: '#eaffff', letterSpacing: 2,
      backgroundColor: '#06101de6', padding: { x: 14, y: 7 },
    }).setOrigin(0.5).setDepth(9);
    let bob: Phaser.Tweens.Tween | undefined;
    const select = (index: number) => {
      const wrapped = (index + STARTER_WEAPONS.length) % STARTER_WEAPONS.length;
      const weapon = STARTER_WEAPONS[wrapped];
      this.selectedWeaponId = weapon.id;
      bob?.stop();
      cards.forEach((card, cardIndex) => {
        const chosen = cardIndex === wrapped;
        drawFrame(card.frame, 206, cardHeight, card.color, chosen
          ? { fill: card.color, fillAlpha: 0.22, band: 0.14, strokeAlpha: 1, glow: 0.25, cut: 14 }
          : { fill: 0x06101d, fillAlpha: 0.92, band: 0.06, strokeAlpha: 0.45, cut: 14, brackets: false });
        card.icon?.setY(card.iconY).setAlpha(chosen ? 1 : 0.8);
      });
      // A gentle bob on the chosen badge: one tween, stopped before the next selection.
      const chosenIcon = cards[wrapped]?.icon;
      if (chosenIcon)
        bob = this.tweens.add({ targets: chosenIcon, y: cards[wrapped].iconY - 5, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      label.setText(t('menu.loadoutReady', { weapon: weapon.name }));
    };
    this.selectWeapon = select;
    STARTER_WEAPONS.forEach((weapon, index) => {
      const x = centre + (index - 1) * 222;
      const color = hex(weapon.color);
      const frame = this.add.graphics({ x, y: cardY }).setDepth(9);
      const card = this.add.rectangle(x, cardY, 206, cardHeight, 0x000000, 0.001)
        .setInteractive({ useHandCursor: true }).setDepth(9).setName(`weapon-${weapon.id}`);
      // The 1 / 2 / 3 key hint only matters with a keyboard.
      if (!compact)
        this.add.text(x - 84, top + 16, String(index + 1), {
          fontFamily: 'Arial Black', fontSize: '14px', color,
        }).setOrigin(0.5).setDepth(10);
      let icon: Phaser.GameObjects.Image | undefined;
      const iconY = top - 4;
      if (withIcons) {
        this.add.circle(x, iconY, 34, 0x06101d, 0.9).setStrokeStyle(2, weapon.color, 0.8).setDepth(10);
        icon = this.add.image(x, iconY, iconKey(`weapon-${weapon.id}`)).setDisplaySize(64, 64).setDepth(11);
      }
      // Text starts below the badge when there is one.
      const shift = withIcons ? (compact ? 14 : 16) : 0;
      fitText(this.add.text(x, top + shift + (compact ? 38 : 30), weapon.name, {
        fontFamily: 'Arial Black', fontSize: uiFont(this, 15), color: '#ffffff', align: 'center',
      }).setOrigin(0.5).setDepth(10), 184);
      fitText(this.add.text(x, top + shift + (compact ? 68 : 52), t(`weapon.${weapon.id}.role` as StringKey), {
        fontFamily: 'Arial Black', fontSize: uiFont(this, 10), color,
      }).setOrigin(0.5).setDepth(10), 184);
      fitText(this.add.text(x, top + shift + (compact ? 96 : 71), t('menu.mastery', { rank: masteryRank(mastery[weapon.id]), points: mastery[weapon.id] }), {
        fontFamily: 'Arial Black', fontSize: uiFont(this, 9), color: '#ffc857',
      }).setOrigin(0.5).setDepth(10), 184);
      // The one-line pitch only fits at desktop type sizes.
      if (!compact)
        this.add.text(x, top + shift + 96, t(`weapon.${weapon.id}.desc` as StringKey), {
          fontFamily: 'Arial', fontSize: '12px', color: UI.body, align: 'center', wordWrap: { width: 184 },
        }).setOrigin(0.5).setDepth(10);
      card.on('pointerup', () => select(index));
      cards.push({ frame, color: weapon.color, icon, iconY });
      this.input.keyboard?.on(`keydown-${index + 1}`, () => select(index));
    });
    select(0);
  }

  private createAtmosphere() {
    const dx = this.showcaseX;
    const portal = this.add.ellipse(972 + dx, 360, 410, 520, 0x21e6ff, 0.055).setDepth(1);
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
      const x = 670 + dx + ((index * 79) % 520);
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
      const smoke = this.add.ellipse(760 + dx + index * 92, 665, 90, 34, 0xbdefff, 0.055).setDepth(2);
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
    const scan = this.add.rectangle(940 + dx, 155, 510, 2, 0x21e6ff, 0.24).setDepth(5);
    scan.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: scan, y: 630, alpha: { from: 0, to: 0.32 }, duration: 2800, repeat: -1 });
  }

  private createHeroShowcase() {
    const dx = this.showcaseX;
    const shadow = this.add.ellipse(910 + dx, 628, 290, 58, 0x000000, 0.58).setDepth(2);
    const glow = this.add.ellipse(910 + dx, 438, 280, 390, 0x73ef62, 0.045).setDepth(2);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    // Keep the showcase inside the right-hand panel on wide desktop and landscape mobile.
    // Explicit dimensions prevent the high-resolution source texture from dictating layout.
    const hero = this.add.image(0, 0, 'leek-hero-clean').setDisplaySize(270, 494);
    const heroScale = hero.scaleX;
    const container = this.add.container(960 + dx, 438, [hero]).setDepth(4);
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

  /** Top-left anchored wrapper over the shared button; the menu's layout is written that way. */
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
    primary = false,
  ) {
    const button = panelButton(this, x + width / 2, y + height / 2, width, height, label, color, action, fontSize, {
      name, primary, onDown: true,
    });
    // Multi-word labels such as OPERACIÓN DIARIA wrap inside narrow buttons instead of shrinking.
    if (label.includes(' ') && width < 200) {
      button.text.setStyle({ wordWrap: { width: width - 14 } }).setFontSize(uiFont(this, fontSize));
      fitText(button.text, width - 14);
    }
    return button;
  }
}
