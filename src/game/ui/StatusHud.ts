import Phaser from 'phaser';
import { runPhase } from '../config/RunPacing';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/Constants';
import { xpForLevel } from '../systems/ExperienceSystem';
import { reducedMotion } from '../systems/RuntimeSettings';
import { fitText } from './SceneWidgets';
import { hudFont, hudPx, isCompactHud } from './HudLayout';
import { t, td } from '../i18n';

/** GameScene's "nothing equipped" armor value: a Spanish data string, shown through t(). */
const NO_ARMOR = 'SIN ARMADURA';

/** Equipment names come from data tables in Spanish; the HUD shows them in the player's language. */
export function armorLabel(armor: string) {
  return !armor || armor === NO_ARMOR ? t('hud.noArmor') : td(armor);
}

/** Owns the always-visible run status UI and its frame-rate-independent bar animation. */
export class StatusHud {
  private readonly frame: Phaser.GameObjects.Rectangle;
  private readonly hp: Phaser.GameObjects.Text;
  private readonly hpFill: Phaser.GameObjects.Rectangle;
  private readonly energyFill: Phaser.GameObjects.Rectangle;
  private readonly energyText: Phaser.GameObjects.Text;
  private readonly level: Phaser.GameObjects.Text;
  private readonly timer: Phaser.GameObjects.Text;
  private readonly phase: Phaser.GameObjects.Text;
  private readonly xpFill: Phaser.GameObjects.Rectangle;
  private readonly xpLabel: Phaser.GameObjects.Text;
  private readonly weaponText: Phaser.GameObjects.Text;
  private readonly weaponSlot: Phaser.GameObjects.Text;
  private readonly armorSlot: Phaser.GameObjects.Text;
  /** Width the centred weapon and phase lines may take before they reach a side panel. */
  private readonly centreWidth: number;
  private readonly phaseSize: number;
  private phaseLabel = '';
  private energyLabel = '';
  private xpTargetWidth = 0;
  private xpRatio = 0;
  private hpTargetWidth = 240;

