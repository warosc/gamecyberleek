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
import { ContractHud } from '../ui/ContractHud';
import { contractDescription, type ContractProgress } from '../systems/ContractSystem';
import { MinibossBanner } from '../ui/MinibossBanner';
import { buildInventoryPanel, buildLootDecision, showLootBanner } from '../ui/LootPanels';
import { LiveBoardHud } from '../ui/LiveBoardHud';
import type { LiveEntry } from '../online/LiveRanking';
import { abilityText, t, td } from '../i18n';
import type { BuildSynergy, combatRating } from '../systems/BuildProgression';
import type { SectorObjectiveState } from '../systems/SectorObjectiveSystem';

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
  private contractHud!: ContractHud;
  private minibossBanner!: MinibossBanner;
  private objectivePanel!: Phaser.GameObjects.Container;
  private objectiveTitle!: Phaser.GameObjects.Text;
  private objectiveProgress!: Phaser.GameObjects.Text;
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
      () => this.gameScene.toggleInventory(),
      this.gameScene.mobileInput.active,
    );
    this.bossBanner = new BossBanner(this, this.gameScene.arenaIndex);
    this.abilityBar = new AbilityBar(
      this,
      this.gameScene.mobileInput.active,
      (id) => this.gameScene.getSpecialCharge(id),
      (id) => this.gameScene.activateSpecial(id),
    );
    this.pauseMenu = new PauseMenu(this, this.gameScene);
    this.phaseBanner = new PhaseBanner(this, this.gameScene.mobileInput.active);
    this.momentumHud = new MomentumHud(this, this.gameScene.mobileInput.active);
    this.contractHud = new ContractHud(this, this.gameScene.contracts.list, this.gameScene.mobileInput.active);
    this.showContractBriefing();
    this.minibossBanner = new MinibossBanner(this);
    const objectiveBack = this.add.rectangle(0, 0, 330, 70, 0x06101d, 0.9).setStrokeStyle(2, 0x21e6ff, 0.55);
    this.objectiveTitle = this.add.text(-148, -22, t('objective.optional'), {
      fontFamily: 'Arial Black', fontSize: '11px', color: '#21e6ff', letterSpacing: 1,
    });
    this.objectiveProgress = this.add.text(-148, 4, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#c7d9e2',
    });
    this.objectivePanel = this.add.container(GAME_WIDTH - 185, this.gameScene.mobileInput.active ? 155 : 202,
      [objectiveBack, this.objectiveTitle, this.objectiveProgress]).setDepth(58).setName('objective-panel');
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
        .setOrigin(1, 0);
    if (this.debug) this.debugOverlay = new DebugOverlay(this.game, this.gameScene, this.debug);
    this.hints = new OnboardingHints(this);
    this.hints.create(loadProfile().runs, this.gameScene.mobileInput.active);
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
    this.hints?.update(delta);
    const dashCharge = this.gameScene.player.getDashCharge();
    this.statusHud.update(delta, this.gameScene.survivalMs, dashCharge);
    this.abilityBar.update();
    this.momentumHud.update(this.gameScene.survivalMs);
    this.contractHud.update(this.gameScene.contracts.list);
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
  private onXpDiscovered() {
    const plate = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 104, 470, 62, 0x061323, 0.94)
      .setStrokeStyle(2, 0x73ef62, 0.85);
    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 116, t('xp.title'), {
      fontFamily: 'Arial Black', fontSize: '16px', color: '#73ef62', letterSpacing: 2,
    }).setOrigin(0.5);
    const brief = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 91, t('xp.brief'), {
      fontFamily: 'monospace', fontSize: '11px', color: '#c7d9e2', letterSpacing: 1,
    }).setOrigin(0.5);
    const banner = this.add.container(0, 20, [plate, title, brief]).setDepth(125).setAlpha(0).setName('xp-discovery');
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
    this.objectiveTitle.setText(td(state.title)).setColor(`#${state.color.toString(16).padStart(6, '0')}`);
    this.objectiveProgress.setText(`${status}  ·  ${state.status === 'active' ? td(state.brief) : state.status === 'complete' ? td(state.reward) : t('objective.lost')}`);
    if (state.status !== 'active') {
      this.tweens.add({ targets: this.objectivePanel, scale: 1.08, duration: 120, yoyo: true });
      if (state.status === 'complete') this.phaseBanner.show({
        title: t('objective.done'), brief: td(state.reward), color: state.color,
      });
    }
  }
  private onUpgradeApplied(name: string, description: string, level: number, rating: ReturnType<typeof combatRating>) {
    const plate = this.add.rectangle(0, 0, 600, 94, 0x061323, 0.96).setStrokeStyle(3, 0x73ef62, 0.9);
    const title = this.add.text(0, -20, t('upgrade.level', { name, level }), {
      fontFamily: 'Arial Black', fontSize: '21px', color: '#73ef62',
    }).setOrigin(0.5);
    const detail = this.add.text(0, 16, `${description}  //  DPS ${rating.dps} · CRIT ${rating.critical}%`, {
      fontFamily: 'monospace', fontSize: '12px', color: '#d8e7ed',
    }).setOrigin(0.5);
    const banner = this.add.container(GAME_WIDTH / 2, 205, [plate, title, detail]).setDepth(135).setAlpha(0).setScale(0.88);
    this.tweens.add({ targets: banner, alpha: 1, scale: 1, duration: 180, hold: 1200, yoyo: true,
      onComplete: () => banner.destroy(true) });
  }
  private showAbilities(abilities: Ability[]) {
    const parts: Phaser.GameObjects.GameObject[] = [
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020711, 0.93),
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 1040, 570, 0x061323, 0.98)
        .setStrokeStyle(2, 0x21e6ff, 0.5),
      this.add
        .text(GAME_WIDTH / 2, 118, t('levelup.title', { level: this.gameScene.xp.level }), {
          fontFamily: 'Arial Black',
          fontSize: '42px',
          color: '#73ef62',
        })
        .setOrigin(0.5),
      this.add.text(GAME_WIDTH / 2, 164, t('levelup.subtitle'), {
        fontFamily: 'Arial Black', fontSize: '12px', color: '#8ba5b8', letterSpacing: 3,
      }).setOrigin(0.5),
    ];
    const levelGlow = this.add.circle(GAME_WIDTH / 2, 118, 72, 0x73ef62, 0)
      .setStrokeStyle(3, 0x73ef62, 0.55).setDepth(101);
    parts.unshift(levelGlow);
    this.tweens.add({ targets: levelGlow, scale: 2.4, alpha: 0, duration: 700, ease: 'Cubic.Out' });
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
      ),
    );
    parts.push(this.add.text(GAME_WIDTH / 2, 585, this.gameScene.mobileInput.active
      ? t('levelup.tap')
      : t('levelup.keys'), {
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
  private onMinibossSpawned(name: string, title: string, color: number) { this.minibossBanner.show(name, title, color); }
  private onMinibossHealth(current: number, max: number) { this.minibossBanner.setHealth(current, max); }
  private onBossHealth(current: number, max: number) {
    this.bossBanner.setHealth(current, max);
  }
  private showChestRewards() {
    const rewards = [
      { id: 'repair' as const, name: t('chest.repair'), effect: t('chest.repairEffect'), icon: '✚', color: 0x73ef62 },
      { id: 'charge' as const, name: t('chest.charge'), effect: t('chest.chargeEffect'), icon: '⚡', color: 0x21e6ff },
      { id: 'weapon' as const, name: t('chest.weapon'), effect: t('chest.weaponEffect'), icon: '✦', color: 0xd566ff },
    ];
    const parts: Phaser.GameObjects.GameObject[] = [
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020711, 0.93),
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 1040, 540, 0x061323, 0.98)
        .setStrokeStyle(2, 0x73ef62, 0.5),
      this.add
        .text(GAME_WIDTH / 2, 140, t('chest.title'), {
          fontFamily: 'Arial Black',
          fontSize: '42px',
          color: '#73ef62',
        })
        .setOrigin(0.5),
      this.add.text(GAME_WIDTH / 2, 182, t('chest.subtitle'), {
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
          footer: t('chest.claim'),
        })),
        GAME_WIDTH / 2,
        382,
      ),
    );
    parts.push(this.add.text(GAME_WIDTH / 2, 578, this.gameScene.mobileInput.active
      ? t('chest.tap')
      : t('levelup.keys'), {
      fontFamily: 'monospace', fontSize: '12px', color: '#7594a8', letterSpacing: 2,
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
        ? equipment.name
        : `${this.gameScene.player.stats.weaponName}  ·  ARMOR ${Math.round(this.gameScene.player.stats.damageReduction * 100)}%`,
    );
    showLootBanner(this, equipment);
  }
  private showLootDecision(equipment: Equipment, count: number, full: boolean, activeWeapon?: Equipment) {
    const { parts, chooser } = buildLootDecision(this, equipment, count, full, activeWeapon, install => {
      this.closeModal();
      this.gameScene.resolveLoot(install);
    });
    this.chooser = chooser;
    this.modal.replace(parts, 115);
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
    const kicker = this.add.text(GAME_WIDTH / 2, 232, t('evolution.title'), {
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
  private onContractCompleted(contract: ContractProgress) {
    this.contractHud.celebrate(contract.kind);
    if (loadProfile().vibration) pulseHaptics(20);
  }
  /**
   * One-off intro banner spelling out what the three rolled contracts actually ask for.
   * The compact HUD only has room for a short title (e.g. "SABOTAJE"), which reads fine once
   * a player already knows the system but not on a first look — this is the one place the
   * full `contractDescription()` text (already written, previously unused anywhere) is shown.
   * Purely decorative: it never pauses gameplay, same as PhaseBanner.
   */
  private showContractBriefing() {
    const contracts = this.gameScene.contracts.list;
    const lines = contracts.map((contract) => `${td(contract.title)} — ${contractDescription(contract)}`);
    const width = this.gameScene.mobileInput.active ? 640 : 720;
    const height = 74 + lines.length * 28;
    const parts: Phaser.GameObjects.GameObject[] = [
      this.add.rectangle(0, 0, width, height, 0x06101d, 0.95).setStrokeStyle(3, 0x21e6ff, 0.75),
      this.add
        .text(0, -height / 2 + 24, t('contracts.assigned'), {
          fontFamily: 'Arial Black', fontSize: '16px', color: '#21e6ff', letterSpacing: 3,
        })
        .setOrigin(0.5),
    ];
    lines.forEach((line, index) => {
      parts.push(
        this.add
          .text(0, -height / 2 + 54 + index * 28, line, {
            fontFamily: 'monospace', fontSize: '13px', color: '#c7d9e2',
          })
          .setOrigin(0.5),
      );
    });
    // Depth 95: above the phase banner (90) so it isn't lost under one at the same instant,
    // below every modal (100+) so a level-up or chest reward still takes priority.
    const banner = this.add
      .container(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, parts)
      .setDepth(95)
      .setAlpha(0)
      .setScale(0.9)
      .setName('contract-briefing');
    this.tweens.add({
      targets: banner, alpha: 1, scale: 1, duration: 260, ease: 'Back.Out', hold: 3400, yoyo: true,
      onComplete: () => banner.destroy(true),
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
