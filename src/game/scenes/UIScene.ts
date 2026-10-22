import Phaser from 'phaser';
import { Events, GAME_HEIGHT, GAME_WIDTH, GameState } from '../config/Constants';
import type { Ability } from '../abilities/AbilityRegistry';
import { SPECIAL_ABILITIES, type SpecialAbilityId } from '../abilities/SpecialAbilities';
import type { GameScene } from './GameScene';
import type { Equipment } from '../loot/Equipment';
import { loadProfile } from '../systems/ProfileStore';
import { reducedMotion } from '../systems/RuntimeSettings';
import { connectedPad } from '../input/GamepadBridge';
import { DebugOverlay } from '../ui/DebugOverlay';
import { ModalOverlay } from '../ui/ModalOverlay';
import { MobileControls } from '../ui/MobileControls';
import { RewardChooser, rewardCardLayout } from '../ui/RewardChooser';
import { OnboardingHints, type HintDevice } from '../ui/OnboardingHints';
import { StatusHud } from '../ui/StatusHud';
import { BossBanner } from '../ui/BossBanner';
import { AbilityBar } from '../ui/AbilityBar';
import { PauseMenu } from '../ui/PauseMenu';
import { PhaseBanner } from '../ui/PhaseBanner';
import type { RunPhaseCallout } from '../config/RunPacing';
import { MomentumHud } from '../ui/MomentumHud';
import type { MomentumState } from '../systems/CombatMomentum';
import { ContractHud } from '../ui/ContractHud';
import { contractDescription, type ContractProgress } from '../systems/ContractSystem';
import { MinibossBanner } from '../ui/MinibossBanner';
import { buildInventoryPanel, buildLootDecision, showLootBanner } from '../ui/LootPanels';
import { LiveBoardHud } from '../ui/LiveBoardHud';
import { hudFont, hudPx, isCompactHud, rightColumn } from '../ui/HudLayout';
import { fitText } from '../ui/SceneWidgets';
import type { LiveEntry } from '../online/LiveRanking';
import { abilityText, t, td } from '../i18n';
import type { BuildSynergy, combatRating } from '../systems/BuildProgression';
import type { SectorObjectiveState } from '../systems/SectorObjectiveSystem';
import { DISPLAY_FONT } from '../config/Fonts';

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

/**
 * On a first run the contract briefing waits until the player has moved and aimed (see
 * OnboardingHints), so it no longer lands on top of the control hints and a phase callout in the
 * first seconds. A player who stands still still gets it after this much live play.
 */