  constructor(
    private readonly scene: Phaser.Scene,
    arenaName: string,
    weaponName: string,
    onPause: () => void,
    onInventory: () => void,
    mobile = false,
  ) {
    // Phone-sized display: larger type, so the bars it is written over grow and the top-centre
    // stack spreads out.
    const compact = isCompactHud(scene);
    // The status panel ends at 386 and the right-hand buttons start about 430 from the edge.
    this.centreWidth = Math.max(300, GAME_WIDTH - 2 * 410);
    this.phaseSize = hudPx(scene, mobile ? 14 : 12);
    this.frame = scene.add.rectangle(16, 14, 370, 112, 0x06101d, 0.94)
      .setOrigin(0, 0).setStrokeStyle(3, 0x21e6ff, 0.7).setName('hud-hp-panel');
    scene.add.rectangle(24, 22, 88, 88, 0x0b1e30, 1)
      .setOrigin(0, 0).setStrokeStyle(4, 0x73ef62, 0.8);
    scene.add.image(68, 66, 'leek-avatar').setDisplaySize(80, 80);
    scene.add.circle(104, 104, 20, 0x07111f, 1).setStrokeStyle(3, 0x73ef62, 0.9);
    const operationPanel = scene.add.rectangle(GAME_WIDTH - 16, 14, 290, 72, 0x06101d, 0.86)
      .setOrigin(1, 0).setStrokeStyle(2, 0x73ef62, 0.45).setVisible(!mobile).setName('hud-operation-panel');
    // At 22px the readout's caps would sit on the bar below it; lifted, they clear it.
    this.hp = scene.add.text(126, compact ? 18 : 29, t('hud.hp', { current: 100, max: 100 }), {
      fontFamily: 'Arial Black', fontSize: hudFont(scene, 16), color: '#eaffff',
    });
    scene.add.rectangle(124, 54, 246, 22, 0x260c17, 1)
      .setOrigin(0, 0.5).setStrokeStyle(2, 0x5f2235, 1);
    this.hpFill = scene.add.rectangle(127, 54, 240, 16, 0xd83952).setOrigin(0, 0.5);
    // The dash label is written over its bar, so the bar grows with the phone-sized type.
    scene.add.rectangle(124, 88, 246, compact ? 26 : 18, 0x07152a, 1)
      .setOrigin(0, 0.5).setStrokeStyle(2, 0x164f7d, 1);
    this.energyFill = scene.add.rectangle(127, 88, 240, compact ? 20 : 12, 0x21aee6).setOrigin(0, 0.5);
    this.energyText = scene.add.text(247, 88, t('hud.dashEnergy'), {
      fontFamily: 'Arial Black', fontSize: hudFont(scene, 10), color: '#eaffff',
      stroke: '#07152a', strokeThickness: compact ? 3 : 0,
    }).setOrigin(0.5);
    fitText(this.energyText, 236, 9);
    this.level = scene.add.text(104, 104, '1', {
      fontFamily: 'Arial Black', fontSize: hudFont(scene, 18), color: '#eaffff',
    }).setOrigin(0.5);
    const arena = fitText(scene.add.text(GAME_WIDTH - 28, 22, td(arenaName), {
      fontFamily: 'Arial Black', fontSize: hudFont(scene, 16), color: '#73ef62',
    }).setOrigin(1, 0).setVisible(!mobile).setName('hud-arena-name'), 258, 10);
    const operation = scene.add.text(GAME_WIDTH - 28, 51, t('hud.activeOperation'), {
      fontSize: hudFont(scene, 11), color: '#8ba5b8', letterSpacing: 2,
    }).setOrigin(1, 0).setVisible(false).setName('hud-operation-state');
    // On phone landscape the logical canvas is scaled down to as little as half size
    // (shortest edge / 720), so a 52px button rendered barely 26 CSS px wide — well under the
    // ~44px minimum touch target. 90px logical stays >=44px CSS even on the narrowest phones.
    const pauseSize = mobile ? 90 : 44;
    const pauseX = mobile ? GAME_WIDTH - 16 - pauseSize / 2 : GAME_WIDTH - 330;
    const pauseY = mobile ? 14 + pauseSize / 2 : 42;
    const pauseButton = scene.add.rectangle(pauseX, pauseY, pauseSize, pauseSize, 0x06101d, 0.88)
      .setStrokeStyle(2, 0x21e6ff, 0.7).setInteractive({ useHandCursor: true }).setName('hud-pause');
    const pauseLabel = scene.add.text(pauseX, pauseY, 'Ⅱ', {
      fontFamily: 'Arial Black', fontSize: mobile ? '28px' : '18px', color: '#eaffff',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    pauseButton.on('pointerup', onPause);
    pauseLabel.on('pointerup', onPause);
    // Left of the 90px pause button with a 12px gap: at GAME_WIDTH - 108 the two overlapped by 32px.
    const inventoryWidth = mobile ? 68 : 72;
    const inventoryX = mobile ? GAME_WIDTH - 16 - pauseSize - 12 - inventoryWidth / 2 : GAME_WIDTH - 390;
    const inventoryButton = scene.add.rectangle(inventoryX, 42, inventoryWidth, mobile ? 52 : 44, 0x06101d, 0.88)
      .setStrokeStyle(2, 0x73ef62, 0.75).setInteractive({ useHandCursor: true }).setName('hud-inventory');
    const inventoryLabel = fitText(scene.add.text(inventoryX, 42, t('hud.inventoryShort'), {
      fontFamily: 'Arial Black', fontSize: hudFont(scene, 13), color: '#73ef62',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }), inventoryWidth - 10, 9);
    inventoryButton.on('pointerup', onInventory);
    inventoryLabel.on('pointerup', onInventory);
    // Compact stack: clock 8-42, weapon line 44-75, phase chip 78-112, so the boss bar (from 120
    // there, see BossBanner) never covers the clock in the fight that most needs it.
    this.timer = scene.add.text(GAME_WIDTH / 2, compact ? 8 : 24, '00:00', {
      fontFamily: 'Arial Black', fontSize: hudFont(scene, 24), color: '#21e6ff',
    }).setOrigin(0.5, 0);
    this.phase = scene.add.text(GAME_WIDTH / 2, 78, '', {
      fontFamily: 'monospace', fontSize: `${this.phaseSize}px`, color: '#ffc857',
      backgroundColor: '#07111fcc', padding: { x: 8, y: 4 },
    }).setOrigin(0.5, 0);
    this.weaponText = scene.add.text(GAME_WIDTH / 2, compact ? 44 : 55, '', {
      fontFamily: 'Arial Black', fontSize: hudFont(scene, 11), color: '#a9bbc9', letterSpacing: 2,
    }).setOrigin(0.5, 0);
    this.setLootSummary(td(weaponName));
    // Weapon and armor share the sector card's second line; as separate tags below it they ran
    // under the objective and chain panels.
    this.weaponSlot = scene.add.text(GAME_WIDTH - 294, 62, '', {
      fontFamily: 'Arial Black', fontSize: hudFont(scene, 12), color: '#21e6ff',
    }).setOrigin(0, 0.5).setVisible(!mobile).setName('hud-weapon-slot');
    this.armorSlot = scene.add.text(GAME_WIDTH - 28, 62, '', {
      fontFamily: 'Arial Black', fontSize: hudFont(scene, 12), color: '#73ef62',
    }).setOrigin(1, 0.5).setVisible(!mobile).setName('hud-armor-slot');
    this.setEquipment(weaponName, '');
    // Keep references alive for Phaser's scene ownership while documenting the intentionally
    // omitted mobile operation panel.
    void operationPanel; void arena; void operation;
    // Same for the XP label: 22px type over the 16px fill spilled past the bar on both edges.
    const xpInner = compact ? 22 : 16;
    scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 22, GAME_WIDTH - 64, xpInner + 8, 0x07111f, 0.96)
      .setStrokeStyle(3, 0x21e6ff, 0.65);
    this.xpFill = scene.add.rectangle(35, GAME_HEIGHT - 22, 0, xpInner, 0x73ef62).setOrigin(0, 0.5);
    this.xpLabel = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 22, t('hud.xpStart'), {
      fontFamily: 'Arial Black', fontSize: hudFont(scene, 10), color: '#eaffff',
      stroke: '#07111f', strokeThickness: compact ? 3 : 0,
    }).setOrigin(0.5);
    for (let index = 1; index < 10; index++)
      scene.add.rectangle(32 + ((GAME_WIDTH - 64) * index) / 10, GAME_HEIGHT - 22, 2, xpInner, 0x07111f, 0.7);
    // The tick marks are drawn after the label; keep the label on top so they never cut through it.
    this.xpLabel.setDepth(1);
  }

