import Phaser from 'phaser';
import { RUN_PHASE_CALLOUTS, runPhase, UPGRADE_MILESTONES } from '../config/RunPacing';
import { currentViewportShape, mobileWorldZoom } from '../config/ViewportLayout';
import { ARENA, COLORS, Events, GAMEPLAY, GameState } from '../config/Constants';
import { Player } from '../entities/player/Player';
import { ProjectileManager } from '../entities/projectiles/ProjectileManager';
import { EnemyFactory } from '../entities/enemies/EnemyFactory';
import { Enemy } from '../entities/enemies/Enemy';
import { EnemyType } from '../entities/enemies/EnemyTypes';
import { SpawnSystem } from '../systems/SpawnSystem';
import { ExperienceSystem } from '../systems/ExperienceSystem';
import { chooseAbilities, getAbilityById, isSignatureAbility, signatureAbilityId } from '../abilities/AbilityRegistry';
import { ExperienceOrb } from '../entities/experience/ExperienceOrb';
import { AudioManager } from '../managers/AudioManager';
import { ARENA_THEMES } from '../config/ArenaDefinitions';
import { SPECIAL_ABILITIES, type SpecialAbilityId } from '../abilities/SpecialAbilities';
import { EnemyProjectileManager } from '../entities/projectiles/EnemyProjectileManager';
import { loadProfile } from '../systems/ProfileStore';
import { EnemyDeathResolver } from '../systems/EnemyDeathResolver';
import { CombatEffects } from '../effects/CombatEffects';
import { ExplosiveBarrelSystem } from '../systems/ExplosiveBarrelSystem';
import { ArenaPresenter } from '../world/ArenaPresenter';
import { LootSystem } from '../systems/LootSystem';
import { EncounterSystem } from '../systems/EncounterSystem';
import { RunEndSystem } from '../systems/RunEndSystem';
import { ImpactPresenter } from '../presentation/ImpactPresenter';
import { RunTelemetry } from '../systems/RunTelemetry';
import { starterWeapon, type StarterWeaponId } from '../weapons/WeaponRegistry';
import { CombatMomentum } from '../systems/CombatMomentum';
import { applyWeaponMastery } from '../weapons/WeaponMastery';
import { SectorHazardSystem } from '../systems/SectorHazardSystem';
import { SectorDeviceSystem, type SectorDeviceActivation } from '../systems/SectorDeviceSystem';
import { BossPhaseDirector } from '../systems/BossPhaseDirector';
import { RunInventory } from '../systems/RunInventory';
import { applyEquipmentModifiers, type Equipment } from '../loot/Equipment';