const BRIEFING_FALLBACK_MS = 10000;

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
  private contractHud!: ContractHud;
  private minibossBanner!: MinibossBanner;
  private objectivePanel!: Phaser.GameObjects.Container;
  private objectiveBack!: Phaser.GameObjects.Rectangle;
  private objectiveTitle!: Phaser.GameObjects.Text;
  private objectiveProgress!: Phaser.GameObjects.Text;
  /** Phone-sized display (HudLayout): larger type and the roomier layouts that go with it. */
  private compact = false;
  private briefing?: Phaser.GameObjects.Container;
  private briefingWaitMs = 0;
  /** Last frame's "fully charged" state per power, to spot the first charge and the first use. */
  private readonly powerCharged = new Map<SpecialAbilityId, boolean>();
  constructor() {
    super('UI');
  }
  create(data: { game: GameScene }) {
    this.gameScene = data.game;
    this.compact = isCompactHud(this);
    this.briefing = undefined;
    this.briefingWaitMs = 0;
    this.powerCharged.clear();
    this.modal = new ModalOverlay(this);
    this.damageFlash = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xff214f, 0)
      .setDepth(90);
    this.statusHud = new StatusHud(
      this,
      this.gameScene.arenaName,
      this.gameScene.player.stats.weaponName,
      () => this.gameScene.togglePause(),
      () => this.gameScene.toggleInventory(),
      this.gameScene.mobileInput.active,
    );
    // The weapon tag starts on the weapon actually deployed, not a fixed placeholder.
    this.statusHud.setEquipment(this.gameScene.equippedWeapon, this.gameScene.equippedArmor);
    this.bossBanner = new BossBanner(this, this.gameScene.arenaIndex);
    this.abilityBar = new AbilityBar(
      this,
      this.gameScene.mobileInput.active,
      (id) => this.gameScene.getSpecialCharge(id),
      (id) => this.gameScene.activateSpecial(id),
      (id) => this.gameScene.getSpecialCooldown(id),
    );
    this.pauseMenu = new PauseMenu(this, this.gameScene);
    this.phaseBanner = new PhaseBanner(this, this.gameScene.mobileInput.active);
    this.momentumHud = new MomentumHud(this, this.gameScene.mobileInput.active);
    this.contractHud = new ContractHud(this, this.gameScene.contracts.list, this.gameScene.mobileInput.active);
    // Built now (hidden) and revealed by revealBriefing(): at once for experienced players, after
    // the movement and aim hints on a first run.
    this.briefing = this.buildContractBriefing();
    this.minibossBanner = new MinibossBanner(this);
    // Top-anchored so the panel can grow downward when the brief wraps at phone size.
    const column = rightColumn(this.gameScene.mobileInput.active, this.compact);
    const objectiveWidth = column.objectiveWidth;
    this.objectiveBack = this.add.rectangle(0, 0, objectiveWidth, 70, 0x06101d, 0.9)
      .setOrigin(0.5, 0).setStrokeStyle(2, 0x21e6ff, 0.55);
    this.objectiveTitle = this.add.text(-objectiveWidth / 2 + 17, this.compact ? 9 : 13, t('objective.optional'), {
      fontFamily: DISPLAY_FONT, fontStyle: 'bold', fontSize: hudFont(this, 11), color: '#21e6ff', letterSpacing: 1,
    });
    this.objectiveProgress = this.add.text(-objectiveWidth / 2 + 17, this.compact ? 11 + Math.ceil(this.objectiveTitle.height) : 39, '', {
      fontFamily: 'monospace', fontSize: hudFont(this, 11), color: '#c7d9e2',
      // A brief at 22px is ~600px: on phone-sized displays it wraps instead of shrinking.
      wordWrap: this.compact ? { width: objectiveWidth - 34 } : undefined,
    });
    const objectiveX = column.objectiveLeft ? 16 + objectiveWidth / 2 : GAME_WIDTH - 20 - objectiveWidth / 2;
    this.objectivePanel = this.add.container(objectiveX, column.objectiveTop,
      [this.objectiveBack, this.objectiveTitle, this.objectiveProgress]).setDepth(58).setName('objective-panel');
    this.onObjectiveChanged(this.gameScene.objectiveState);
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
        .setOrigin(1, 0)
        // Dev builds only, and hidden until F3: it sat over the right-hand HUD column.
        .setVisible(false);
    if (this.debug) {
      this.debugOverlay = new DebugOverlay(this.game, this.gameScene, this.debug);
      const toggle = () => this.debug?.setVisible(!this.debug.visible);
      this.input.keyboard?.on('keydown-F3', toggle);
      this.events.once('shutdown', () => this.input.keyboard?.off('keydown-F3', toggle));
    }
    this.hints = new OnboardingHints(this);
    this.hints.create(loadProfile().runs, this.hintDevice());
    if (!this.hints.active) this.revealBriefing();
    this.gameScene.events.on('weapon-fired', this.onWeaponFired, this);
    this.gameScene.events.on(Events.PLAYER_DASHED, this.onDashed, this);
    this.gameScene.events.on(Events.PLAYER_DAMAGED, this.onHealth, this);
    this.gameScene.events.on(Events.XP_COLLECTED, this.onXp, this);
    this.gameScene.events.on(Events.XP_DISCOVERED, this.onXpDiscovered, this);
    this.gameScene.events.on(Events.PLAYER_LEVEL_UP, this.showAbilities, this);
    this.gameScene.events.on(Events.STATE_CHANGED, this.onState, this);
    this.gameScene.events.on(Events.BOSS_SPAWNED, this.onBossSpawned, this);
    this.gameScene.events.on(Events.BOSS_HEALTH, this.onBossHealth, this);
    this.gameScene.events.on(Events.MINIBOSS_SPAWNED, this.onMinibossSpawned, this);
    this.gameScene.events.on(Events.MINIBOSS_HEALTH, this.onMinibossHealth, this);
    this.gameScene.events.on(Events.CHEST_OPENED, this.showChestRewards, this);
    this.gameScene.events.on(Events.LOOT_COLLECTED, this.showLootBanner, this);
    this.gameScene.events.on(Events.LOOT_FOUND, this.showLootDecision, this);
    this.gameScene.events.on(Events.INVENTORY_OPENED, this.showInventory, this);
    this.gameScene.events.on(Events.EQUIPMENT_CHANGED, this.onEquipmentChanged, this);
    this.gameScene.events.on(Events.RUN_PHASE_CHANGED, this.onRunPhaseChanged, this);
    this.gameScene.events.on(Events.WEAPON_EVOLVED, this.onWeaponEvolved, this);
    this.gameScene.events.on(Events.MOMENTUM_CHANGED, this.onMomentumChanged, this);
    this.gameScene.events.on(Events.CONTRACT_COMPLETED, this.onContractCompleted, this);
    this.gameScene.events.on(Events.OBJECTIVE_CHANGED, this.onObjectiveChanged, this);
    this.gameScene.events.on(Events.LIVE_BOARD_CHANGED, this.onLiveBoard, this);
    this.gameScene.events.on('live-board-record', this.onLiveRecord, this);
    // Catch up on anything the game scene sent before this scene was listening.
    if (this.gameScene.liveBoardOpen) {
      if (this.gameScene.liveRecord) this.onLiveRecord(this.gameScene.liveRecord.callsign, this.gameScene.liveRecord.score);
      this.onLiveBoard(this.gameScene.liveSnapshot);
    }
    this.gameScene.events.on(Events.UPGRADE_APPLIED, this.onUpgradeApplied, this);
    this.events.once('shutdown', () => {
      this.closeModal();
      this.mobileControls?.destroy();
      this.hints?.destroy();
      this.contractHud.destroy();
      this.gameScene.events.off('weapon-fired', this.onWeaponFired, this);
      this.gameScene.events.off(Events.PLAYER_DASHED, this.onDashed, this);
      this.gameScene.events.off(Events.PLAYER_DAMAGED, this.onHealth, this);
      this.gameScene.events.off(Events.XP_COLLECTED, this.onXp, this);
      this.gameScene.events.off(Events.XP_DISCOVERED, this.onXpDiscovered, this);
      this.gameScene.events.off(Events.PLAYER_LEVEL_UP, this.showAbilities, this);
      this.gameScene.events.off(Events.STATE_CHANGED, this.onState, this);
      this.gameScene.events.off(Events.BOSS_SPAWNED, this.onBossSpawned, this);
      this.gameScene.events.off(Events.BOSS_HEALTH, this.onBossHealth, this);
      this.gameScene.events.off(Events.MINIBOSS_SPAWNED, this.onMinibossSpawned, this);
      this.gameScene.events.off(Events.MINIBOSS_HEALTH, this.onMinibossHealth, this);
      this.gameScene.events.off(Events.CHEST_OPENED, this.showChestRewards, this);
      this.gameScene.events.off(Events.LOOT_COLLECTED, this.showLootBanner, this);
      this.gameScene.events.off(Events.LOOT_FOUND, this.showLootDecision, this);
      this.gameScene.events.off(Events.INVENTORY_OPENED, this.showInventory, this);
      this.gameScene.events.off(Events.EQUIPMENT_CHANGED, this.onEquipmentChanged, this);
      this.gameScene.events.off(Events.RUN_PHASE_CHANGED, this.onRunPhaseChanged, this);
      this.gameScene.events.off(Events.WEAPON_EVOLVED, this.onWeaponEvolved, this);
      this.gameScene.events.off(Events.MOMENTUM_CHANGED, this.onMomentumChanged, this);
      this.gameScene.events.off(Events.CONTRACT_COMPLETED, this.onContractCompleted, this);
      this.gameScene.events.off(Events.OBJECTIVE_CHANGED, this.onObjectiveChanged, this);
      this.gameScene.events.off(Events.LIVE_BOARD_CHANGED, this.onLiveBoard, this);
      this.gameScene.events.off('live-board-record', this.onLiveRecord, this);
      this.liveBoard?.destroy();
      this.liveBoard = undefined;
      this.gameScene.events.off(Events.UPGRADE_APPLIED, this.onUpgradeApplied, this);
      this.phaseBanner.destroy();
      this.minibossBanner.destroy();
    });
  }
  update(_time: number, delta: number) {
    this.bossBanner.update(delta);
    this.minibossBanner.update(delta);
    const body = this.gameScene.player.body as Phaser.Physics.Arcade.Body | null;
    if (body && body.velocity.lengthSq() > 100) this.hints?.satisfy('move');
    // Hint and briefing timers only run in live play, never behind a modal or the pause menu.
    const live = (this.gameScene.state === GameState.PLAYING || this.gameScene.state === GameState.BOSS) && !this.modal.active;
    this.trackPowers();
    this.hints?.update(delta, live, this.hintDevice());
    if (this.briefing && !this.briefing.visible) {
      if (live) this.briefingWaitMs += delta;
      if (this.hints?.controlsLearned !== false || this.briefingWaitMs >= BRIEFING_FALLBACK_MS) this.revealBriefing();
    }
    const dashCharge = this.gameScene.player.getDashCharge();
    this.statusHud.update(delta, this.gameScene.survivalMs, dashCharge);
    this.abilityBar.update();
    this.momentumHud.update(this.gameScene.survivalMs);
    this.contractHud.update(this.gameScene.contracts.list);
    this.debugOverlay?.update(delta);
  }
  /**
   * Which controls the hints should name. A pad wins while it is the active device; until
   * GameScene exposes `padActive`, a connected pad (browsers only expose one after a button press
   * on the page) stands in for it.
   */
  private hintDevice(): HintDevice {
    const pad = this.gameScene.padActive;
    if (pad ?? Boolean(connectedPad())) return 'pad';
    return this.gameScene.mobileInput.active ? 'touch' : 'keyboard';
  }
  /** The first power to charge queues its hint; the first one spent retires it. */
  private trackPowers() {
    if (!this.hints?.active) return;
    for (const ability of SPECIAL_ABILITIES) {
      const charged = this.gameScene.getSpecialCharge(ability.id) >= 1;
      if (charged) this.hints.powerReady();
      if (this.powerCharged.get(ability.id) && !charged) this.hints.satisfy('special');
      this.powerCharged.set(ability.id, charged);
    }
  }
  private onWeaponFired() {
    // Firing implies aiming, so one shot retires both prompts.
    this.hints?.satisfy('fire');
    this.hints?.satisfy('aim');
  }
  private onDashed() {
    this.hints?.satisfy('dash');
  }
  /** `applied` is only sent for real hits; heals emit the same event without it. */
  private onHealth(current: number, max: number, applied?: number) {
    const hit = (applied ?? 0) > 0;
    if (hit && loadProfile().vibration) pulseHaptics(35);
    this.statusHud.setHealth(current, max, this.damageFlash, hit);
  }
  private onXp(xp: number, level: number) {
    this.statusHud.setExperience(xp, level);
  }
  private onXpDiscovered() {
    // At phone size the plate grows for the 22px brief and rises above the bottom ability bar.
    const width = this.compact ? 760 : 470;
    const centerY = this.compact ? GAME_HEIGHT - 190 : GAME_HEIGHT - 104;
    const plate = this.add.rectangle(GAME_WIDTH / 2, centerY, width, this.compact ? 84 : 62, 0x061323, 0.94)
      .setStrokeStyle(2, 0x73ef62, 0.85);
    const title = fitText(this.add.text(GAME_WIDTH / 2, centerY - (this.compact ? 16 : 12), t('xp.title'), {
      fontFamily: DISPLAY_FONT, fontStyle: 'bold', fontSize: hudFont(this, 16), color: '#73ef62', letterSpacing: 2,
    }).setOrigin(0.5), width - 30, 12);
    const brief = fitText(this.add.text(GAME_WIDTH / 2, centerY + (this.compact ? 18 : 13), t('xp.brief'), {
      fontFamily: 'monospace', fontSize: hudFont(this, 11), color: '#c7d9e2', letterSpacing: 1,
    }).setOrigin(0.5), width - 30, 9);
    // Under reduced motion it fades in place instead of rising.
    const banner = this.add.container(0, reducedMotion() ? 0 : 20, [plate, title, brief]).setDepth(125).setAlpha(0).setName('xp-discovery');
    this.tweens.add({ targets: banner, y: 0, alpha: 1, duration: 220, hold: 2100, yoyo: true,
      onComplete: () => banner.destroy(true) });
  }
  private liveBoard?: LiveBoardHud;
  private liveRecord?: { callsign: string; score: number };
  private onLiveRecord(callsign: string, score: number) {
    this.liveRecord = { callsign, score };
    this.liveBoard?.setRecord(callsign, score);
  }
  private onLiveBoard(entries: LiveEntry[], passedBy?: LiveEntry) {
    if (!this.liveBoard) {
      this.liveBoard = new LiveBoardHud(this, this.gameScene.mobileInput.active);
      if (this.liveRecord) this.liveBoard.setRecord(this.liveRecord.callsign, this.liveRecord.score);
    }
    if (entries.length) this.liveBoard.setEntries(entries);
    if (passedBy) {
      this.liveBoard.flash();
      this.phaseBanner.show({
        title: t('live.overtaken', { callsign: passedBy.callsign }),
        brief: t('live.overtakenBrief', { score: passedBy.score }),
        color: 0xff476f,
      });
    }
  }
  private onObjectiveChanged(state: SectorObjectiveState) {
    const status = state.status === 'complete' ? t('objective.complete') : state.status === 'failed' ? t('objective.expired') : `${state.progress}/${state.target}`;
    const width = this.objectiveBack.width;
    const inner = width - 34;
    this.objectiveTitle.setFontSize(hudPx(this, 11)).setText(td(state.title)).setColor(`#${state.color.toString(16).padStart(6, '0')}`);
    fitText(this.objectiveTitle, inner, 9);
    this.objectiveProgress.setFontSize(hudPx(this, 11))
      .setText(`${status}  ·  ${state.status === 'active' ? td(state.brief) : state.status === 'complete' ? td(state.reward) : t('objective.lost')}`);
    // "0/22  ·  Absorbe 22 fragmentos antes de 01:45" measured 297px at 11px in a 296px slot on
    // desktop, so there it shrinks to fit; at phone size it wraps and the panel grows instead.
    if (this.compact)
      this.objectiveBack.setSize(width, Math.max(70, Math.ceil(this.objectiveProgress.y + this.objectiveProgress.height + 10)));
    else fitText(this.objectiveProgress, inner, 9);
    if (state.status !== 'active') {
      if (!reducedMotion()) this.tweens.add({ targets: this.objectivePanel, scale: 1.08, duration: 120, yoyo: true });
      if (state.status === 'complete') this.phaseBanner.show({
        title: t('objective.done'), brief: td(state.reward), color: state.color,
      });
      // A finished objective has nothing left to track; it used to sit in the corner for the
      // rest of the run. It stays long enough to read the outcome, then gives the arena back.
      this.time.delayedCall(6000, () => {
        if (reducedMotion()) this.objectivePanel.setVisible(false);
        else this.tweens.add({ targets: this.objectivePanel, alpha: 0, duration: 500,
          onComplete: () => this.objectivePanel.setVisible(false) });
      });
    }
  }
  private onUpgradeApplied(name: string, description: string, level: number, rating: ReturnType<typeof combatRating>) {
    const width = this.compact ? 780 : 600;
    const plate = this.add.rectangle(0, 0, width, this.compact ? 108 : 94, 0x061323, 0.96).setStrokeStyle(3, 0x73ef62, 0.9);
    const title = fitText(this.add.text(0, this.compact ? -22 : -20, t('upgrade.level', { name, level }), {
      fontFamily: DISPLAY_FONT, fontStyle: 'bold', fontSize: hudFont(this, 21), color: '#73ef62',
    }).setOrigin(0.5), width - 40, 14);
    const detail = fitText(this.add.text(0, this.compact ? 20 : 16, t('upgrade.rating', { description, dps: rating.dps, critical: rating.critical }), {
      fontFamily: 'monospace', fontSize: hudFont(this, 12), color: '#d8e7ed',
    }).setOrigin(0.5), width - 40, 10);
    const still = reducedMotion();
    const banner = this.add.container(GAME_WIDTH / 2, 205, [plate, title, detail]).setDepth(135).setAlpha(0).setScale(still ? 1 : 0.88);
    this.tweens.add({ targets: banner, alpha: 1, scale: 1, duration: 180, hold: 1200, yoyo: true,
      onComplete: () => banner.destroy(true) });
  }
  /** Also the reroll's redraw: GameScene sends the new hand through the same event. */
  private showAbilities(abilities: Ability[], rerollsLeft = 0) {
    const parts: Phaser.GameObjects.GameObject[] = [
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020711, 0.93),
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, this.modalWidth(), 570, 0x061323, 0.98)
        .setStrokeStyle(2, 0x21e6ff, 0.5),
      this.add
        .text(GAME_WIDTH / 2, 118, t('levelup.title', { level: this.gameScene.xp.level }), {
          fontFamily: DISPLAY_FONT, fontStyle: 'bold',
          fontSize: '42px',
          color: '#73ef62',
        })
        .setOrigin(0.5),
      this.add.text(GAME_WIDTH / 2, 164, t('levelup.subtitle'), {
        fontFamily: DISPLAY_FONT, fontStyle: 'bold', fontSize: hudFont(this, 12), color: '#8ba5b8', letterSpacing: 3,
      }).setOrigin(0.5),
    ];
    // The expanding ring is decoration; under reduced motion the title and cards are enough.
    if (!reducedMotion()) {
      const levelGlow = this.add.circle(GAME_WIDTH / 2, 118, 72, 0x73ef62, 0)
        .setStrokeStyle(3, 0x73ef62, 0.55).setDepth(101);
      parts.unshift(levelGlow);
      this.tweens.add({ targets: levelGlow, scale: 2.4, alpha: 0, duration: 700, ease: 'Cubic.Out' });
    }
    const accents = [0x21e6ff, 0x73ef62, 0xd566ff];
    // A modal can replace another one; the old chooser would keep answering 1/2/3 and ENTER.
    this.chooser?.destroy();
    this.chooser = new RewardChooser(this, (index) => {
      const chosen = abilities[index];
      this.closeModal();
      this.gameScene.selectAbility(chosen.id);
    });
    parts.push(
      ...this.chooser.build(
        abilities.map((ability, index) => {
          const current = this.gameScene.abilityLevels.get(ability.id) ?? 0;
          const text = abilityText(ability);
          return {
            accent: accents[index] ?? 0x21e6ff,
            icon: ability.icon,
            name: text.name,
            effect: text.description,
            footer:
              current + 1 >= ability.maxLevel
                ? t('levelup.max', { level: current + 1 })
                : t('levelup.next', { current, next: current + 1 }),
            pips: { filled: current + 1, total: ability.maxLevel },
          };
        }),
        GAME_WIDTH / 2,
        378,
        {
          label: rerollsLeft > 0 ? t('levelup.reroll') : t('levelup.rerollUsed'),
          key: 'R',
          enabled: rerollsLeft > 0,
          accent: 0xffc857,
          // Between the cards (bottom edge 524, or 543 at phone size) and the hint line.
          y: this.compact ? 574 : 558,
          onActivate: () => this.gameScene.rerollUpgrades(),
        },
      ),
    );
    parts.push(this.add.text(GAME_WIDTH / 2, this.compact ? 622 : 604, this.gameScene.mobileInput.active
      ? t('levelup.tap')
      : t('levelup.keys'), {
      fontFamily: 'monospace', fontSize: hudFont(this, 12), color: '#7594a8', letterSpacing: 2,
    }).setOrigin(0.5));
    this.modal.replace(parts, 100);
  }

  /** Every modal close goes through here so a chooser can never outlive its cards. */
  private closeModal() {
    this.chooser?.destroy();
    this.chooser = undefined;
    this.modal.clear();
  }

  /** The level-up and chest panels wrap their three cards, which are wider at phone size. */
  private modalWidth() {
    const cards = rewardCardLayout(this.compact);
    return Math.max(1040, 2 * cards.spacing + cards.width + 100);
  }

  private onBossSpawned() {
    this.bossBanner.show();
  }
  private onMinibossSpawned(name: string, title: string, color: number) { this.minibossBanner.show(name, title, color); }
  private onMinibossHealth(current: number, max: number) { this.minibossBanner.setHealth(current, max); }
  private onBossHealth(current: number, max: number) {
    this.bossBanner.setHealth(current, max);
  }
  private showChestRewards() {
    const rewards = [
      { id: 'repair' as const, name: t('chest.repair'), effect: t('chest.repairEffect'), icon: '✚', color: 0x73ef62 },
      { id: 'charge' as const, name: t('chest.charge'), effect: t('chest.chargeEffect'), icon: '⚡', color: 0x21e6ff },
      { id: 'module' as const, name: t('chest.module'), effect: t('chest.moduleEffect'), icon: '✦', color: 0xd566ff },
    ];
    const parts: Phaser.GameObjects.GameObject[] = [
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020711, 0.93),
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, this.modalWidth(), 540, 0x061323, 0.98)
        .setStrokeStyle(2, 0x73ef62, 0.5),
      this.add
        .text(GAME_WIDTH / 2, 140, t('chest.title'), {
          fontFamily: DISPLAY_FONT, fontStyle: 'bold',
          fontSize: '42px',
          color: '#73ef62',
        })
        .setOrigin(0.5),
      this.add.text(GAME_WIDTH / 2, 182, t('chest.subtitle'), {
        fontFamily: DISPLAY_FONT, fontStyle: 'bold', fontSize: hudFont(this, 12), color: '#8ba5b8', letterSpacing: 3,
      }).setOrigin(0.5),
    ];
    // A modal can replace another one; the old chooser would keep answering 1/2/3 and ENTER.
    this.chooser?.destroy();
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
          footer: t('chest.claim'),
        })),
        GAME_WIDTH / 2,
        382,
      ),
    );
    parts.push(this.add.text(GAME_WIDTH / 2, 578, this.gameScene.mobileInput.active
      ? t('chest.tap')
      : t('levelup.keys'), {
      fontFamily: 'monospace', fontSize: hudFont(this, 12), color: '#7594a8', letterSpacing: 2,
    }).setOrigin(0.5));
    this.modal.replace(parts, 110);
  }

  private showInventory(
    items: Equipment[],
    activeWeapon: Equipment | undefined,
    synergy: BuildSynergy | undefined,
    rating: ReturnType<typeof combatRating>,
  ) {
    this.chooser?.destroy();
    this.modal.replace(buildInventoryPanel(this, items, activeWeapon, synergy, rating, {
      close: () => this.gameScene.toggleInventory(),
      equip: index => this.gameScene.equipInventoryWeapon(index),
      recycle: index => this.gameScene.recycleInventoryItem(index),
    }), 118);
  }

  private showLootBanner(equipment: Equipment) {
    this.statusHud.setLootSummary(
      equipment.kind === 'weapon'
        ? td(equipment.name)
        : t('hud.armorSummary', {
          weapon: td(this.gameScene.player.stats.weaponName),
          percent: Math.round(this.gameScene.player.stats.damageReduction * 100),
        }),
    );
    showLootBanner(this, equipment);
  }
  private showLootDecision(equipment: Equipment, count: number, full: boolean, activeWeapon?: Equipment) {
    const { parts, chooser } = buildLootDecision(this, equipment, count, full, activeWeapon, install => {
      this.closeModal();
      this.gameScene.resolveLoot(install);
    });
    this.chooser?.destroy();
    this.chooser = chooser;
    this.modal.replace(parts, 115);
  }
  /** Raw (Spanish) names from GameScene; StatusHud translates them, including "no armor". */
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
    const kicker = this.add.text(GAME_WIDTH / 2, 232, t('evolution.title'), {
      fontFamily: 'monospace', fontSize: hudFont(this, 13), color: tint, letterSpacing: 4,
    }).setOrigin(0.5);
    const title = fitText(this.add.text(GAME_WIDTH / 2, 270, td(name), {
      fontFamily: DISPLAY_FONT, fontStyle: 'bold', fontSize: '30px', color: '#ffffff', letterSpacing: 2,
    }).setOrigin(0.5), 580, 18);
    // Under reduced motion it fades in place instead of dropping in.
    const banner = this.add.container(0, reducedMotion() ? 0 : -30, [back, kicker, title]).setDepth(140).setAlpha(0);
    this.tweens.add({
      targets: banner, y: 0, alpha: 1, duration: 240, hold: 1900, yoyo: true,
      onComplete: () => banner.destroy(true),
    });
  }
  private onMomentumChanged(state: MomentumState) {
    this.momentumHud.set(state);
  }
  private onContractCompleted(contract: ContractProgress) {
    this.contractHud.celebrate(contract.kind);
    if (loadProfile().vibration) pulseHaptics(20);
  }
  /**
   * One-off intro banner spelling out what the three rolled contracts actually ask for.
   * The compact HUD only has room for a short title (e.g. "SABOTAJE"), which reads fine once
   * a player already knows the system but not on a first look — this is the one place the
   * full `contractDescription()` text (already written, previously unused anywhere) is shown.
   * Purely decorative: it never pauses gameplay, same as PhaseBanner. Built hidden; see
   * revealBriefing() for when it appears.
   */
  private buildContractBriefing() {
    const contracts = this.gameScene.contracts.list;
    const lines = contracts.map((contract) => `${td(contract.title)} — ${contractDescription(contract)}`);
    // Kept clear of the right-hand HUD column (objective, chain, live board: 350 px wide). At
    // phone size the lines are 22px and wrap, so the banner takes more of the wider canvas.
    const width = this.compact
      ? Math.max(540, Math.min(860, GAME_WIDTH - 2 * 350))
      : Math.min(this.gameScene.mobileInput.active ? 640 : 720, GAME_WIDTH - 2 * 370);
    const title = this.add
      .text(0, 0, t('contracts.assigned'), {
        fontFamily: DISPLAY_FONT, fontStyle: 'bold', fontSize: hudFont(this, 16), color: '#21e6ff', letterSpacing: 3,
      })
      .setOrigin(0.5);
    const rows = lines.map((line) => this.add
      .text(0, 0, line, {
        fontFamily: 'monospace', fontSize: hudFont(this, 13), color: '#c7d9e2', align: 'center',
        wordWrap: { width: width - 32 },
      })
      .setOrigin(0.5, 0));
    // Stacked by measured height: desktop keeps its 28px rhythm, wrapped phone lines take the
    // room they need.
    let cursor = 24 + title.height / 2 + 8;
    const tops = rows.map((row) => {
      const top = cursor;
      cursor += row.height + (this.compact ? 8 : 13);
      return top;
    });
    const height = Math.ceil(cursor + 16);
    title.setY(-height / 2 + 24);
    rows.forEach((row, index) => row.setY(-height / 2 + tops[index]));
    const parts: Phaser.GameObjects.GameObject[] = [
      this.add.rectangle(0, 0, width, height, 0x06101d, 0.95).setStrokeStyle(3, 0x21e6ff, 0.75),
      title,
      ...rows,
    ];
    // Depth 95: above the phase banner (90) so it isn't lost under one at the same instant,
    // below every modal (100+) so a level-up or chest reward still takes priority.
    return this.add
      .container(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, parts)
      .setDepth(95)
      .setAlpha(0)
      .setVisible(false)
      .setName('contract-briefing');
  }
  private revealBriefing() {
    const banner = this.briefing;
    if (!banner || banner.visible) return;
    const still = reducedMotion();
    banner.setVisible(true).setScale(still ? 1 : 0.9);
    this.tweens.add({
      targets: banner, alpha: 1, scale: 1, duration: 260, ease: still ? 'Linear' : 'Back.Out',
      // Wrapped phone lines are more to read, so it holds a second longer there.
      hold: this.compact ? 4400 : 3400, yoyo: true,
      onComplete: () => {
        if (this.briefing === banner) this.briefing = undefined;
        banner.destroy(true);
      },
    });
  }
  private onState(state: GameState) {
    if (state === GameState.PAUSED && !this.modal.active) {
      this.modal.replace(this.pauseMenu.build(), 100);
    } else if ((state === GameState.PLAYING || state === GameState.BOSS) && this.modal.active) {
      this.closeModal();
    }
  }
}
