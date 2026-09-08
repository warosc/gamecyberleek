import Phaser from 'phaser';
import { Events, GAME_HEIGHT, GAME_WIDTH, GameState } from '../config/Constants';
import type { Ability } from '../abilities/AbilityRegistry';
import type { GameScene } from './GameScene';
import type { Equipment } from '../loot/Equipment';
import { loadProfile } from '../systems/ProfileStore';
import { DebugOverlay } from '../ui/DebugOverlay';
import { ModalOverlay } from '../ui/ModalOverlay';
import { MobileControls } from '../ui/MobileControls';
import { RewardChooser } from '../ui/RewardChooser';
import { OnboardingHints } from '../ui/OnboardingHints';
import { StatusHud } from '../ui/StatusHud';
import { BossBanner } from '../ui/BossBanner';
import { AbilityBar } from '../ui/AbilityBar';
import { PauseMenu } from '../ui/PauseMenu';
import { PhaseBanner } from '../ui/PhaseBanner';
import type { RunPhaseCallout } from '../config/RunPacing';
import { MomentumHud } from '../ui/MomentumHud';
import type { MomentumState } from '../systems/CombatMomentum';
import { MinibossBanner } from '../ui/MinibossBanner';

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
  private statusHud!: StatusHud;
  private damageFlash!: Phaser.GameObjects.Rectangle;
  private debug?: Phaser.GameObjects.Text;
  private debugOverlay?: DebugOverlay;
  private modal!: ModalOverlay;
  private mobileControls?: MobileControls;
  private chooser?: RewardChooser;
  private hints?: OnboardingHints;
  private bossBanner!: BossBanner;
  private abilityBar!: AbilityBar;
  private pauseMenu!: PauseMenu;
  private phaseBanner!: PhaseBanner;
  private momentumHud!: MomentumHud;
  private minibossBanner!: MinibossBanner;
  constructor() {
    super('UI');
  }
  create(data: { game: GameScene }) {
    this.gameScene = data.game;
    this.modal = new ModalOverlay(this);
    this.damageFlash = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xff214f, 0)
      .setDepth(90);
    this.statusHud = new StatusHud(
      this,
      this.gameScene.arenaName,
      this.gameScene.player.stats.weaponName,
      () => this.gameScene.togglePause(),
      this.gameScene.mobileInput.active,
    );
    this.bossBanner = new BossBanner(this);
    this.abilityBar = new AbilityBar(
      this,
      this.gameScene.mobileInput.active,
      (id) => this.gameScene.getSpecialCharge(id),
      (id) => this.gameScene.activateSpecial(id),
    );
    this.pauseMenu = new PauseMenu(this, this.gameScene);
    this.phaseBanner = new PhaseBanner(this, this.gameScene.mobileInput.active);
    this.momentumHud = new MomentumHud(this, this.gameScene.mobileInput.active);
    this.minibossBanner = new MinibossBanner(this);
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
    this.hints = new OnboardingHints(this);
    this.hints.create(loadProfile().runs, this.gameScene.mobileInput.active);
    this.gameScene.events.on('weapon-fired', this.onWeaponFired, this);
    this.gameScene.events.on(Events.PLAYER_DASHED, this.onDashed, this);
    this.gameScene.events.on(Events.PLAYER_DAMAGED, this.onHealth, this);
    this.gameScene.events.on(Events.XP_COLLECTED, this.onXp, this);
    this.gameScene.events.on(Events.PLAYER_LEVEL_UP, this.showAbilities, this);
    this.gameScene.events.on(Events.STATE_CHANGED, this.onState, this);
    this.gameScene.events.on(Events.BOSS_SPAWNED, this.onBossSpawned, this);
    this.gameScene.events.on(Events.BOSS_HEALTH, this.onBossHealth, this);
    this.gameScene.events.on(Events.MINIBOSS_SPAWNED, this.onMinibossSpawned, this);
    this.gameScene.events.on(Events.MINIBOSS_HEALTH, this.onMinibossHealth, this);
    this.gameScene.events.on(Events.CHEST_OPENED, this.showChestRewards, this);
    this.gameScene.events.on(Events.LOOT_COLLECTED, this.showLootBanner, this);
    this.gameScene.events.on(Events.EQUIPMENT_CHANGED, this.onEquipmentChanged, this);
    this.gameScene.events.on(Events.RUN_PHASE_CHANGED, this.onRunPhaseChanged, this);
    this.gameScene.events.on(Events.WEAPON_EVOLVED, this.onWeaponEvolved, this);
    this.gameScene.events.on(Events.MOMENTUM_CHANGED, this.onMomentumChanged, this);
    this.events.once('shutdown', () => {
      this.closeModal();
      this.mobileControls?.destroy();
      this.hints?.destroy();
      this.gameScene.events.off('weapon-fired', this.onWeaponFired, this);
      this.gameScene.events.off(Events.PLAYER_DASHED, this.onDashed, this);
      this.gameScene.events.off(Events.PLAYER_DAMAGED, this.onHealth, this);
      this.gameScene.events.off(Events.XP_COLLECTED, this.onXp, this);
      this.gameScene.events.off(Events.PLAYER_LEVEL_UP, this.showAbilities, this);
      this.gameScene.events.off(Events.STATE_CHANGED, this.onState, this);
      this.gameScene.events.off(Events.BOSS_SPAWNED, this.onBossSpawned, this);
      this.gameScene.events.off(Events.BOSS_HEALTH, this.onBossHealth, this);
      this.gameScene.events.off(Events.MINIBOSS_SPAWNED, this.onMinibossSpawned, this);
      this.gameScene.events.off(Events.MINIBOSS_HEALTH, this.onMinibossHealth, this);
      this.gameScene.events.off(Events.CHEST_OPENED, this.showChestRewards, this);
      this.gameScene.events.off(Events.LOOT_COLLECTED, this.showLootBanner, this);
      this.gameScene.events.off(Events.EQUIPMENT_CHANGED, this.onEquipmentChanged, this);
      this.gameScene.events.off(Events.RUN_PHASE_CHANGED, this.onRunPhaseChanged, this);
      this.gameScene.events.off(Events.WEAPON_EVOLVED, this.onWeaponEvolved, this);
      this.gameScene.events.off(Events.MOMENTUM_CHANGED, this.onMomentumChanged, this);
      this.phaseBanner.destroy();
      this.minibossBanner.destroy();
    });
  }
  update(_time: number, delta: number) {
    this.bossBanner.update(delta);
    this.minibossBanner.update(delta);
    const body = this.gameScene.player.body as Phaser.Physics.Arcade.Body | null;
    if (body && body.velocity.lengthSq() > 100) this.hints?.satisfy('move');
    this.hints?.update(delta);
    const dashCharge = this.gameScene.player.getDashCharge();
    this.statusHud.update(delta, this.gameScene.survivalMs, dashCharge);
    this.abilityBar.update();
    this.momentumHud.update(this.gameScene.survivalMs);
    this.debugOverlay?.update(delta);
  }
  private onWeaponFired() {
    // Firing implies aiming, so one shot retires both prompts.
    this.hints?.satisfy('fire');
    this.hints?.satisfy('aim');
  }
  private onDashed() {
    this.hints?.satisfy('dash');
  }
  private onHealth(current: number, max: number) {
    if (current < max && loadProfile().vibration) pulseHaptics(35);
    this.statusHud.setHealth(current, max, this.damageFlash);
  }
  private onXp(xp: number, level: number) {
    this.statusHud.setExperience(xp, level);
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
    this.bossBanner.show();
  }
  private onMinibossSpawned() { this.minibossBanner.show(); }
  private onMinibossHealth(current: number, max: number) { this.minibossBanner.setHealth(current, max); }
  private onBossHealth(current: number, max: number) {
    this.bossBanner.setHealth(current, max);
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
    this.statusHud.setLootSummary(
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
    this.statusHud.setEquipment(weapon, armor);
  }
  private onRunPhaseChanged(phase: RunPhaseCallout) {
    this.phaseBanner.show(phase);
  }
  private onWeaponEvolved(name: string, color: number) {
    const tint = `#${color.toString(16).padStart(6, '0')}`;
    const back = this.add.rectangle(GAME_WIDTH / 2, 260, 620, 118, 0x06101d, 0.97)
      .setStrokeStyle(4, color, 1);
    const kicker = this.add.text(GAME_WIDTH / 2, 232, 'WEAPON EVOLUTION', {
      fontFamily: 'monospace', fontSize: '13px', color: tint, letterSpacing: 4,
    }).setOrigin(0.5);
    const title = this.add.text(GAME_WIDTH / 2, 270, name, {
      fontFamily: 'Arial Black', fontSize: '30px', color: '#ffffff', letterSpacing: 2,
    }).setOrigin(0.5);
    const banner = this.add.container(0, -30, [back, kicker, title]).setDepth(140).setAlpha(0);
    this.tweens.add({
      targets: banner, y: 0, alpha: 1, duration: 240, hold: 1900, yoyo: true,
      onComplete: () => banner.destroy(true),
    });
  }
  private onMomentumChanged(state: MomentumState) {
    this.momentumHud.set(state);
  }
  private onState(state: GameState) {
    if (state === GameState.PAUSED && !this.modal.active) {
      this.modal.replace(this.pauseMenu.build(), 100);
    } else if ((state === GameState.PLAYING || state === GameState.BOSS) && this.modal.active) {
      this.closeModal();
    }
  }
}
