import Phaser from 'phaser';
import { runPhase } from '../config/RunPacing';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/Constants';
import { xpForLevel } from '../systems/ExperienceSystem';

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
  private readonly weaponText: Phaser.GameObjects.Text;
  private readonly weaponSlot: Phaser.GameObjects.Text;
  private readonly armorSlot: Phaser.GameObjects.Text;
  private xpTargetWidth = 0;
  private xpRatio = 0;
  private hpTargetWidth = 240;

  constructor(
    private readonly scene: Phaser.Scene,
    arenaName: string,
    weaponName: string,
    onPause: () => void,
    mobile = false,
  ) {
    this.frame = scene.add.rectangle(16, 14, 370, 112, 0x06101d, 0.94)
      .setOrigin(0, 0).setStrokeStyle(3, 0x21e6ff, 0.7);
    scene.add.rectangle(24, 22, 88, 88, 0x0b1e30, 1)
      .setOrigin(0, 0).setStrokeStyle(4, 0x73ef62, 0.8);
    scene.add.image(68, 66, 'leek-avatar').setDisplaySize(80, 80);
    scene.add.circle(104, 104, 20, 0x07111f, 1).setStrokeStyle(3, 0x73ef62, 0.9);
    const operationPanel = scene.add.rectangle(GAME_WIDTH - 16, 14, 290, 64, 0x06101d, 0.86)
      .setOrigin(1, 0).setStrokeStyle(2, 0x73ef62, 0.45).setVisible(!mobile).setName('hud-operation-panel');
    this.hp = scene.add.text(126, 29, 'HP 100 / 100', {
      fontFamily: 'Arial Black', fontSize: '16px', color: '#eaffff',
    });
    scene.add.rectangle(124, 54, 246, 22, 0x260c17, 1)
      .setOrigin(0, 0.5).setStrokeStyle(2, 0x5f2235, 1);
    this.hpFill = scene.add.rectangle(127, 54, 240, 16, 0xd83952).setOrigin(0, 0.5);
    scene.add.rectangle(124, 88, 246, 18, 0x07152a, 1)
      .setOrigin(0, 0.5).setStrokeStyle(2, 0x164f7d, 1);
    this.energyFill = scene.add.rectangle(127, 88, 240, 12, 0x21aee6).setOrigin(0, 0.5);
    this.energyText = scene.add.text(247, 88, 'DASH ENERGY', {
      fontFamily: 'Arial Black', fontSize: '10px', color: '#eaffff',
    }).setOrigin(0.5);
    this.level = scene.add.text(104, 104, '1', {
      fontFamily: 'Arial Black', fontSize: '18px', color: '#eaffff',
    }).setOrigin(0.5);
    const arena = scene.add.text(GAME_WIDTH - 28, 25, arenaName, {
      fontFamily: 'Arial Black', fontSize: '16px', color: '#73ef62',
    }).setOrigin(1, 0).setVisible(!mobile).setName('hud-arena-name');
    const operation = scene.add.text(GAME_WIDTH - 28, 51, 'ACTIVE OPERATION', {
      fontSize: '11px', color: '#8ba5b8', letterSpacing: 2,
    }).setOrigin(1, 0).setVisible(!mobile).setName('hud-operation-state');
    const pauseX = mobile ? GAME_WIDTH - 42 : GAME_WIDTH - 330;
    const pauseButton = scene.add.rectangle(pauseX, 42, mobile ? 52 : 44, mobile ? 52 : 44, 0x06101d, 0.88)
      .setStrokeStyle(2, 0x21e6ff, 0.7).setInteractive({ useHandCursor: true }).setName('hud-pause');
    const pauseLabel = scene.add.text(pauseX, 42, 'Ⅱ', {
      fontFamily: 'Arial Black', fontSize: '18px', color: '#eaffff',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    pauseButton.on('pointerup', onPause);
    pauseLabel.on('pointerup', onPause);
    this.timer = scene.add.text(GAME_WIDTH / 2, 24, '00:00', {
      fontFamily: 'Arial Black', fontSize: '24px', color: '#21e6ff',
    }).setOrigin(0.5, 0);
    this.phase = scene.add.text(GAME_WIDTH / 2, 78, '', { fontFamily: 'monospace', fontSize: mobile ? '14px' : '12px', color: '#ffc857', backgroundColor: '#07111fcc', padding: { x: 8, y: 4 } }).setOrigin(0.5, 0);
    this.weaponText = scene.add.text(GAME_WIDTH / 2, 55, weaponName, {
      fontFamily: 'Arial Black', fontSize: '11px', color: '#a9bbc9', letterSpacing: 2,
    }).setOrigin(0.5, 0);
    this.weaponSlot = scene.add.text(GAME_WIDTH - 300, 94, '⚡ PULSEGUN-01', {
      fontFamily: 'Arial Black', fontSize: '11px', color: '#21e6ff',
      backgroundColor: '#06101ddd', padding: { x: 10, y: 7 },
    }).setOrigin(0, 0).setVisible(!mobile).setName('hud-weapon-slot');
    this.armorSlot = scene.add.text(GAME_WIDTH - 300, 130, '◆ SIN ARMADURA', {
      fontFamily: 'Arial Black', fontSize: '11px', color: '#73ef62',
      backgroundColor: '#06101ddd', padding: { x: 10, y: 7 },
    }).setOrigin(0, 0).setVisible(!mobile).setName('hud-armor-slot');
    // Keep references alive for Phaser's scene ownership while documenting the intentionally
    // omitted mobile operation panel.
    void operationPanel; void arena; void operation;
    scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 22, GAME_WIDTH - 64, 24, 0x07111f, 0.96)
      .setStrokeStyle(3, 0x21e6ff, 0.65);
    this.xpFill = scene.add.rectangle(35, GAME_HEIGHT - 22, 0, 16, 0x73ef62).setOrigin(0, 0.5);
    scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 22, 'EXPERIENCE', {
      fontFamily: 'Arial Black', fontSize: '10px', color: '#eaffff',
    }).setOrigin(0.5);
    for (let index = 1; index < 10; index++)
      scene.add.rectangle(32 + ((GAME_WIDTH - 64) * index) / 10, GAME_HEIGHT - 22, 2, 16, 0x07111f, 0.7);
  }

  update(delta: number, survivalMs: number, dashCharge: number) {
    const seconds = Math.floor(survivalMs / 1000);
    this.phase.setText(runPhase(survivalMs).label);
    this.timer.setText(`${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`);
    const ease = 1 - Math.exp(-delta / 90);
    this.xpFill.width += (this.xpTargetWidth - this.xpFill.width) * ease;
    this.hpFill.width += (this.hpTargetWidth - this.hpFill.width) * ease;
    const imminent = this.xpRatio >= 0.85;
    this.xpFill.setFillStyle(imminent ? 0xd4ff7a : 0x73ef62, imminent ? 0.75 + Math.sin(survivalMs * 0.012) * 0.25 : 1);
    this.energyFill.width = 240 * dashCharge;
    this.energyFill.setFillStyle(dashCharge >= 1 ? 0x21e6ff : 0x17649a);
    this.energyText.setText(dashCharge >= 1 ? 'DASH READY' : `DASH ${Math.round(dashCharge * 100)}%`);
  }

  setHealth(current: number, max: number, damageFlash: Phaser.GameObjects.Rectangle) {
    const ratio = current / max;
    this.hp.setText(`HP ${Math.ceil(current)} / ${max}`).setColor(ratio < 0.3 ? '#ff476f' : '#eaffff');
    this.hpTargetWidth = 240 * Phaser.Math.Clamp(ratio, 0, 1);
    this.hpFill.setFillStyle(ratio < 0.3 ? 0xff214f : 0xd83952);
    this.frame.setStrokeStyle(4, 0xff476f, 1);
    damageFlash.setAlpha(0.18);
    this.scene.tweens.add({ targets: damageFlash, alpha: 0, duration: 180, ease: 'Quad.Out' });
    this.scene.tweens.add({
      targets: this.frame, alpha: { from: 0.55, to: 1 }, duration: 90, yoyo: true,
      onComplete: () => this.frame.setStrokeStyle(3, 0x21e6ff, 0.7),
    });
  }

  setExperience(xp: number, level: number) {
    if (this.level.text !== String(level)) {
      this.level.setText(String(level));
      this.scene.tweens.add({ targets: this.level, scale: 1.7, duration: 120, yoyo: true });
      this.xpFill.width = 0;
      this.scene.tweens.add({ targets: this.xpFill, alpha: { from: 1, to: 0.35 }, duration: 110, yoyo: true, repeat: 1 });
    }
    this.xpRatio = Phaser.Math.Clamp(xp / xpForLevel(level), 0, 1);
    this.xpTargetWidth = (GAME_WIDTH - 70) * this.xpRatio;
  }

  setEquipment(weapon: string, armor: string) {
    this.weaponSlot.setText(`⚡ ${weapon}`);
    this.armorSlot.setText(`◆ ${armor}`);
  }

  setLootSummary(text: string) {
    this.weaponText.setText(text);
  }
}