  update(delta: number, survivalMs: number, dashCharge: number) {
    const seconds = Math.floor(survivalMs / 1000);
    const phase = td(runPhase(survivalMs).label);
    if (phase !== this.phaseLabel) {
      this.phaseLabel = phase;
      // "ÚLTIMA OLEADA · PREPÁRATE PARA EL COMANDANTE" is ~570px at phone size: it shrinks to the
      // centre column rather than running under the side panels.
      this.phase.setFontSize(this.phaseSize).setText(phase);
      fitText(this.phase, this.centreWidth, 10);
    }
    this.timer.setText(`${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`);
    const ease = 1 - Math.exp(-delta / 90);
    this.xpFill.width += (this.xpTargetWidth - this.xpFill.width) * ease;
    this.hpFill.width += (this.hpTargetWidth - this.hpFill.width) * ease;
    const imminent = this.xpRatio >= 0.85;
    // The ~2 Hz throb is decorative: the brighter colour alone says a level is close.
    const alpha = imminent && !reducedMotion() ? 0.75 + Math.sin(survivalMs * 0.012) * 0.25 : 1;
    this.xpFill.setFillStyle(imminent ? 0xd4ff7a : 0x73ef62, alpha);
    this.energyFill.width = 240 * dashCharge;
    this.energyFill.setFillStyle(dashCharge >= 1 ? 0x21e6ff : 0x17649a);
    const energy = dashCharge >= 1 ? t('hud.dashReady') : t('hud.dashCharge', { percent: Math.round(dashCharge * 100) });
    if (energy !== this.energyLabel) {
      this.energyLabel = energy;
      this.energyText.setText(energy);
    }
  }