export class GameScene extends Phaser.Scene {
  readonly mobileInput = {
    active: false,
    movement: new Phaser.Math.Vector2(),
    aim: new Phaser.Math.Vector2(1, 0),
    firing: false,
    dash: false,
    autoFire: false,
  };
  player!: Player;
  projectiles!: ProjectileManager;
  enemies!: Phaser.Physics.Arcade.Group;
  orbs!: Phaser.Physics.Arcade.Group;
  chests!: Phaser.Physics.Arcade.Group;
  lootDrops!: Phaser.Physics.Arcade.Group;
  enemyProjectiles!: EnemyProjectileManager;
  state = GameState.PLAYING;
  xp = new ExperienceSystem();
  abilityLevels = new Map<string, number>();
  survivalMs = 0;
  arenaIndex = 0;
  arenaName = ARENA_THEMES[0].name;
  private spawn!: SpawnSystem;
  private audio!: AudioManager;
  private nextChestAt = GAMEPLAY.chestFirstMs;
  private pendingEquipmentDrop = false;
  private milestoneIndex = 0;
  private lastRunPhaseAt = 0;
  private offeredAbilities: string[] = [];
  private victoryPending = false;
  private deaths = new EnemyDeathResolver();
  private momentum = new CombatMomentum();
  equippedWeapon = 'PULSEGUN-01';
  selectedWeaponId: StarterWeaponId = 'pulse';
  equippedArmor = 'SIN ARMADURA';
  private effects!: CombatEffects;
  private impacts!: ImpactPresenter;
  telemetry = new RunTelemetry();
  private worldProps!: ExplosiveBarrelSystem;
  private loot!: LootSystem;
  private encounters!: EncounterSystem;
  private runEnd!: RunEndSystem;
  private lastBossPhase = 1;
  private xpIntroduced = false;
  private sectorHazards!: SectorHazardSystem;
  private sectorDevices!: SectorDeviceSystem;
  private bossPhases!: BossPhaseDirector;
  inventory = new RunInventory();
  private pendingLoot?: Equipment;
  private specialKeys!: Record<SpecialAbilityId, Phaser.Input.Keyboard.Key>;
  private readonly handlePlayerDied = () => this.gameOver(false);
  private readonly handlePlayerDamaged = (_current: number, _max: number, applied?: number) => {
    if (applied) {
      this.telemetry.tookDamage(applied); this.audio.play('player_hit');
      const reset = this.momentum.break();
      if (reset) this.events.emit(Events.MOMENTUM_CHANGED, reset);
    }
  };
  private readonly handleBossSpawned = () => {
    this.telemetry.bossSpawned();
    this.audio.play('boss_spawn');
    if (this.state === GameState.PLAYING) {
      this.state = GameState.BOSS;
      this.events.emit(Events.STATE_CHANGED, this.state);
    }
  };
  private readonly handleEnemyWarning = (kind: string) => this.audio.play(kind === 'charge' ? 'charge_warning' : 'shot_warning');
  private readonly handleEnemyAttack = (kind: string) =>
    this.audio.play(kind === 'boss' ? 'boss_attack' : kind === 'charge' ? 'enemy_charge' :
      kind === 'shot' || kind === 'miniboss' ? 'enemy_shot' : 'enemy_melee');
  private readonly handlePlayerDashed = () => this.audio.play('dash');
  private readonly handleWeaponFired = (x: number, y: number, angle: number) => {
    this.telemetry.shotFired();
    this.audio.play(this.player.stats.weaponMode === 'plasma' ? 'spore_fire' : this.player.stats.weaponMode === 'arc' ? 'arc_fire' : 'weapon_fire');
    this.effects.muzzle(x, y, angle);
  };
  private readonly handleEscape = (event: KeyboardEvent) => {
    if (!event.repeat) this.togglePause();
  };
  private readonly handleFocusLost = () => {
    if (this.state === GameState.PLAYING || this.state === GameState.BOSS) this.togglePause();
  };
  private readonly syncGameplayPause = () => {
    const paused = this.state === GameState.PAUSED || this.state === GameState.LEVEL_UP || this.state === GameState.INVENTORY;
    this.time.paused = paused;
    if (paused) {
      this.tweens.pauseAll();
      this.input.keyboard?.resetKeys();
      this.mobileInput.movement.set(0, 0);
      this.mobileInput.firing = false;
      this.mobileInput.dash = false;
    } else this.tweens.resumeAll();
  };
  private specialLastUsed: Record<SpecialAbilityId, number> = {
    nova: -99999,
    shield: -99999,
    overdrive: -99999,
  };
  constructor() {
    super('Game');
  }
  init(data: { arenaIndex?: number; weaponId?: StarterWeaponId }) {
    this.arenaIndex = (data.arenaIndex ?? this.arenaIndex) % ARENA_THEMES.length;
    this.arenaName = ARENA_THEMES[this.arenaIndex].name;
    this.selectedWeaponId = data.weaponId ?? 'pulse';
    this.state = GameState.PLAYING;
    this.xp = new ExperienceSystem();
    this.abilityLevels = new Map<string, number>();
    this.survivalMs = 0;
    this.milestoneIndex = 0;
    this.lastRunPhaseAt = 0;
    this.offeredAbilities = [];
    this.specialLastUsed = { nova: -99999, shield: -99999, overdrive: -99999 };
    this.nextChestAt = GAMEPLAY.chestFirstMs;
    this.pendingEquipmentDrop = false;
    this.victoryPending = false;
    this.lastBossPhase = 1;
    this.xpIntroduced = false;
    this.inventory = new RunInventory();
    this.pendingLoot = undefined;
    this.deaths = new EnemyDeathResolver();
    this.momentum = new CombatMomentum();
    this.telemetry = new RunTelemetry();
    this.mobileInput.movement.set(0, 0);
    this.mobileInput.aim.set(1, 0);
    this.mobileInput.firing = false;
    this.mobileInput.dash = false;
    this.mobileInput.autoFire = loadProfile().autoFire;
    this.equippedWeapon = starterWeapon(this.selectedWeaponId).name;
    this.equippedArmor = 'SIN ARMADURA';
  }
  create() {
    this.game.canvas.dataset.scene = 'Game';
    this.time.paused = false;
    this.tweens.resumeAll();
    this.physics.world.setBounds(0, 0, ARENA.width, ARENA.height);
    new ArenaPresenter(this).draw(ARENA_THEMES[this.arenaIndex]);
    this.player = new Player(this, ARENA.width / 2, ARENA.height / 2, this.selectedWeaponId);
    applyWeaponMastery(this.player.stats, this.selectedWeaponId, loadProfile().weaponMastery[this.selectedWeaponId]);
    this.telemetry.equipped(this.player.stats.weaponName);
    this.projectiles = new ProjectileManager(this);
    this.enemyProjectiles = new EnemyProjectileManager(this);
    this.enemies = this.physics.add.group({ runChildUpdate: false });
    this.orbs = this.physics.add.group({
      classType: ExperienceOrb,
      maxSize: GAMEPLAY.maxXpOrbs,
      runChildUpdate: false,
    });
    this.spawn = new SpawnSystem(new EnemyFactory(this), this.enemies, this.arenaIndex);
    this.audio = new AudioManager(this);
    this.effects = new CombatEffects(this);
    this.impacts = new ImpactPresenter(this, this.effects, this.audio);
    this.loot = new LootSystem(this, {
      player: this.player,
      effects: this.effects,
      audio: this.audio,
      level: () => this.xp.level,
    });
    this.chests = this.loot.chests;
    this.lootDrops = this.loot.drops;
    this.encounters = new EncounterSystem(this, this.enemies, this.player, this.arenaIndex);
    this.bossPhases = new BossPhaseDirector(this, this.enemies, this.arenaIndex);
    this.runEnd = new RunEndSystem(this, () => this.scene.stop('UI'));
    this.worldProps = new ExplosiveBarrelSystem(this, (x, y, damage, radius) =>
      this.plasmaExplosion(x, y, damage, radius),
    );
    this.sectorHazards = new SectorHazardSystem(this, this.player, this.arenaIndex);
    this.sectorDevices = new SectorDeviceSystem(this, this.arenaIndex, activation => this.activateSectorDevice(activation));
    this.worldProps.bindProjectiles(this.projectiles.group);
    this.sectorDevices.bindProjectiles(this.projectiles.group);
    this.mobileInput.active =
      navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;
    const keyboard = this.input.keyboard!;
    this.specialKeys = {
      nova: keyboard.addKey('Q'),
      shield: keyboard.addKey('E'),
      overdrive: keyboard.addKey('R'),
    };
    this.cameras.main
      .setBounds(0, 0, ARENA.width, ARENA.height)
      .setZoom(mobileWorldZoom(currentViewportShape().coarsePointer))
      .startFollow(this.player, true, 0.1, 0.1);
    this.physics.add.overlap(this.projectiles.group, this.enemies, (a, b) =>
      this.projectileHit(a as Phaser.GameObjects.GameObject, b as Phaser.GameObjects.GameObject),
    );
    this.physics.add.overlap(this.player, this.enemies, (_, e) =>
      this.enemyContact(e as Phaser.GameObjects.GameObject),
    );
    this.physics.add.overlap(this.player, this.orbs, (_, o) =>
      this.collectOrb(o as Phaser.GameObjects.GameObject),
    );
    this.physics.add.overlap(this.player, this.enemyProjectiles.group, (_, projectile) => {
      const shot = projectile as Phaser.Physics.Arcade.Image;
      if (!shot.active) return;
      this.player.takeDamage(shot.getData('damage') as number);
      shot.disableBody(true, true);
    });
    this.physics.add.overlap(this.player, this.chests, (_, chest) =>
      this.openChest(chest as Phaser.GameObjects.GameObject),
    );
    this.physics.add.overlap(this.player, this.lootDrops, (_, loot) =>
      this.collectEquipment(loot as Phaser.GameObjects.GameObject),
    );
    this.events.on(Events.PLAYER_DAMAGED, this.handlePlayerDamaged);
    this.events.on(Events.PLAYER_DIED, this.handlePlayerDied);
    this.events.on(Events.BOSS_SPAWNED, this.handleBossSpawned);
    this.events.on('weapon-fired', this.handleWeaponFired);
    this.events.on('enemy-warning', this.handleEnemyWarning);
    this.events.on('enemy-attack', this.handleEnemyAttack);
    this.events.on(Events.PLAYER_DASHED, this.handlePlayerDashed);
    this.input.keyboard!.on('keydown-ESC', this.handleEscape);
    this.game.events.on(Phaser.Core.Events.BLUR, this.handleFocusLost);
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.handleFocusLost);
    this.events.on(Events.STATE_CHANGED, this.syncGameplayPause);
    if (import.meta.env.VITE_DEBUG_GAME === 'true') {
      keyboard.on('keydown-B', () => this.encounters.spawnBoss());
      keyboard.on('keydown-C', () => this.loot.spawnChest());
      // Reaching a level-up by playing takes a competent run; inspecting the modal should not.
      keyboard.on('keydown-L', () => this.openLevelUp());
    }
    // Remove only the events this scene registers. `this.events` is the scene's system
    // emitter, so a blanket removeAllListeners() also unsubscribes Phaser's own plugins
    // (ArcadePhysics.start among them) and the next run boots with a null physics world.
    // The keyboard plugin clears its own keys and listeners in its shutdown.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Events.PLAYER_DAMAGED, this.handlePlayerDamaged);
      this.events.off(Events.PLAYER_DIED, this.handlePlayerDied);
      this.events.off(Events.BOSS_SPAWNED, this.handleBossSpawned);
      this.events.off('weapon-fired', this.handleWeaponFired);
      this.events.off('enemy-warning', this.handleEnemyWarning);
      this.events.off('enemy-attack', this.handleEnemyAttack);
      this.events.off(Events.PLAYER_DASHED, this.handlePlayerDashed);
      this.input.keyboard?.off('keydown-ESC', this.handleEscape);
      this.game.events.off(Phaser.Core.Events.BLUR, this.handleFocusLost);
      this.game.events.off(Phaser.Core.Events.HIDDEN, this.handleFocusLost);
      this.events.off(Events.STATE_CHANGED, this.syncGameplayPause);
    });
    this.scene.launch('UI', { game: this });
    this.events.emit(Events.STATE_CHANGED, this.state);
  }
  update(_time: number, delta: number) {
    if (this.victoryPending) return;
    if (this.state !== GameState.PLAYING && this.state !== GameState.BOSS) return;
    this.survivalMs += delta;
    this.encounters.update(this.survivalMs);
    this.sectorHazards.update(this.survivalMs, !this.encounters.hasBossSpawned);
    const expiredMomentum = this.momentum.update(this.survivalMs);
    if (expiredMomentum) this.events.emit(Events.MOMENTUM_CHANGED, expiredMomentum);
    const phase = runPhase(this.survivalMs);
    if (phase.at !== this.lastRunPhaseAt) {
      this.lastRunPhaseAt = phase.at;
      const callout = RUN_PHASE_CALLOUTS[phase.at as keyof typeof RUN_PHASE_CALLOUTS];
      if (callout) {
        this.audio.play('phase_change');
        this.events.emit(Events.RUN_PHASE_CHANGED, callout);
      }
    }
    this.audio.updateMusic(
      this.survivalMs,
      this.encounters.hasBossSpawned ? 'boss' : this.survivalMs >= 135000 ? 'danger' : 'combat',
    );
    const milestone = UPGRADE_MILESTONES[this.milestoneIndex];
    if (milestone !== undefined && this.survivalMs >= milestone && !this.encounters.hasBossSpawned) {
      this.milestoneIndex++;
      this.openLevelUp(true);
      return;
    }
    if (this.survivalMs >= this.nextChestAt && !this.encounters.hasBossSpawned) {
      this.nextChestAt += GAMEPLAY.chestIntervalMs;
      this.loot.spawnChest();
    }
    this.updateSpecialAbilities(this.survivalMs);
    this.player.update(
      this.survivalMs,
      this.input.activePointer,
      (x, y, a) =>
        this.projectiles.fire(x, y, a, this.player.stats, this.survivalMs, this.player.damageMultiplier),
      this.mobileInput,
    );
    this.mobileInput.dash = false;
    this.projectiles.update(this.survivalMs);
    this.enemyProjectiles.update(this.survivalMs);
    if (!this.encounters.hasBossSpawned) this.spawn.update(delta, this.player);
    let attacks = this.enemies.getChildren().filter(object => (object as Enemy).isPreparingAttack).length;
    this.enemies
      .getChildren()
      .forEach((object) => {
        const enemy = object as Enemy;
        if (enemy.enemyType === EnemyType.BOSS && enemy.bossPhase !== this.lastBossPhase) {
          this.lastBossPhase = enemy.bossPhase;
          this.cameras.main.flash(180, 213, 102, 255, false);
          this.cameras.main.shake(220, 0.008);
          this.audio.play('boss_phase');
          this.bossPhases.enter(enemy.bossPhase as 2 | 3, enemy);
        }
        const preparing = enemy.isPreparingAttack;
        enemy.updateBehavior(this.player, this.survivalMs, (x, y, angle, speed, damage) =>
          this.enemyProjectiles.fire(x, y, angle, speed, damage, this.survivalMs),
          attacks < GAMEPLAY.maxConcurrentAttacks,
        );
        if (!preparing && enemy.isPreparingAttack) attacks++;
      });
    this.orbs.getChildren().forEach((o) => {
      const orb = o as ExperienceOrb;
      if (!orb.active) return;
      orb.syncVisual(this.survivalMs);
      const radius = this.player.stats.magnetRadius;
      const distance = Phaser.Math.Distance.Between(orb.x, orb.y, this.player.x, this.player.y);
      if (distance >= radius) return;
      // Accelerate as the orb closes. At a constant speed the pickup felt like the orb was
      // being dragged; ramping it makes the last few pixels snap in, which is the part that
      // actually reads as a reward.
      this.physics.moveToObject(orb, this.player, 200 + (1 - distance / radius) ** 2 * 700);
    });
  }
  private projectileHit(
    projectileObject: Phaser.GameObjects.GameObject,
    enemyObject: Phaser.GameObjects.GameObject,
  ) {
    const p = projectileObject as import('../entities/projectiles/Projectile').Projectile;
    const e = enemyObject as Enemy;
    if (!p.active || !e.active || p.hitTargets.has(e)) return;
    p.hitTargets.add(e);
    if (p.hitsRemaining > 0) p.hitsRemaining--;
    else p.disableBody(true, true);
    const boss = e.enemyType === EnemyType.BOSS;
    this.telemetry.dealtDamage(p.damage);
    const fatal = e.hit(p.damage, p.critical);
    // One tier drives spark, damage number, camera and audio together, so a critical on an
    // elite cannot end up feeling identical to chipping a grunt.
    this.impacts.hit(p.x, p.y, p.damage, {
      critical: p.critical,
      boss,
      elite: e.elite,
      fatal: false,
    });
    if (fatal) {
      this.resolveEnemyDeath(e);
    } else {
      e.knockback(Phaser.Math.Angle.Between(this.player.x, this.player.y, e.x, e.y), p.critical);
    }
    if (p.mode === 'plasma' && p.splashRadius > 0) this.plasmaExplosion(e.x, e.y, p.damage * 0.55, p.splashRadius, e);
    if (p.mode === 'arc' && this.player.stats.chainTargets > 0)
      this.arcChain(e, p.damage * 0.72, this.player.stats.chainTargets, this.player.stats.chainRange, p.hitTargets);
  }
  private arcChain(origin: Enemy, damage: number, jumps: number, range: number, excluded: Set<object>) {
    let source = origin;
    for (let jump = 0; jump < jumps; jump++) {
      const next = this.enemies.getChildren()
        .map(object => object as Enemy)
        .filter(enemy => enemy.active && !excluded.has(enemy) && Phaser.Math.Distance.Between(source.x, source.y, enemy.x, enemy.y) <= range)
        .sort((a, b) => Phaser.Math.Distance.Squared(source.x, source.y, a.x, a.y) - Phaser.Math.Distance.Squared(source.x, source.y, b.x, b.y))[0];
      if (!next) break;
      excluded.add(next);
      const beam = this.add.graphics().setDepth(18).lineStyle(4, 0x73ef62, 0.9)
        .lineBetween(source.x, source.y, next.x, next.y).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: beam, alpha: 0, duration: 120, onComplete: () => beam.destroy() });
      const applied = Math.max(1, Math.round(damage * Math.pow(0.82, jump)));
      this.telemetry.dealtDamage(applied);
      const fatal = next.hit(applied);
      this.impacts.hit(next.x, next.y, applied, { critical: false, boss: next.enemyType === EnemyType.BOSS, elite: next.elite, fatal: false });
      if (fatal) this.resolveEnemyDeath(next);
      source = next;
    }
  }
  private enemyContact(object: Phaser.GameObjects.GameObject) {
    const e = object as Enemy;
    if (!e.active || !e.canContact || this.survivalMs - e.lastContact < 650) return;
    e.lastContact = this.survivalMs;
    this.player.takeDamage(e.contactDamage);
    this.cameras.main.shake(90, 0.004);
  }
  private spawnOrb(x: number, y: number, value: number) {
    // The pool is capped and orbs never expire on their own, so once the arena holds
    // maxXpOrbs uncollected orbs `get()` returns null and the run stops granting XP
    // entirely. Recycling the stalest orb keeps every kill rewarding.
    const orb = (this.orbs.get(x, y) as ExperienceOrb | null) ?? this.stalestOrb();
    if (!orb) return;
    // A recycled orb can still carry the pulse tween from its previous life.
    this.tweens.killTweensOf(orb);
    orb.spawn(x, y, value, this.survivalMs);
    if (!this.xpIntroduced) {
      this.xpIntroduced = true;
      this.events.emit(Events.XP_DISCOVERED);
    }
  }
  private stalestOrb() {
    let stalest: ExperienceOrb | null = null;
    for (const object of this.orbs.getChildren()) {
      const orb = object as ExperienceOrb;
      if (orb.active && (!stalest || orb.spawnedAt < stalest.spawnedAt)) stalest = orb;
    }
    return stalest;
  }
  private collectOrb(object: Phaser.GameObjects.GameObject) {
    if (this.victoryPending) return;
    const orb = object as ExperienceOrb;
    if (!orb.active) return;
    const amount = orb.value * this.player.stats.xpMultiplier;
    const orbX = orb.x;
    const orbY = orb.y;
    orb.collect();
    this.effects.xpPickup(orbX, orbY);
    this.audio.play('xp_collect');
    const previousLevel = this.xp.level;
    const gainedLevels = this.xp.add(amount);
    if (gainedLevels > 0) {
      for (let level = previousLevel + 1; level <= this.xp.level; level++)
        if (level % GAMEPLAY.equipmentEveryLevels === 0) this.pendingEquipmentDrop = true;
      this.openLevelUp();
    }
    this.events.emit(Events.XP_COLLECTED, this.xp.xp, this.xp.level);
  }
  private openLevelUp(milestone = false) {
    if (this.victoryPending) return;
    const options = milestone ? [signatureAbilityId(this.selectedWeaponId), 'fan', 'phase_dash'].map(id => getAbilityById(id)!)
      .filter(ability => (this.abilityLevels.get(ability.id) ?? 0) < ability.maxLevel) : chooseAbilities(this.abilityLevels);
    this.offeredAbilities = options.map(ability => ability.id);
    if (options.length === 0) {
      this.player.health.heal(20);
      this.events.emit(Events.PLAYER_DAMAGED, this.player.health.current, this.player.health.max);
      return;
    }
    this.state = GameState.LEVEL_UP;
    this.physics.pause();
    this.audio.play('level_up');
    this.events.emit(Events.STATE_CHANGED, this.state);
    this.events.emit(Events.PLAYER_LEVEL_UP, options);
  }
  selectAbility(id: string) {
    if (this.state !== GameState.LEVEL_UP || !this.offeredAbilities.includes(id)) return;
    const ability = getAbilityById(id);
    if (!ability) return;
    const level = (this.abilityLevels.get(id) ?? 0) + 1;
    if (level > ability.maxLevel) return;
    this.offeredAbilities = [];
    this.abilityLevels.set(id, level);
    this.telemetry.choseUpgrade(id);
    ability.apply(this.player.stats, level);
    if (isSignatureAbility(id) && level === ability.maxLevel) {
      this.equippedWeapon = this.player.stats.weaponName;
      this.audio.play('weapon_evolve');
      this.events.emit(Events.EQUIPMENT_CHANGED, this.equippedWeapon, this.equippedArmor);
      this.events.emit(Events.WEAPON_EVOLVED, this.equippedWeapon, this.player.stats.projectileColor);
    }
    if (id === 'core') {
      this.player.health.max = this.player.stats.maxHp;
      this.player.health.heal(25);
      this.events.emit(Events.PLAYER_DAMAGED, this.player.health.current, this.player.health.max);
    }
    if (id === 'overdrive') this.player.activateOverdrive(10000 + level * 2000);
    this.state = this.encounters.hasBossSpawned ? GameState.BOSS : GameState.PLAYING;
    this.physics.resume();
    this.events.emit(Events.ABILITY_SELECTED, id);
    this.events.emit(Events.STATE_CHANGED, this.state);
    if (this.pendingEquipmentDrop) {
      this.pendingEquipmentDrop = false;
      this.loot.spawnEquipmentDrop();
    }
  }

  private collectEquipment(object: Phaser.GameObjects.GameObject) {
    const equipment = this.loot.collectEquipment(object);
    if (!equipment) return;
    this.pendingLoot = equipment;
    this.state = GameState.INVENTORY;
    this.physics.pause();
    this.events.emit(Events.STATE_CHANGED, this.state);
    this.events.emit(Events.LOOT_FOUND, equipment, this.inventory.count, this.inventory.full);
  }
  resolveLoot(install: boolean) {
    if (this.state !== GameState.INVENTORY || !this.pendingLoot) return;
    const equipment = this.pendingLoot;
    this.pendingLoot = undefined;
    if (install && this.inventory.install(equipment)) {
      const oldMaxHp = this.player.stats.maxHp;
      applyEquipmentModifiers(this.player.stats, equipment.modifiers);
      if (equipment.kind === 'weapon') this.equippedWeapon = equipment.name;
      else this.equippedArmor = equipment.name;
      this.telemetry.equipped(this.equippedWeapon);
      if (this.player.stats.maxHp > oldMaxHp) {
        const gainedHp = this.player.stats.maxHp - oldMaxHp;
        this.player.health.max = this.player.stats.maxHp;
        this.player.health.heal(gainedHp);
      }
      this.events.emit(Events.LOOT_COLLECTED, equipment);
      this.events.emit(Events.EQUIPMENT_CHANGED, this.equippedWeapon, this.equippedArmor);
    } else {
      this.player.health.heal(12);
      this.effects.floatingText(this.player.x, this.player.y - 55, 'RECICLADO +12 HP', '#73ef62', 15);
    }
    this.events.emit(Events.PLAYER_DAMAGED, this.player.health.current, this.player.health.max);
    this.state = this.encounters.hasBossSpawned ? GameState.BOSS : GameState.PLAYING;
    this.physics.resume();
    this.events.emit(Events.STATE_CHANGED, this.state);
  }
  selectChestReward(id: 'repair' | 'charge' | 'weapon') {
    if (id === 'repair') {
      this.player.health.heal(40);
      this.events.emit(Events.PLAYER_DAMAGED, this.player.health.current, this.player.health.max);
    } else if (id === 'charge') {
      this.specialLastUsed = { nova: -99999, shield: -99999, overdrive: -99999 };
      this.player.activateShield(1800);
    } else this.player.stats.attackDamage += 6;
    this.state = this.encounters.hasBossSpawned ? GameState.BOSS : GameState.PLAYING;
    this.physics.resume();
    this.events.emit(Events.STATE_CHANGED, this.state);
  }
  getSpecialCharge(id: SpecialAbilityId) {
    const definition = SPECIAL_ABILITIES.find((ability) => ability.id === id)!;
    return Phaser.Math.Clamp(
      (this.survivalMs - this.specialLastUsed[id]) / definition.cooldown,
      0,
      1,
    );
  }
  private updateSpecialAbilities(time: number) {
    for (const ability of SPECIAL_ABILITIES) {
      if (Phaser.Input.Keyboard.JustDown(this.specialKeys[ability.id]))
        this.activateSpecial(ability.id, time);
    }
  }
  activateSpecial(id: SpecialAbilityId, time = this.survivalMs) {
    if (this.victoryPending) return;
    if (this.state !== GameState.PLAYING && this.state !== GameState.BOSS) return;
    const ability = SPECIAL_ABILITIES.find((definition) => definition.id === id)!;
    if (time - this.specialLastUsed[id] < ability.cooldown) return;
    this.specialLastUsed[id] = time;
    this.telemetry.usedAbility(id);
    if (id === 'nova') this.activateNova();
    else if (id === 'shield') {
      this.player.activateShield(3000);
      this.audio.play('shield');
    } else {
      this.player.activateOverdrive(8000);
      this.audio.play('overdrive');
    }
  }
  private activateNova() {
    const radius = 230;
    const blast = this.add
      .circle(this.player.x, this.player.y, 24, COLORS.cyan, 0.28)
      .setStrokeStyle(5, COLORS.cyan, 0.9)
      .setDepth(20);
    const core = this.add
      .circle(this.player.x, this.player.y, 10, COLORS.white, 0.75)
      .setStrokeStyle(2, COLORS.cyan, 1)
      .setDepth(21);
    this.tweens.add({
      targets: blast,
      scale: radius / 24,
      alpha: 0,
      duration: 360,
      onComplete: () => blast.destroy(),
    });
    this.tweens.add({
      targets: core,
      scale: 2.8,
      alpha: 0,
      duration: 180,
      ease: 'Quad.Out',
      onComplete: () => core.destroy(),
    });
    this.cameras.main.flash(120, 33, 210, 255, false);
    const targets = this.enemies.getChildren().filter((object) => {
      const enemy = object as Enemy;
      return Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y) <= radius;
    }) as Enemy[];
    for (const enemy of targets) {
      const x = enemy.x;
      const y = enemy.y;
      const damage = Math.round(this.player.stats.attackDamage * 1.75);
      this.telemetry.dealtDamage(damage);
      if (enemy.hit(damage)) {
        this.resolveEnemyDeath(enemy);
      }
      this.effects.floatingText(x, y - 22, `${damage}`, '#73efff');
    }
    this.audio.play('nova');
    this.cameras.main.shake(180, 0.006);
  }
  togglePause() {
    if (this.victoryPending) return;
    if (![GameState.PLAYING, GameState.BOSS, GameState.PAUSED].includes(this.state)) return;
    const paused = this.state !== GameState.PAUSED;
    this.state = paused
      ? GameState.PAUSED
      : this.encounters.hasBossSpawned ? GameState.BOSS : GameState.PLAYING;
    if (paused) this.physics.pause();
    else this.physics.resume();
    this.events.emit(Events.STATE_CHANGED, this.state);
  }

  adjustAudioVolume(delta: number) {
    this.audio.setMasterVolume(this.audio.getMasterVolume() + delta);
    return this.audio.getMasterVolume();
  }
  get audioVolume() { return this.audio.getMasterVolume(); }
  resumeGame() {
    if (this.state === GameState.PAUSED) this.togglePause();
  }
  returnToMenu() {
    this.physics.resume();
    this.scene.stop('UI');
    this.scene.start('Menu');
  }
  private openChest(object: Phaser.GameObjects.GameObject) {
    if (this.victoryPending) return;
    if (!this.loot.openChest(object)) return;
    this.state = GameState.LEVEL_UP;
    this.physics.pause();
    this.events.emit(Events.CHEST_OPENED);
    this.events.emit(Events.STATE_CHANGED, this.state);
  }
  private gameOver(victory: boolean) {
    if (this.victoryPending && !victory) return;
    if (this.state === GameState.GAME_OVER || this.state === GameState.VICTORY) return;
    this.state = victory ? GameState.VICTORY : GameState.GAME_OVER;
    this.telemetry.finish(this.survivalMs, this.xp.level, victory ? 'victory' : 'death');
    this.audio.play(victory ? 'victory' : 'game_over');
    this.physics.pause();
    this.runEnd.finish({
      time: this.survivalMs,
      level: this.xp.level,
      victory,
      arenaIndex: this.arenaIndex,
      weaponId: this.selectedWeaponId,
    });
  }
  private plasmaExplosion(x: number, y: number, damage: number, radius: number, ignored?: Enemy) {
    this.effects.explosion(x, y, radius);
    this.enemies.getChildren().forEach((object) => {
      const enemy = object as Enemy;
      if (!enemy.active || enemy === ignored || Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) > radius) return;
      this.telemetry.dealtDamage(damage);
      if (enemy.hit(Math.round(damage))) {
        this.resolveEnemyDeath(enemy);
      }
    });
    this.audio.tone(65, 0.2, 0.05);
  }
  private activateSectorDevice(activation: SectorDeviceActivation) {
    const { x, y, radius, damage, heal, effect, color, name } = activation;
    this.effects.explosion(x, y, radius);
    this.effects.floatingText(x, y - 70, name, `#${color.toString(16).padStart(6, '0')}`, 16);
    this.enemies.getChildren().forEach(object => {
      const enemy = object as Enemy;
      if (!enemy.active || Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) > radius) return;
      this.telemetry.dealtDamage(damage);
      if (enemy.hit(damage)) this.resolveEnemyDeath(enemy);
    });
    if (heal > 0 && Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) <= radius) {
      this.player.health.heal(heal);
      this.events.emit(Events.PLAYER_DAMAGED, this.player.health.current, this.player.health.max);
    }
    if (effect === 'cryo') this.enemyProjectiles.group.clear(true, true);
    this.audio.tone(effect === 'emp' ? 180 : effect === 'renewal' ? 740 : 320, 0.3, 0.05);
    this.cameras.main.shake(180, 0.006);
  }
  private resolveEnemyDeath(enemy: Enemy) {
    const elite = enemy.elite;
    const eliteColor = enemy.eliteColor;
    const defeat = this.deaths.resolve(enemy);
    if (!defeat) return;
    this.events.emit(Events.ENEMY_DIED);
    this.telemetry.killed();
    const momentum = this.momentum.kill(this.survivalMs);
    if (momentum.tier > 0 && momentum.chain % 3 === 0) this.audio.play('combo_rise');
    this.events.emit(Events.MOMENTUM_CHANGED, momentum);
    if (defeat.boss) this.telemetry.bossKilled();
    this.impacts.death(
      defeat.x,
      defeat.y,
      defeat.boss ? 0xd566ff : eliteColor,
      { critical: false, boss: defeat.boss, elite, fatal: true },
    );
    this.spawnOrb(defeat.x, defeat.y, Math.round(defeat.xp * momentum.xpMultiplier));
    if (defeat.miniboss) {
      this.loot.spawnEquipmentDrop();
      this.events.emit(Events.MINIBOSS_HEALTH, 0, defeat.maxHealth);
      this.events.emit(Events.MINIBOSS_DEFEATED);
      this.audio.tone(1180, 0.32, 0.055);
    }
    if (defeat.boss) {
      // Freeze combat during the death effect. XP must not open a modal and pause the
      // victory timer before the result screen is reached.
      this.victoryPending = true;
      this.physics.pause();
      this.enemyProjectiles.group.clear(true, true);
      this.effects.bossCollapse(defeat.x, defeat.y);
      this.events.emit(Events.BOSS_HEALTH, 0, defeat.maxHealth);
      this.time.delayedCall(900, () => this.gameOver(true));
    }
  }
}
