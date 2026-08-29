import Phaser from 'phaser';
import { Events, GAME_HEIGHT, GAME_WIDTH, GameState } from '../config/Constants';
import { xpForLevel } from '../systems/ExperienceSystem';
import type { Ability } from '../abilities/AbilityRegistry';
import type { GameScene } from './GameScene';
import { SPECIAL_ABILITIES, type SpecialAbilityId } from '../abilities/SpecialAbilities';
import type { Equipment } from '../loot/Equipment';
import { loadProfile, updateProfile } from '../systems/ProfileStore';
import { DebugOverlay } from '../ui/DebugOverlay';
import { ModalOverlay } from '../ui/ModalOverlay';
import { MobileControls } from '../ui/MobileControls';
import { RewardChooser } from '../ui/RewardChooser';

/**
 * iOS Safari answers `'vibrate' in navigator` with true while `navigator.vibrate` is
 * undefined, so a property check is not enough: the value has to be callable. That gap threw
 * on the first hit the player took and killed the game loop on every iPhone run.
 * Haptics are a nicety, so a refusal by the browser must never reach gameplay either.
 */
function pulseHaptics(durationMs: number) {
  if (typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(durationMs);
  } catch {
    // Ignored on purpose.
  }
}
export class UIScene extends Phaser.Scene {
  private gameScene!: GameScene;
  private hp!: Phaser.GameObjects.Text;
  private hpFill!: Phaser.GameObjects.Rectangle;
  private energyFill!: Phaser.GameObjects.Rectangle;
  private energyText!: Phaser.GameObjects.Text;
  private playerFrame!: Phaser.GameObjects.Rectangle;
  private damageFlash!: Phaser.GameObjects.Rectangle;
  private level!: Phaser.GameObjects.Text;
  private timer!: Phaser.GameObjects.Text;
  private xpFill!: Phaser.GameObjects.Rectangle;
  private debug?: Phaser.GameObjects.Text;
  private debugOverlay?: DebugOverlay;
  private modal!: ModalOverlay;
  private mobileControls?: MobileControls;
  private chooser?: RewardChooser;
  private specialFills = new Map<SpecialAbilityId, Phaser.GameObjects.Rectangle>();
  private specialTexts = new Map<SpecialAbilityId, Phaser.GameObjects.Text>();
  private bossPanel!: Phaser.GameObjects.Container;
  private bossFill!: Phaser.GameObjects.Rectangle;
  private bossPhaseText!: Phaser.GameObjects.Text;
  private weaponText!: Phaser.GameObjects.Text;
  private weaponSlot!: Phaser.GameObjects.Text;
  private armorSlot!: Phaser.GameObjects.Text;
  /** Interpolation targets. A bar that snaps gives the player nothing to feel. */
  private xpTargetWidth = 0;
  private xpRatio = 0;
  private hpTargetWidth = 240;
  constructor() {
    super('UI');
  }
  create(data: { game: GameScene }) {
    this.gameScene = data.game;
    this.modal = new ModalOverlay(this);
    this.damageFlash = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xff214f, 0)
      .setDepth(90);
    this.playerFrame = this.add
      .rectangle(16, 14, 370, 112, 0x06101d, 0.94)
      .setOrigin(0, 0)
      .setStrokeStyle(3, 0x21e6ff, 0.7);
    this.add
      .rectangle(24, 22, 88, 88, 0x0b1e30, 1)
      .setOrigin(0, 0)
      .setStrokeStyle(4, 0x73ef62, 0.8);
    this.add.image(68, 66, 'leek-avatar').setDisplaySize(80, 80);
    this.add.circle(104, 104, 20, 0x07111f, 1).setStrokeStyle(3, 0x73ef62, 0.9);
    this.add
      .rectangle(GAME_WIDTH - 16, 14, 290, 64, 0x06101d, 0.86)
      .setOrigin(1, 0)
      .setStrokeStyle(2, 0x73ef62, 0.45);
    this.hp = this.add.text(126, 29, 'HP 100 / 100', {
      fontFamily: 'Arial Black',
      fontSize: '16px',
      color: '#eaffff',
    });
    this.add
      .rectangle(124, 54, 246, 22, 0x260c17, 1)
      .setOrigin(0, 0.5)
      .setStrokeStyle(2, 0x5f2235, 1);
    this.hpFill = this.add.rectangle(127, 54, 240, 16, 0xd83952).setOrigin(0, 0.5);
    this.add
      .rectangle(124, 88, 246, 18, 0x07152a, 1)
      .setOrigin(0, 0.5)
      .setStrokeStyle(2, 0x164f7d, 1);
    this.energyFill = this.add.rectangle(127, 88, 240, 12, 0x21aee6).setOrigin(0, 0.5);
    this.energyText = this.add
      .text(247, 88, 'DASH ENERGY', {
        fontFamily: 'Arial Black',
        fontSize: '10px',
        color: '#eaffff',
      })
      .setOrigin(0.5);
    this.level = this.add
      .text(104, 104, '1', {
        fontFamily: 'Arial Black',
        fontSize: '18px',
        color: '#eaffff',
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH - 28, 25, this.gameScene.arenaName, {
        fontFamily: 'Arial Black',
        fontSize: '16px',
        color: '#73ef62',
      })
      .setOrigin(1, 0);
    this.add
      .text(GAME_WIDTH - 28, 51, 'ACTIVE OPERATION', {
        fontSize: '11px',
        color: '#8ba5b8',
        letterSpacing: 2,
      })
      .setOrigin(1, 0);
    const pauseButton = this.add
      .rectangle(GAME_WIDTH - 330, 44, 44, 44, 0x06101d, 0.94)
      .setStrokeStyle(2, 0x21e6ff, 0.7)
      .setInteractive({ useHandCursor: true });
    const pauseLabel = this.add
      .text(GAME_WIDTH - 330, 44, 'Ⅱ', {
        fontFamily: 'Arial Black', fontSize: '18px', color: '#eaffff',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    pauseButton.on('pointerup', () => this.gameScene.togglePause());
    pauseLabel.on('pointerup', () => this.gameScene.togglePause());
    this.timer = this.add
      .text(GAME_WIDTH / 2, 24, '00:00', {
        fontFamily: 'Arial Black',
        fontSize: '24px',
        color: '#21e6ff',
      })
      .setOrigin(0.5, 0);
    this.weaponText = this.add
      .text(GAME_WIDTH / 2, 55, this.gameScene.player.stats.weaponName, {
        fontFamily: 'Arial Black',
        fontSize: '11px',
        color: '#a9bbc9',
        letterSpacing: 2,
      })
      .setOrigin(0.5, 0);
    this.weaponSlot = this.add.text(GAME_WIDTH - 300, 94, '⚡ PULSEGUN-01', {
      fontFamily: 'Arial Black', fontSize: '11px', color: '#21e6ff',
      backgroundColor: '#06101ddd', padding: { x: 10, y: 7 },
    }).setOrigin(0, 0);
    this.armorSlot = this.add.text(GAME_WIDTH - 300, 130, '◆ SIN ARMADURA', {
      fontFamily: 'Arial Black', fontSize: '11px', color: '#73ef62',
      backgroundColor: '#06101ddd', padding: { x: 10, y: 7 },
    }).setOrigin(0, 0);
    const bossBack = this.add
      .rectangle(GAME_WIDTH / 2, 88, 540, 48, 0x100817, 0.95)
      .setStrokeStyle(3, 0xd566ff, 0.85);
    this.bossFill = this.add
      .rectangle(GAME_WIDTH / 2 - 255, 98, 510, 15, 0x9d36d6)
      .setOrigin(0, 0.5);
    const bossName = this.add
      .text(GAME_WIDTH / 2, 76, 'BROCCOLI COMMANDER', {
        fontFamily: 'Arial Black',
        fontSize: '15px',
        color: '#f4d7ff',
      })
      .setOrigin(0.5);
    this.bossPhaseText = this.add.text(GAME_WIDTH / 2 + 246, 76, 'PHASE 1', {
      fontFamily: 'monospace', fontSize: '11px', color: '#d566ff', letterSpacing: 1,
    }).setOrigin(1, 0.5);
    this.bossPanel = this.add
      .container(0, 0, [bossBack, this.bossFill, bossName, this.bossPhaseText])
      .setVisible(false);
    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 22, GAME_WIDTH - 64, 24, 0x07111f, 0.96)
      .setStrokeStyle(3, 0x21e6ff, 0.65);
    this.xpFill = this.add.rectangle(35, GAME_HEIGHT - 22, 0, 16, 0x73ef62).setOrigin(0, 0.5);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 22, 'EXPERIENCE', {
        fontFamily: 'Arial Black',
        fontSize: '10px',
        color: '#eaffff',
      })
      .setOrigin(0.5);
    for (let index = 1; index < 10; index++)
      this.add.rectangle(
        32 + ((GAME_WIDTH - 64) * index) / 10,
        GAME_HEIGHT - 22,
        2,
        16,
        0x07111f,
        0.7,
      );
    const mobileHud = this.gameScene.mobileInput.active;
    if (mobileHud)
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 84, 430, 96, 0x04101c, 0.7)
        .setStrokeStyle(2, 0x21e6ff, 0.22).setDepth(1);
    SPECIAL_ABILITIES.forEach((ability, index) => {
      const x = mobileHud ? GAME_WIDTH / 2 + (index - 1) * 120 : GAME_WIDTH - 300 + index * 104;
      const y = mobileHud ? GAME_HEIGHT - 86 : GAME_HEIGHT - 78;
      const button = this.add
        .rectangle(x, y, mobileHud ? 108 : 94, mobileHud ? 82 : 72, 0x081522, 0.96)
        .setStrokeStyle(3, ability.color, 0.8)
        .setInteractive({ useHandCursor: true });
      const fill = this.add
        .rectangle(x - 43, y + 27, 86, 7, ability.color, 0.9)
        .setOrigin(0, 0.5);
      const keyRadius = mobileHud ? 18 : 15;
      this.add.circle(x - 31, y - 19, keyRadius, 0x06101d).setStrokeStyle(2, ability.color);
      this.add
        .text(x - 31, y - 19, ability.key, {
          fontFamily: 'Arial Black',
          fontSize: '15px',
          color: '#ffffff',
        })
        .setOrigin(0.5);
      // Fit the name to the gap between the key badge and the button edge instead of a fixed
      // wrap width: word wrap cannot split a single long word, so "OVERDRIVE" ran over the
      // badge and past the button.
      const labelLeft = x - 31 + keyRadius + 4;
      const labelRight = x + (mobileHud ? 108 : 94) / 2 - 6;
      const labelWidth = labelRight - labelLeft;
      const label = this.add
        .text(labelLeft + labelWidth / 2, y - 19, ability.name, {
          fontFamily: 'Arial Black',
          fontSize: '10px',
          color: '#eaffff',
          align: 'center',
          wordWrap: { width: labelWidth },
        })
        .setOrigin(0.5);
      if (label.width > labelWidth) label.setScale(labelWidth / label.width);
      const cooldownText = this.add
        .text(x, y + 8, 'READY', {
          fontFamily: 'Arial Black',
          fontSize: '10px',
          color: '#ffffff',
        })
        .setOrigin(0.5);
      button.on('pointerdown', () => this.gameScene.activateSpecial(ability.id));
      this.specialFills.set(ability.id, fill);
      this.specialTexts.set(ability.id, cooldownText);
    });
    if (this.gameScene.mobileInput.active) {
      this.mobileControls = new MobileControls(this, this.gameScene);
      this.mobileControls.create();
    }
    if (import.meta.env.VITE_DEBUG_GAME === 'true')
      // Below the weapon/armor slots: at y=90 the overlay covered them.
      this.debug = this.add
        .text(GAME_WIDTH - 16, 166, '', {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#8ff8ff',
          backgroundColor: '#06101dcc',
          padding: { x: 8, y: 6 },
        })
        .setOrigin(1, 0);
    if (this.debug) this.debugOverlay = new DebugOverlay(this.game, this.gameScene, this.debug);
    this.gameScene.events.on(Events.PLAYER_DAMAGED, this.onHealth, this);
    this.gameScene.events.on(Events.XP_COLLECTED, this.onXp, this);
    this.gameScene.events.on(Events.PLAYER_LEVEL_UP, this.showAbilities, this);
    this.gameScene.events.on(Events.STATE_CHANGED, this.onState, this);
    this.gameScene.events.on(Events.BOSS_SPAWNED, this.onBossSpawned, this);
    this.gameScene.events.on(Events.BOSS_HEALTH, this.onBossHealth, this);
    this.gameScene.events.on(Events.CHEST_OPENED, this.showChestRewards, this);
    this.gameScene.events.on(Events.LOOT_COLLECTED, this.showLootBanner, this);
    this.gameScene.events.on(Events.EQUIPMENT_CHANGED, this.onEquipmentChanged, this);
    this.events.once('shutdown', () => {
      this.closeModal();
      this.mobileControls?.destroy();
      this.gameScene.events.off(Events.PLAYER_DAMAGED, this.onHealth, this);
      this.gameScene.events.off(Events.XP_COLLECTED, this.onXp, this);
      this.gameScene.events.off(Events.PLAYER_LEVEL_UP, this.showAbilities, this);
      this.gameScene.events.off(Events.STATE_CHANGED, this.onState, this);
      this.gameScene.events.off(Events.BOSS_SPAWNED, this.onBossSpawned, this);
      this.gameScene.events.off(Events.BOSS_HEALTH, this.onBossHealth, this);
      this.gameScene.events.off(Events.CHEST_OPENED, this.showChestRewards, this);
      this.gameScene.events.off(Events.LOOT_COLLECTED, this.showLootBanner, this);
      this.gameScene.events.off(Events.EQUIPMENT_CHANGED, this.onEquipmentChanged, this);
    });
  }
  update(_time: number, delta: number) {
    const seconds = Math.floor(this.gameScene.survivalMs / 1000);
    this.timer.setText(
      `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`,
    );
    // Ease both bars toward their target. The step is frame-rate independent so a 165Hz
    // display and a 60Hz display fill at the same speed.
    const ease = 1 - Math.exp(-delta / 90);
    this.xpFill.width += (this.xpTargetWidth - this.xpFill.width) * ease;
    this.hpFill.width += (this.hpTargetWidth - this.hpFill.width) * ease;
    // Anticipation: the bar starts breathing once a level-up is within reach.
    const imminent = this.xpRatio >= 0.85;
    this.xpFill.setFillStyle(
      imminent ? 0xd4ff7a : 0x73ef62,
      imminent ? 0.75 + Math.sin(this.gameScene.survivalMs * 0.012) * 0.25 : 1,
    );
    const dashCharge = this.gameScene.player.getDashCharge();
    this.energyFill.width = 240 * dashCharge;
    this.energyFill.setFillStyle(dashCharge >= 1 ? 0x21e6ff : 0x17649a);
    this.energyText.setText(
      dashCharge >= 1 ? 'DASH READY' : `DASH ${Math.round(dashCharge * 100)}%`,
    );
    for (const ability of SPECIAL_ABILITIES) {
      const charge = this.gameScene.getSpecialCharge(ability.id);
      this.specialFills.get(ability.id)!.width = 86 * charge;
      this.specialTexts
        .get(ability.id)!
        .setText(charge >= 1 ? 'READY' : `${Math.ceil((ability.cooldown * (1 - charge)) / 1000)}s`);
    }
    this.debugOverlay?.update(delta);
  }
  private onHealth(current: number, max: number) {
    if (current < max && loadProfile().vibration) pulseHaptics(35);
    this.hp
      .setText(`HP ${Math.ceil(current)} / ${max}`)
      .setColor(current / max < 0.3 ? '#ff476f' : '#eaffff');
    this.hpTargetWidth = 240 * Phaser.Math.Clamp(current / max, 0, 1);
    this.hpFill.setFillStyle(current / max < 0.3 ? 0xff214f : 0xd83952);
    this.playerFrame.setStrokeStyle(4, 0xff476f, 1);
    this.damageFlash.setAlpha(0.18);
    this.tweens.add({ targets: this.damageFlash, alpha: 0, duration: 180, ease: 'Quad.Out' });
    this.tweens.add({
      targets: this.playerFrame,
      alpha: { from: 0.55, to: 1 },
      duration: 90,
      yoyo: true,
      onComplete: () => this.playerFrame.setStrokeStyle(3, 0x21e6ff, 0.7),
    });
  }
  private onXp(xp: number, level: number) {
    const levelled = this.level.text !== String(level);
    if (levelled) {
      this.level.setText(String(level));
      this.tweens.add({ targets: this.level, scale: 1.7, duration: 120, yoyo: true });
      // The bar has to visibly empty and refill, or a level-up looks like the bar glitching.
      this.xpFill.width = 0;
      this.tweens.add({
        targets: this.xpFill,
        alpha: { from: 1, to: 0.35 },
        duration: 110,
        yoyo: true,
        repeat: 1,
      });
    }
    this.xpRatio = Phaser.Math.Clamp(xp / xpForLevel(level), 0, 1);
    this.xpTargetWidth = (GAME_WIDTH - 70) * this.xpRatio;
  }
  private showAbilities(abilities: Ability[]) {
    const parts: Phaser.GameObjects.GameObject[] = [
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020711, 0.93),
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 1040, 570, 0x061323, 0.98)
        .setStrokeStyle(2, 0x21e6ff, 0.5),
      this.add
        .text(GAME_WIDTH / 2, 118, 'LEVEL UP', {
          fontFamily: 'Arial Black',
          fontSize: '42px',
          color: '#73ef62',
        })
        .setOrigin(0.5),
      this.add.text(GAME_WIDTH / 2, 164, 'CHOOSE YOUR NEXT PROTOCOL', {
        fontFamily: 'Arial Black', fontSize: '12px', color: '#8ba5b8', letterSpacing: 3,
      }).setOrigin(0.5),
    ];
    const accents = [0x21e6ff, 0x73ef62, 0xd566ff];
    this.chooser = new RewardChooser(this, (index) => {
      const chosen = abilities[index];
      this.closeModal();
      this.gameScene.selectAbility(chosen.id);
    });
    parts.push(
      ...this.chooser.build(
        abilities.map((ability, index) => {
          const current = this.gameScene.abilityLevels.get(ability.id) ?? 0;
          return {
            accent: accents[index] ?? 0x21e6ff,
            icon: ability.icon,
            name: ability.name,
            effect: ability.description,
            footer:
              current + 1 >= ability.maxLevel
                ? `LEVEL ${current + 1}  ·  MAX`
                : `LEVEL ${current}  →  ${current + 1}`,
            pips: { filled: current + 1, total: ability.maxLevel },
          };
        }),
        GAME_WIDTH / 2,
        378,
      ),
    );
    parts.push(this.add.text(GAME_WIDTH / 2, 585, this.gameScene.mobileInput.active
      ? 'TAP A PROTOCOL TO CONTINUE'
      : 'PRESS 1-3, OR USE ← → AND ENTER', {
      fontFamily: 'monospace', fontSize: '12px', color: '#7594a8', letterSpacing: 2,
    }).setOrigin(0.5));
    this.modal.replace(parts, 100);
  }

  /** Every modal close goes through here so a chooser can never outlive its cards. */
  private closeModal() {
    this.chooser?.destroy();
    this.chooser = undefined;
    this.modal.clear();
  }

  private onBossSpawned() {
    this.bossPanel.setVisible(true);
    this.cameras.main.flash(280, 95, 15, 120);
  }
  private onBossHealth(current: number, max: number) {
    this.bossFill.width = 510 * (current / max);
    const ratio = current / max;
    const phase = ratio <= 0.33 ? 3 : ratio <= 0.66 ? 2 : 1;
    this.bossPhaseText.setText(`PHASE ${phase}`)
      .setColor(phase === 3 ? '#ff476f' : phase === 2 ? '#ffb52e' : '#d566ff');
  }
  private showChestRewards() {
    const rewards = [
      { id: 'repair' as const, name: 'FIELD REPAIR', effect: 'Restore 40 HP', icon: '✚', color: 0x73ef62 },
      { id: 'charge' as const, name: 'FULL CHARGE', effect: 'Reset powers + shield', icon: '⚡', color: 0x21e6ff },
      { id: 'weapon' as const, name: 'WEAPON CACHE', effect: '+6 permanent damage', icon: '✦', color: 0xd566ff },
    ];
    const parts: Phaser.GameObjects.GameObject[] = [
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020711, 0.93),
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 1040, 540, 0x061323, 0.98)
        .setStrokeStyle(2, 0x73ef62, 0.5),
      this.add
        .text(GAME_WIDTH / 2, 140, 'SUPPLY CHEST', {
          fontFamily: 'Arial Black',
          fontSize: '42px',
          color: '#73ef62',
        })
        .setOrigin(0.5),
      this.add.text(GAME_WIDTH / 2, 182, 'SELECT ONE FIELD REWARD', {
        fontFamily: 'Arial Black', fontSize: '12px', color: '#8ba5b8', letterSpacing: 3,
      }).setOrigin(0.5),
    ];
    this.chooser = new RewardChooser(this, (index) => {
      const reward = rewards[index];
      this.closeModal();
      this.gameScene.selectChestReward(reward.id);
    });
    parts.push(
      ...this.chooser.build(
        rewards.map((reward) => ({
          accent: reward.color,
          icon: reward.icon,
          name: reward.name,
          effect: reward.effect,
          footer: 'CLAIM REWARD',
        })),
        GAME_WIDTH / 2,
        382,
      ),
    );
    parts.push(this.add.text(GAME_WIDTH / 2, 578, this.gameScene.mobileInput.active
      ? 'TAP A REWARD TO CONTINUE'
      : 'PRESS 1-3, OR USE ← → AND ENTER', {
      fontFamily: 'monospace', fontSize: '12px', color: '#7594a8', letterSpacing: 2,
    }).setOrigin(0.5));
    this.modal.replace(parts, 110);
  }

  private showLootBanner(equipment: Equipment) {
    this.weaponText.setText(
      equipment.kind === 'weapon'
        ? equipment.name
        : `${this.gameScene.player.stats.weaponName}  ·  ARMOR ${Math.round(this.gameScene.player.stats.damageReduction * 100)}%`,
    );
    const color = `#${equipment.color.toString(16).padStart(6, '0')}`;
    const panel = this.add.rectangle(GAME_WIDTH / 2, 175, 560, 112, 0x06101d, 0.96)
      .setStrokeStyle(4, equipment.color, 0.95);
    const rarity = this.add.text(GAME_WIDTH / 2, 141, `${equipment.rarity}  //  ${equipment.kind.toUpperCase()}`, {
      fontFamily: 'Arial Black', fontSize: '13px', color, letterSpacing: 3,
    }).setOrigin(0.5);
    const title = this.add.text(GAME_WIDTH / 2, 170, equipment.name, {
      fontFamily: 'Arial Black', fontSize: '23px', color: '#ffffff',
    }).setOrigin(0.5);
    const description = this.add.text(GAME_WIDTH / 2, 202, equipment.description, {
      fontSize: '14px', color: '#c7d9e2',
    }).setOrigin(0.5);
    const banner = this.add.container(0, -35, [panel, rarity, title, description]).setDepth(130).setAlpha(0);
    this.tweens.add({
      targets: banner,
      y: 0,
      alpha: 1,
      duration: 260,
      hold: 2300,
      yoyo: true,
      onComplete: () => banner.destroy(),
    });
  }
  private onEquipmentChanged(weapon: string, armor: string) {
    this.weaponSlot.setText(`⚡ ${weapon}`);
    this.armorSlot.setText(`◆ ${armor}`);
  }
  private onState(state: GameState) {
    if (state === GameState.PAUSED && !this.modal.active) {
      const parts: Phaser.GameObjects.GameObject[] = [];
      parts.push(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020710, 0.82));
      parts.push(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 650, 560, 0x071522, 0.98)
        .setStrokeStyle(3, 0x21e6ff, 0.8));
      parts.push(this.add.circle(GAME_WIDTH / 2, 166, 58, 0x0b2130, 1).setStrokeStyle(4, 0x73ef62, 0.8));
      parts.push(this.add.image(GAME_WIDTH / 2, 166, 'leek-avatar').setDisplaySize(104, 104));
      parts.push(this.add.text(GAME_WIDTH / 2, 240, 'OPERACIÓN EN PAUSA', {
        fontFamily: 'Arial Black', fontSize: '34px', color: '#eaffff',
      }).setOrigin(0.5));
      parts.push(this.add.text(GAME_WIDTH / 2, 286,
        `NIVEL ${this.gameScene.xp.level}   ·   ${this.gameScene.player.stats.weaponName}   ·   ARMOR ${Math.round(this.gameScene.player.stats.damageReduction * 100)}%`, {
          fontFamily: 'Arial Black', fontSize: '12px', color: '#73ef62', letterSpacing: 1,
        }).setOrigin(0.5));
      const resume = this.pauseMenuButton(GAME_WIDTH / 2, 360, 'CONTINUAR', 0x73ef62, () => this.gameScene.resumeGame());
      const menu = this.pauseMenuButton(GAME_WIDTH / 2, 440, 'MENÚ PRINCIPAL', 0x21e6ff, () => this.gameScene.returnToMenu());
      parts.push(...resume, ...menu);
      const volumeLabel = this.add.text(GAME_WIDTH / 2, 505, '', {
        fontFamily: 'monospace', fontSize: '13px', color: '#eaffff', letterSpacing: 2,
      }).setOrigin(0.5);
      const refreshVolume = () => {
        const percent = Math.round(this.gameScene.audioVolume * 100);
        volumeLabel.setText(`VOLUME ${percent}%`);
      };
      const volumeDown = this.pauseMenuButton(GAME_WIDTH / 2 - 145, 505, '−', 0xd566ff, () => {
        this.gameScene.adjustAudioVolume(-0.1); refreshVolume();
      }, 70);
      const volumeUp = this.pauseMenuButton(GAME_WIDTH / 2 + 145, 505, '+', 0xd566ff, () => {
        this.gameScene.adjustAudioVolume(0.1); refreshVolume();
      }, 70);
      refreshVolume();
      parts.push(volumeLabel, ...volumeDown, ...volumeUp);
      parts.push(this.add.text(GAME_WIDTH / 2, 570, 'ESC  ·  VOLVER AL COMBATE', {
        fontFamily: 'monospace', fontSize: '12px', color: '#7594a8', letterSpacing: 2,
      }).setOrigin(0.5));
      this.modal.replace(parts, 100);
    } else if ((state === GameState.PLAYING || state === GameState.BOSS) && this.modal.active) {
      this.closeModal();
    }
  }
  private pauseMenuButton(x: number, y: number, label: string, color: number, action: () => void, width = 330) {
    const button = this.add.rectangle(x, y, width, 58, 0x0b1b2b, 1)
      .setStrokeStyle(3, color, 0.85).setInteractive({ useHandCursor: true });
    const text = this.add.text(x, y, label, {
      fontFamily: 'Arial Black', fontSize: '17px', color: '#eaffff', letterSpacing: 2,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const activate = () => action();
    button.on('pointerup', activate);
    text.on('pointerup', activate);
    button.on('pointerover', () => button.setFillStyle(color, 0.25));
    button.on('pointerout', () => button.setFillStyle(0x0b1b2b, 1));
    return [button, text];
  }
  /** @deprecated Kept temporarily as a reference while MobileControls owns the runtime path. */
  createMobileControlsLegacy() {
    const moveCenter = new Phaser.Math.Vector2(135, GAME_HEIGHT - 165);
    const aimCenter = new Phaser.Math.Vector2(GAME_WIDTH - 135, GAME_HEIGHT - 170);
    const moveBase = this.add
      .circle(moveCenter.x, moveCenter.y, 86, 0x07111f, 0.52)
      .setStrokeStyle(3, 0x21e6ff, 0.55)
      .setInteractive({ useHandCursor: true })
      .setDepth(60);
    const moveKnob = this.add.circle(moveCenter.x, moveCenter.y, 35, 0x21e6ff, 0.48).setDepth(61);
    const aimBase = this.add
      .circle(aimCenter.x, aimCenter.y, 88, 0x07111f, 0.52)
      .setStrokeStyle(3, 0xff476f, 0.65)
      .setInteractive({ useHandCursor: true })
      .setDepth(60);
    const aimKnob = this.add.circle(aimCenter.x, aimCenter.y, 35, 0xff476f, 0.48).setDepth(61);
    this.add
      .text(moveCenter.x, moveCenter.y + 105, 'MOVE', {
        fontFamily: 'Arial Black',
        fontSize: '11px',
        color: '#8fcbd6',
      })
      .setOrigin(0.5)
      .setDepth(61);
    this.add
      .text(aimCenter.x, aimCenter.y + 107, 'AIM / FIRE', {
        fontFamily: 'Arial Black',
        fontSize: '11px',
        color: '#ff9caf',
      })
      .setOrigin(0.5)
      .setDepth(61);
    const dash = this.add
      .circle(GAME_WIDTH - 285, GAME_HEIGHT - 285, 54, 0x21e6ff, 0.42)
      .setStrokeStyle(3, 0x73ef62, 0.8)
      .setInteractive({ useHandCursor: true })
      .setDepth(61);
    this.add
      .text(dash.x, dash.y, 'DASH', {
        fontFamily: 'Arial Black',
        fontSize: '13px',
        color: '#eaffff',
      })
      .setOrigin(0.5)
      .setDepth(62);
    const profile = loadProfile();
    const autoButton = this.add.rectangle(GAME_WIDTH - 285, GAME_HEIGHT - 365, 108, 42, 0x07111f, 0.82)
      .setStrokeStyle(3, profile.autoFire ? 0x73ef62 : 0x7594a8, 0.9)
      .setInteractive({ useHandCursor: true }).setDepth(61);
    const autoLabel = this.add.text(autoButton.x, autoButton.y, profile.autoFire ? 'AUTO ON' : 'AUTO OFF', {
      fontFamily: 'Arial Black', fontSize: '12px', color: '#eaffff',
    }).setOrigin(0.5).setDepth(62);
    autoButton.on('pointerup', () => {
      this.gameScene.mobileInput.autoFire = !this.gameScene.mobileInput.autoFire;
      updateProfile({ autoFire: this.gameScene.mobileInput.autoFire });
      autoLabel.setText(this.gameScene.mobileInput.autoFire ? 'AUTO ON' : 'AUTO OFF');
      autoButton.setStrokeStyle(3, this.gameScene.mobileInput.autoFire ? 0x73ef62 : 0x7594a8, 0.9);
    });

    let movePointer = -1;
    let aimPointer = -1;
    const updateStick = (
      pointer: Phaser.Input.Pointer,
      center: Phaser.Math.Vector2,
      knob: Phaser.GameObjects.Arc,
      output: Phaser.Math.Vector2,
    ) => {
      output.set(pointer.x - center.x, pointer.y - center.y);
      if (output.length() > 86) output.setLength(86);
      knob.setPosition(center.x + output.x, center.y + output.y);
      output.scale(1 / 86);
    };
    moveBase.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      movePointer = pointer.id;
      updateStick(pointer, moveCenter, moveKnob, this.gameScene.mobileInput.movement);
    });
    aimBase.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      aimPointer = pointer.id;
      this.gameScene.mobileInput.firing = true;
      updateStick(pointer, aimCenter, aimKnob, this.gameScene.mobileInput.aim);
    });
    dash.on('pointerdown', () => {
      this.gameScene.mobileInput.dash = true;
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.id === movePointer)
        updateStick(pointer, moveCenter, moveKnob, this.gameScene.mobileInput.movement);
      if (pointer.id === aimPointer)
        updateStick(pointer, aimCenter, aimKnob, this.gameScene.mobileInput.aim);
    });
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.id === movePointer) {
        movePointer = -1;
        this.gameScene.mobileInput.movement.set(0, 0);
        moveKnob.setPosition(moveCenter.x, moveCenter.y);
      }
      if (pointer.id === aimPointer) {
        aimPointer = -1;
        this.gameScene.mobileInput.firing = false;
        aimKnob.setPosition(aimCenter.x, aimCenter.y);
      }
    });
    const resetSticks = () => {
      movePointer = -1;
      aimPointer = -1;
      this.gameScene.mobileInput.movement.set(0, 0);
      this.gameScene.mobileInput.firing = false;
      moveKnob.setPosition(moveCenter.x, moveCenter.y);
      aimKnob.setPosition(aimCenter.x, aimCenter.y);
    };
    // Browsers emit pointercancel when a gesture is interrupted by rotation, a system
    // gesture, or loss of focus. Treat it like pointerup so mobile input cannot stick.
    this.input.on('pointercancel', resetSticks);
    this.input.on('gameout', resetSticks);
    this.events.once('shutdown', resetSticks);
  }
}