  /** `hit` is false for repairs: they refresh the bar and pulse the frame green, with no red flash. */
  setHealth(current: number, max: number, damageFlash: Phaser.GameObjects.Rectangle, hit: boolean) {
    const ratio = current / max;
    this.hp.setText(t('hud.hp', { current: Math.ceil(current), max })).setColor(ratio < 0.3 ? '#ff476f' : '#eaffff');
    this.hpTargetWidth = 240 * Phaser.Math.Clamp(ratio, 0, 1);
    this.hpFill.setFillStyle(ratio < 0.3 ? 0xff214f : 0xd83952);
    this.frame.setStrokeStyle(4, hit ? 0xff476f : 0x73ef62, 1);
    const settle = () => this.frame.setStrokeStyle(3, 0x21e6ff, 0.7);
    // Under reduced motion a hit no longer flashes the whole screen red (a swarm lands several a
    // second: a strobe for a photosensitive player); the bar, the coloured outline and haptics stay.
    if (reducedMotion()) {
      this.scene.time.delayedCall(180, settle);
      return;
    }
    if (hit) {
      damageFlash.setAlpha(0.18);
      this.scene.tweens.add({ targets: damageFlash, alpha: 0, duration: 180, ease: 'Quad.Out' });
    }
    this.scene.tweens.add({
      targets: this.frame, alpha: { from: 0.55, to: 1 }, duration: 90, yoyo: true, onComplete: settle,
    });
  }

  setExperience(xp: number, level: number) {
    if (this.level.text !== String(level)) {
      this.level.setText(String(level));
      this.xpFill.width = 0;
      if (!reducedMotion()) {
        this.scene.tweens.add({ targets: this.level, scale: 1.7, duration: 120, yoyo: true });
        this.scene.tweens.add({ targets: this.xpFill, alpha: { from: 1, to: 0.35 }, duration: 110, yoyo: true, repeat: 1 });
      }
    }
    this.xpRatio = Phaser.Math.Clamp(xp / xpForLevel(level), 0, 1);
    this.xpTargetWidth = (GAME_WIDTH - 70) * this.xpRatio;
    this.xpLabel.setText(t('hud.xp', { xp: Math.floor(xp), next: xpForLevel(level), level }));
  }

  /** Takes GameScene's raw (Spanish) equipment names and shows them in the player's language. */
  setEquipment(weapon: string, armor: string) {
    const size = hudPx(this.scene, 12);
    this.weaponSlot.setFontSize(size).setText(`⚡ ${td(weapon)}`);
    this.armorSlot.setFontSize(size).setText(`◆ ${armorLabel(armor)}`);
    fitText(this.weaponSlot, 128, 9);
    fitText(this.armorSlot, 128, 9);
  }

  /** Already-translated text: the caller builds it with t()/td(). */
  setLootSummary(text: string) {
    this.weaponText.setFontSize(hudPx(this.scene, 11)).setText(text);
    fitText(this.weaponText, this.centreWidth, 9);
  }
}
