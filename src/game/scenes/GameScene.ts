import Phaser from 'phaser';
import { ARENA, COLORS, Events, GAMEPLAY, GameState } from '../config/Constants';
import { Player } from '../entities/player/Player';
import { ProjectileManager } from '../entities/projectiles/ProjectileManager';
import { EnemyFactory } from '../entities/enemies/EnemyFactory';
import { Enemy } from '../entities/enemies/Enemy';
import { EnemyType } from '../entities/enemies/EnemyTypes';
import { SpawnSystem } from '../systems/SpawnSystem';
import { ExperienceSystem } from '../systems/ExperienceSystem';
import { chooseAbilities, getAbilityById } from '../abilities/AbilityRegistry';
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
  private pausedByEsc = false;
  private audio!: AudioManager;
  private nextChestAt = GAMEPLAY.chestFirstMs;
  private pendingEquipmentDrop = false;
  private deaths = new EnemyDeathResolver();
  equippedWeapon = 'PULSEGUN-01';
  equippedArmor = 'SIN ARMADURA';
  private effects!: CombatEffects;
  private worldProps!: ExplosiveBarrelSystem;
  private loot!: LootSystem;
  private encounters!: EncounterSystem;
  private runEnd!: RunEndSystem;
  private specialKeys!: Record<SpecialAbilityId, Phaser.Input.Keyboard.Key>;
  private readonly handlePlayerDied = () => this.gameOver(false);
  private readonly handleWeaponFired = (x: number, y: number, angle: number) => {
    this.audio.tone(240, 0.025, 0.015);
    this.effects.muzzle(x, y, angle);
  };
  private readonly handleEscape = () => this.togglePause();
  private specialLastUsed: Record<SpecialAbilityId, number> = {
    nova: -99999,
    shield: -99999,
    overdrive: -99999,
  };
  constructor() {
    super('Game');
  }
  init(data: { arenaIndex?: number }) {
    this.arenaIndex = (data.arenaIndex ?? this.arenaIndex) % ARENA_THEMES.length;
    this.arenaName = ARENA_THEMES[this.arenaIndex].name;
    this.state = GameState.PLAYING;
    this.xp = new ExperienceSystem();
    this.abilityLevels = new Map<string, number>();
    this.survivalMs = 0;
    this.pausedByEsc = false;
    this.specialLastUsed = { nova: -99999, shield: -99999, overdrive: -99999 };
    this.nextChestAt = GAMEPLAY.chestFirstMs;
    this.pendingEquipmentDrop = false;
    this.deaths = new EnemyDeathResolver();
    this.mobileInput.movement.set(0, 0);
    this.mobileInput.aim.set(1, 0);
    this.mobileInput.firing = false;
    this.mobileInput.dash = false;
    this.mobileInput.autoFire = loadProfile().autoFire;
    this.equippedWeapon = 'PULSEGUN-01';
    this.equippedArmor = 'SIN ARMADURA';
  }
  create() {
    this.physics.world.setBounds(0, 0, ARENA.width, ARENA.height);
    new ArenaPresenter(this).draw(ARENA_THEMES[this.arenaIndex]);
    this.player = new Player(this, ARENA.width / 2, ARENA.height / 2);
    this.projectiles = new ProjectileManager(this);
    this.enemyProjectiles = new EnemyProjectileManager(this);
    this.enemies = this.physics.add.group({ runChildUpdate: false });
    this.orbs = this.physics.add.group({
      classType: ExperienceOrb,
      maxSize: GAMEPLAY.maxXpOrbs,
      runChildUpdate: false,
    });
    this.spawn = new SpawnSystem(new EnemyFactory(this), this.enemies);
    this.audio = new AudioManager(this);
    this.effects = new CombatEffects(this);
    this.loot = new LootSystem(this, {
      player: this.player,
      effects: this.effects,
      audio: this.audio,
      level: () => this.xp.level,
      onEquipmentChanged: (weapon, armor) => {
        this.equippedWeapon = weapon;
        this.equippedArmor = armor;
      },
    });
    this.chests = this.loot.chests;
    this.lootDrops = this.loot.drops;
    this.encounters = new EncounterSystem(this, this.enemies, this.player);
    this.runEnd = new RunEndSystem(this, () => this.scene.stop('UI'));
    this.worldProps = new ExplosiveBarrelSystem(this, (x, y, damage, radius) =>
      this.plasmaExplosion(x, y, damage, radius),
    );
    this.worldProps.bindProjectiles(this.projectiles.group);
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
    this.events.on(Events.PLAYER_DIED, this.handlePlayerDied);
    this.events.on('weapon-fired', this.handleWeaponFired);
    this.input.keyboard!.on('keydown-ESC', this.handleEscape);
    if (import.meta.env.VITE_DEBUG_GAME === 'true') {
      keyboard.on('keydown-B', () => this.encounters.spawnBoss());
      keyboard.on('keydown-C', () => this.loot.spawnChest());
    }
    // Remove only the events this scene registers. `this.events` is the scene's system
    // emitter, so a blanket removeAllListeners() also unsubscribes Phaser's own plugins
    // (ArcadePhysics.start among them) and the next run boots with a null physics world.
    // The keyboard plugin clears its own keys and listeners in its shutdown.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Events.PLAYER_DIED, this.handlePlayerDied);
      this.events.off('weapon-fired', this.handleWeaponFired);
      this.input.keyboard?.off('keydown-ESC', this.handleEscape);
    });
    this.scene.launch('UI', { game: this });
    this.events.emit(Events.STATE_CHANGED, this.state);
  }
  update(_time: number, delta: number) {
    if (this.state !== GameState.PLAYING) return;
    this.survivalMs += delta;
    this.encounters.update(this.survivalMs);
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
    this.enemies
      .getChildren()
      .forEach((object) =>
        (object as Enemy).updateBehavior(this.player, this.survivalMs, (x, y, angle, speed, damage) =>
          this.enemyProjectiles.fire(x, y, angle, speed, damage, this.survivalMs),
        ),
      );
    this.orbs.getChildren().forEach((o) => {
      const orb = o as ExperienceOrb;
      if (
        orb.active &&
        Phaser.Math.Distance.Between(orb.x, orb.y, this.player.x, this.player.y) <
          this.player.stats.magnetRadius
      )
        this.physics.moveToObject(orb, this.player, 300);
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
    this.audio.tone(135, 0.035);
    this.effects.impact(p.x, p.y);
    if (e.hit(p.damage)) {
      this.resolveEnemyDeath(e);
    } else {
      this.tweens.add({
        targets: e,
        x: e.x + (e.x - this.player.x) * 0.06,
        y: e.y + (e.y - this.player.y) * 0.06,
        duration: 70,
      });
    }
    if (p.mode === 'plasma' && p.splashRadius > 0) this.plasmaExplosion(e.x, e.y, p.damage * 0.55, p.splashRadius, e);
    if (e.enemyType === EnemyType.BOSS)
      this.events.emit(Events.BOSS_HEALTH, e.health.current, e.health.max);
    this.cameras.main.shake(45, 0.0015);
    this.effects.floatingText(
      e.x,
      e.y - 20,
      `${p.critical ? 'CRIT ' : ''}${p.damage}`,
      p.critical ? '#fff27a' : '#dffcff',
    );
  }
  private enemyContact(object: Phaser.GameObjects.GameObject) {
    const e = object as Enemy;
    if (this.time.now - e.lastContact < 650) return;
    e.lastContact = this.time.now;
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
    this.tweens.add({ targets: orb, scale: 1.35, duration: 350, yoyo: true, repeat: 2 });
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
    const orb = object as ExperienceOrb;
    if (!orb.active) return;
    const amount = orb.value * this.player.stats.xpMultiplier;
    orb.collect();
    this.audio.tone(520, 0.05, 0.018);
    const previousLevel = this.xp.level;
    const gainedLevels = this.xp.add(amount);
    if (gainedLevels > 0) {
      for (let level = previousLevel + 1; level <= this.xp.level; level++)
        if (level % GAMEPLAY.equipmentEveryLevels === 0) this.pendingEquipmentDrop = true;
      this.openLevelUp();
    }
    this.events.emit(Events.XP_COLLECTED, this.xp.xp, this.xp.level);
  }
  private openLevelUp() {
    const options = chooseAbilities(this.abilityLevels);
    if (options.length === 0) {
      this.player.health.heal(20);
      this.events.emit(Events.PLAYER_DAMAGED, this.player.health.current, this.player.health.max);
      return;
    }
    this.state = GameState.LEVEL_UP;
    this.physics.pause();
    this.events.emit(Events.STATE_CHANGED, this.state);
    this.events.emit(Events.PLAYER_LEVEL_UP, options);
  }
  selectAbility(id: string) {
    const ability = getAbilityById(id);
    if (!ability) return;
    const level = (this.abilityLevels.get(id) ?? 0) + 1;
    if (level > ability.maxLevel) return;
    this.abilityLevels.set(id, level);
    ability.apply(this.player.stats, level);
    if (id === 'core') {
      this.player.health.max = this.player.stats.maxHp;
      this.player.health.heal(25);
      this.events.emit(Events.PLAYER_DAMAGED, this.player.health.current, this.player.health.max);
    }
    if (id === 'overdrive') this.player.activateOverdrive(10000 + level * 2000);
    this.audio.tone(760, 0.15, 0.04);
    this.state = GameState.PLAYING;
    this.physics.resume();
    this.events.emit(Events.ABILITY_SELECTED, id);
    this.events.emit(Events.STATE_CHANGED, this.state);
    if (this.pendingEquipmentDrop) {
      this.pendingEquipmentDrop = false;
      this.loot.spawnEquipmentDrop();
    }
  }

  private collectEquipment(object: Phaser.GameObjects.GameObject) {
    this.loot.collectEquipment(object, this.equippedWeapon, this.equippedArmor);
  }
  selectChestReward(id: 'repair' | 'charge' | 'weapon') {
    if (id === 'repair') {
      this.player.health.heal(40);
      this.events.emit(Events.PLAYER_DAMAGED, this.player.health.current, this.player.health.max);
    } else if (id === 'charge') {
      this.specialLastUsed = { nova: -99999, shield: -99999, overdrive: -99999 };
      this.player.activateShield(1800);
    } else this.player.stats.attackDamage += 6;
    this.state = GameState.PLAYING;
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
    if (this.state !== GameState.PLAYING) return;
    const ability = SPECIAL_ABILITIES.find((definition) => definition.id === id)!;
    if (time - this.specialLastUsed[id] < ability.cooldown) return;
    this.specialLastUsed[id] = time;
    if (id === 'nova') this.activateNova();
    else if (id === 'shield') this.player.activateShield(3000);
    else this.player.activateOverdrive(8000);
  }
  private activateNova() {
    const radius = 230;
    const blast = this.add
      .circle(this.player.x, this.player.y, 24, COLORS.cyan, 0.28)
      .setStrokeStyle(5, COLORS.cyan, 0.9)
      .setDepth(20);
    this.tweens.add({
      targets: blast,
      scale: radius / 24,
      alpha: 0,
      duration: 360,
      onComplete: () => blast.destroy(),
    });
    const targets = this.enemies.getChildren().filter((object) => {
      const enemy = object as Enemy;
      return Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y) <= radius;
    }) as Enemy[];
    for (const enemy of targets) {
      const x = enemy.x;
      const y = enemy.y;
      const damage = Math.round(this.player.stats.attackDamage * 1.75);
      if (enemy.hit(damage)) {
        this.resolveEnemyDeath(enemy);
      }
      this.effects.floatingText(x, y - 22, `${damage}`, '#73efff');
    }
    this.audio.tone(95, 0.24, 0.045);
    this.cameras.main.shake(180, 0.006);
  }
  togglePause() {
    if (this.state === GameState.LEVEL_UP || this.state === GameState.GAME_OVER) return;
    this.pausedByEsc = !this.pausedByEsc;
    this.state = this.pausedByEsc ? GameState.PAUSED : GameState.PLAYING;
    if (this.pausedByEsc) this.physics.pause();
    else this.physics.resume();
    this.events.emit(Events.STATE_CHANGED, this.state);
  }
  resumeGame() {
    if (this.state === GameState.PAUSED) this.togglePause();
  }
  returnToMenu() {
    this.physics.resume();
    this.scene.stop('UI');
    this.scene.start('Menu');
  }
  private openChest(object: Phaser.GameObjects.GameObject) {
    if (!this.loot.openChest(object)) return;
    this.state = GameState.LEVEL_UP;
    this.physics.pause();
    this.events.emit(Events.CHEST_OPENED);
    this.events.emit(Events.STATE_CHANGED, this.state);
  }
  private gameOver(victory: boolean) {
    if (this.state === GameState.GAME_OVER) return;
    this.state = GameState.GAME_OVER;
    this.physics.pause();
    this.runEnd.finish({
      time: this.survivalMs,
      level: this.xp.level,
      victory,
      arenaIndex: this.arenaIndex,
    });
  }
  private plasmaExplosion(x: number, y: number, damage: number, radius: number, ignored?: Enemy) {
    this.effects.explosion(x, y, radius);
    this.enemies.getChildren().forEach((object) => {
      const enemy = object as Enemy;
      if (!enemy.active || enemy === ignored || Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) > radius) return;
      if (enemy.hit(Math.round(damage))) {
        this.resolveEnemyDeath(enemy);
      }
    });
    this.audio.tone(65, 0.2, 0.05);
  }
  private resolveEnemyDeath(enemy: Enemy) {
    const defeat = this.deaths.resolve(enemy);
    if (!defeat) return;
    this.events.emit(Events.ENEMY_DIED);
    this.spawnOrb(defeat.x, defeat.y, defeat.xp);
    this.audio.tone(75, 0.09);
    if (defeat.boss) {
      this.events.emit(Events.BOSS_HEALTH, 0, defeat.maxHealth);
      this.time.delayedCall(500, () => this.gameOver(true));
    }
  }
}
