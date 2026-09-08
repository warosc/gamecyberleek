import Phaser from 'phaser';
import { HealthComponent } from '../../components/HealthComponent';
import { ELITE_AFFIX_DEFS, ENEMY_DEFS, EnemyType, type EliteAffix } from './EnemyTypes';
import { GAMEPLAY, Events } from '../../config/Constants';
import { detectQualityProfile } from '../../config/QualityProfile';
import { BossVisual, BOSS_IDENTITY } from './BossVisual';
import { VegetableVisual } from './VegetableVisual';
import { isVegetableType, vegetableTexture, VEGETABLE_ROSTER } from './VegetableRoster';
import { MinibossVisual } from './MinibossVisual';

/** Preserves the original feel: 0.075 rad per frame at 60fps. */
const PULSE_RADIANS_PER_MS = 0.075 * 0.06;
export class Enemy extends Phaser.GameObjects.Arc {
  readonly def;
  readonly health;
  lastContact = 0;
  private lastAttack = -9999;
  private melee?: { strike: number; end: number; released: boolean };
  get isPreparingAttack() { return !!this.pendingAttack || !!this.charge || !!this.melee; }
  get canContact() {
    if (this.enemyType === EnemyType.SHOOTER) return false;
    if (this.enemyType === EnemyType.RUNNER) return Boolean(this.charge &&
      this.visualTime >= this.charge.start && this.visualTime < this.charge.end);
    return this.enemyType !== EnemyType.GRUNT && this.enemyType !== EnemyType.TANK ||
      Boolean(this.melee && this.visualTime >= this.melee.strike && this.visualTime < this.melee.strike + 180);
  }
  private charge?: { angle: number; start: number; end: number; recover: number; launched: boolean };
  private warning?: Phaser.GameObjects.Graphics;
  private readonly telegraphs = new Set<Phaser.GameObjects.GameObject>();
  private knockbackUntil = 0;
  private knockbackX = 0;
  private knockbackY = 0;

  /** Bounded impulse; distance from the player never amplifies knockback. */
  knockback(angle: number, critical: boolean) {
    if (this.enemyType === EnemyType.BOSS || this.enemyType === EnemyType.MINIBOSS || this.charge || this.pendingAttack || this.melee) return;
    const speed = (critical ? 170 : 95) * (this.enemyType === EnemyType.TANK ? 0.35 : 1);
    this.knockbackX = Math.cos(angle) * speed;
    this.knockbackY = Math.sin(angle) * speed;
    this.knockbackUntil = this.visualTime + 90;
  }

  private showLane(angle: number, length: number, width: number, color: number) {
    this.warning?.destroy();
    this.warning = this.scene.add.graphics().setPosition(this.x, this.y).setRotation(angle).setDepth(3);
    this.warning.fillStyle(color, 0.13).fillRect(0, -width / 2, length, width)
      .lineStyle(2, color, 0.85).strokeRect(0, -width / 2, length, width)
      .lineBetween(length - 18, -12, length, 0).lineBetween(length, 0, length - 18, 12);
  }
  private bossAttackSequence = 0;
  private wardenAttackSequence = 0;
  /**
   * A shot that has been telegraphed but not yet fired. Scheduled on gameplay time rather than
   * through `scene.time`, so a telegraph cannot resolve while the run is paused or a level-up
   * modal is open.
   */
  private pendingAttack?: { at: number; release: () => void };
  private visual: Phaser.GameObjects.Container;
  private bossVisual?: BossVisual;
  private vegetableVisual?: VegetableVisual;
  private minibossVisual?: MinibossVisual;
  private chassis!: Phaser.GameObjects.Container;
  private shadow!: Phaser.GameObjects.Ellipse;
  private feet: Phaser.GameObjects.Ellipse[] = [];
  private engineGlow?: Phaser.GameObjects.Ellipse;
  private chargeGlow?: Phaser.GameObjects.Arc;
  private crownRotor?: Phaser.GameObjects.Graphics;
  private fins: Phaser.GameObjects.Graphics[] = [];
  private readonly animateDetails = detectQualityProfile().tier !== 'low';
  private visualTime = 0;
  private hitAt = -1000;
  private hitStrength = 0;
  private firedAt = -1000;
  private healthBack: Phaser.GameObjects.Rectangle;
  private healthFill: Phaser.GameObjects.Rectangle;
  private eliteLabel?: Phaser.GameObjects.Text;
  /** Per-enemy offset so the idle pulse of a crowd is desynchronised. */
  private readonly visualOffset = Math.random() * Math.PI * 2;
  private visualPhase = 0;
  elite = false;
  eliteAffix: EliteAffix = 'OVERCHARGED';
  private eliteMultiplier = 1;
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    public enemyType: EnemyType,
    private readonly visualVariant = 0,
  ) {
    const d = ENEMY_DEFS[enemyType];
    super(scene, x, y, d.size, 0, 360, false, d.color);
    this.def = d;
    this.health = new HealthComponent(d.hp);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setVisible(false);
    (this.body as Phaser.Physics.Arcade.Body).setCircle(d.size);
    this.visual = this.createVisual(scene, d.size, d.color);
    this.healthBack = scene.add
      .rectangle(x, y - d.size - 10, d.size * 2, 5, 0x08101b, 0.9)
      .setVisible(false)
      .setDepth(12);
    this.healthFill = scene.add
      .rectangle(x - d.size, y - d.size - 10, d.size * 2, 3, 0x73ef62)
      .setOrigin(0, 0.5)
      .setVisible(false)
      .setDepth(13);
  }
  chase(target: { x: number; y: number }) {
    this.scene.physics.moveToObject(this, target, this.def.speed * this.eliteMultiplier);
    this.syncVisual(target);
  }
  updateBehavior(
    target: { x: number; y: number },
    time: number,
    fire: (x: number, y: number, angle: number, speed: number, damage: number) => void,
    allowAttack = true,
  ) {
    // Derived from gameplay time, not incremented per frame: a fixed step made the pulse
    // run at the display refresh rate, so a 165Hz screen animated ~2.75x faster than 60Hz.
    this.visualPhase = this.visualOffset + time * PULSE_RADIANS_PER_MS;
    this.visualTime = time;
    if (this.pendingAttack && time >= this.pendingAttack.at) {
      const release = this.pendingAttack.release;
      this.pendingAttack = undefined;
      this.firedAt = time;
      this.warning?.destroy();
      this.warning = undefined;
      release();
    }
    const distance = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (this.melee) {
      body.setVelocity(0);
      if (!this.melee.released && time >= this.melee.strike) {
        this.melee.released = true;
        this.scene.events.emit('enemy-attack', 'melee');
      }
      if (time >= this.melee.strike && time < this.melee.strike + 180)
        this.scene.physics.moveToObject(this, target, 240);
      if (time >= this.melee.end) this.melee = undefined;
      this.syncVisual(target);
      return;
    }
    if (allowAttack && (this.enemyType === EnemyType.GRUNT || this.enemyType === EnemyType.TANK) && distance < this.def.size + 55) {
      this.melee = { strike: time + 500, end: time + 1000, released: false };
      body.setVelocity(0);
      this.showAttackTelegraph(0xff476f, this.def.size + 24, 500);
      this.syncVisual(target);
      return;
    }
    if (this.charge) {
      const charge = this.charge;
      if (time < charge.start) body.setVelocity(0);
      else if (time < charge.end) {
        if (!charge.launched) {
          charge.launched = true;
          this.scene.events.emit('enemy-attack', 'charge');
        }
        this.warning?.destroy(); this.warning = undefined;
        body.setVelocity(Math.cos(charge.angle) * 520, Math.sin(charge.angle) * 520);
      } else body.setVelocity(0);
      this.syncVisual({ x: this.x + Math.cos(charge.angle) * 100, y: this.y + Math.sin(charge.angle) * 100 });
      if (time >= charge.recover) this.charge = undefined;
      return;
    }
    if (time < this.knockbackUntil) {
      body.setVelocity(this.knockbackX, this.knockbackY);
      this.syncVisual(target);
      return;
    }
    if (allowAttack && this.enemyType === EnemyType.RUNNER && distance < 430 && time - this.lastAttack > 2300) {
      this.lastAttack = time;
      const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
      this.charge = { angle, start: time + 700, end: time + 1250, recover: time + 1900, launched: false };
      this.showLane(angle, 286, this.def.size * 2 + 14, 0xffc857);
      this.scene.events.emit('enemy-warning', 'charge');
      body.setVelocity(0);
      this.syncVisual(target);
      return;
    }
    if (this.def.behavior === 'kite') {
      if (distance > 390) this.scene.physics.moveToObject(this, target, this.def.speed * this.eliteMultiplier);
      else if (distance < 230)
        this.scene.physics.velocityFromRotation(
          Phaser.Math.Angle.Between(target.x, target.y, this.x, this.y),
          this.def.speed * this.eliteMultiplier,
          (this.body as Phaser.Physics.Arcade.Body).velocity,
        );
      else (this.body as Phaser.Physics.Arcade.Body).setVelocity(0);
      if (this.pendingAttack) { body.setVelocity(0); this.syncVisual(target); return; }
      if (allowAttack && time - this.lastAttack > 1900 && distance < 560) {
        this.lastAttack = time;
        const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
        body.setVelocity(0);
        this.showLane(angle, 560, 18, 0xff7b55);
        this.showAttackTelegraph(0xff9a72, 34, GAMEPLAY.telegraphLeadMs.shooter);
        this.scene.events.emit('enemy-warning', 'shot');
        // Lock the indicated line: stepping away during the warning reliably avoids the shot.
        this.pendingAttack = {
          at: time + GAMEPLAY.telegraphLeadMs.shooter,
          release: () => {
            this.scene.events.emit('enemy-attack', 'shot');
            fire(
              this.x,
              this.y,
              angle,
              280,
              10,
            );
          },
        };
      }
      this.syncVisual(target);
      return;
    }
    if (this.def.behavior === 'warden') {
      if (this.pendingAttack) { body.setVelocity(0); this.syncVisual(target); return; }
      if (distance > 330) this.scene.physics.moveToObject(this, target, this.def.speed);
      else body.setVelocity(0);
      if (allowAttack && time - this.lastAttack > 2100 && distance < 620) {
        this.lastAttack = time;
        body.setVelocity(0);
        const lockedAim = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
        const radial = ++this.wardenAttackSequence % 2 === 0;
        this.showAttackTelegraph(0xff3b76, radial ? 92 : 72, GAMEPLAY.telegraphLeadMs.miniboss,
          radial ? undefined : lockedAim);
        if (!radial) this.showLane(lockedAim, 600, 42, 0xff3b76);
        this.scene.events.emit('enemy-warning', 'miniboss');
        this.pendingAttack = {
          at: time + GAMEPLAY.telegraphLeadMs.miniboss,
          release: () => {
            this.scene.events.emit('enemy-attack', 'miniboss');
            if (radial) {
              for (let index = 0; index < 10; index++)
                fire(this.x, this.y, (Math.PI * 2 * index) / 10, 225, 11);
            } else {
              for (let index = -1; index <= 1; index++)
                fire(this.x, this.y, lockedAim + index * 0.16, 315, 14);
            }
          },
        };
      }
      this.syncVisual(target);
      return;
    }
    if (this.pendingAttack) { body.setVelocity(0); this.syncVisual(target); return; }
    this.chase(target);
    if (this.def.behavior === 'commander' && time - this.lastAttack > this.bossAttackCooldown) {
      this.lastAttack = time;
      body.setVelocity(0);
      const lockedAim = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
      const phase = this.bossPhase;
      this.bossAttackSequence++;
      const radialPhaseTwo = phase === 2 && this.bossAttackSequence % 2 === 0;
      // The two patterns are told apart before they land: the radial burst rings the boss,
      // the spread cone points at where it is about to shoot.
      this.showAttackTelegraph(
        phase === 3 ? 0xff476f : 0xd566ff,
        phase === 3 ? 104 : 86,
        GAMEPLAY.telegraphLeadMs.boss,
        radialPhaseTwo ? undefined : lockedAim,
      );
      this.pendingAttack = {
        at: time + GAMEPLAY.telegraphLeadMs.boss,
        release: () => {
          this.scene.events.emit('enemy-attack', 'boss');
          const base = lockedAim;
          if (radialPhaseTwo) {
            for (let index = 0; index < 8; index++)
              fire(this.x, this.y, (Math.PI * 2 * index) / 8, 240, 13);
          } else {
            const spread = phase === 1 ? 2 : phase === 2 ? 3 : 4;
            for (let index = -spread; index <= spread; index++)
              fire(this.x, this.y, base + index * 0.2, phase === 3 ? 290 : 260, phase === 3 ? 16 : 14);
          }
        },
      };
    }
  }
  hit(amount: number, critical = false) {
    this.health.damage(amount);
    this.healthBack.setVisible(!this.bossVisual);
    this.healthFill
      .setVisible(!this.bossVisual)
      .setDisplaySize(this.def.size * 2 * (this.health.current / this.health.max), 3);
    this.flashHit(critical);
    if (this.enemyType === EnemyType.BOSS)
      this.scene.events.emit(Events.BOSS_HEALTH, this.health.current, this.health.max);
    else if (this.enemyType === EnemyType.MINIBOSS)
      this.scene.events.emit(Events.MINIBOSS_HEALTH, this.health.current, this.health.max);
    return this.health.dead;
  }

  /**
   * Hit reaction on the enemy itself. Without a punch on the body the only sign a shot landed
   * was the damage number, which is easy to lose in a crowd; the scale pop is what makes a hit
   * feel connected. Criticals also get a ring, so they read from across the arena.
   */
  flashHit(critical = false) {
    if (!this.active) return;
    // Evaluated with locomotion instead of fighting a scale tween on the same object.
    this.hitAt = this.visualTime;
    this.hitStrength = critical ? 0.24 : 0.12;
    if (!critical) return;
    const ring = this.scene.add
      .circle(this.x, this.y, this.def.size + 6, 0xfff27a, 0)
      .setStrokeStyle(3, 0xfff27a, 0.9)
      .setDepth(14);
    this.scene.tweens.add({
      targets: ring,
      scale: 1.8,
      alpha: 0,
      duration: 220,
      ease: 'Quad.Out',
      onComplete: () => ring.destroy(),
    });
  }

  /** Affix colour when elite, base colour otherwise. Used so a death burst keeps its identity. */
  get eliteColor() {
    return this.elite ? ELITE_AFFIX_DEFS[this.eliteAffix].color :
      isVegetableType(this.enemyType) ? VEGETABLE_ROSTER[this.enemyType].color : this.def.color;
  }
  makeElite() {
    if (this.enemyType === EnemyType.BOSS || this.enemyType === EnemyType.MINIBOSS || this.elite) return this;
    this.elite = true;
    const affix = ELITE_AFFIX_DEFS[this.eliteAffix];
    this.eliteMultiplier = affix.speedMultiplier;
    this.health.max = Math.round(this.health.max * affix.healthMultiplier);
    this.health.current = this.health.max;
    const crown = this.scene.add.graphics().lineStyle(4, affix.color, 0.9).strokeCircle(0, 0, this.def.size + 13);
    crown.setBlendMode(Phaser.BlendModes.ADD);
    this.visual.addAt(crown, 1);
    this.eliteLabel = this.scene.add.text(this.x, this.y - this.def.size - 24, this.eliteAffix, {
      fontFamily: 'monospace', fontSize: '9px', color: `#${affix.color.toString(16).padStart(6, '0')}`,
      stroke: '#020710', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(15);
    return this;
  }
  get contactDamage() {
    return this.def.damage * (this.elite ? ELITE_AFFIX_DEFS[this.eliteAffix].damageMultiplier : 1);
  }
  get xpReward() {
    return this.def.xp * (this.elite ? 3 : 1);
  }
  get bossPhase() {
    if (this.enemyType !== EnemyType.BOSS) return 1;
    const ratio = this.health.current / this.health.max;
    return ratio <= 0.33 ? 3 : ratio <= 0.66 ? 2 : 1;
  }
  private get bossAttackCooldown() {
    return this.bossPhase === 3 ? 780 : this.bossPhase === 2 ? 1000 : 1300;
  }
  destroy(fromScene?: boolean) {
    this.warning?.destroy();
    for (const telegraph of this.telegraphs) {
      this.scene.tweens.killTweensOf(telegraph);
      telegraph.destroy();
    }
    this.telegraphs.clear();
    this.pendingAttack = undefined;
    this.visual?.destroy();
    this.healthBack?.destroy();
    this.healthFill?.destroy();
    this.eliteLabel?.destroy();
    super.destroy(fromScene);
  }

  private createVisual(scene: Phaser.Scene, size: number, color: number) {
    if (this.enemyType === EnemyType.MINIBOSS) {
      this.minibossVisual = new MinibossVisual(scene, this.visualVariant);
      return scene.add.container(this.x, this.y, [this.minibossVisual]).setDepth(6);
    }
    if (this.enemyType === EnemyType.BOSS && scene.textures.exists(BOSS_IDENTITY.texture)) {
      this.bossVisual = new BossVisual(scene);
      return scene.add.container(this.x, this.y, [this.bossVisual]).setDepth(6);
    }
    if (isVegetableType(this.enemyType) && scene.textures.exists(vegetableTexture(this.enemyType))) {
      this.vegetableVisual = new VegetableVisual(scene, this.enemyType);
      return scene.add.container(this.x, this.y, [this.vegetableVisual]).setDepth(6);
    }
    const shadow = scene.add.ellipse(0, size * 0.45, size * 1.9, size * 0.75, 0x000000, 0.4);
    this.shadow = shadow;
    const body = scene.add.graphics();
    const halo = scene.add.graphics();
    halo.lineStyle(2, color, 0.28).strokeCircle(0, 0, size + 8);

    if (this.enemyType === EnemyType.GRUNT) {
      body
        .fillStyle(0x173a25)
        .fillTriangle(-size, -5, -size - 10, 8, -size + 2, 12)
        .fillTriangle(size, -5, size + 10, 8, size - 2, 12)
        .fillStyle(0x0a1725)
        .fillCircle(0, 0, size + 3)
        .fillStyle(color)
        .fillCircle(0, 0, size - 2)
        .lineStyle(3, 0x9affb2, 0.75)
        .strokeCircle(0, 0, size)
        .fillStyle(0x10243a)
        .fillRoundedRect(-size * 0.72, -7, size * 1.44, 13, 4)
        .fillStyle(0x21e6ff)
        .fillRoundedRect(-size * 0.48, -4, size * 0.96, 5, 2)
        .fillStyle(0xeaffff)
        .fillCircle(0, size * 0.47, 3);
    } else if (this.enemyType === EnemyType.RUNNER) {
      body
        .fillStyle(0xffc857, 0.5)
        .fillTriangle(-size * 0.55, size * 0.7, 0, size + 18, size * 0.55, size * 0.7)
        .fillStyle(0x07111f)
        .fillTriangle(0, -size - 7, -size - 5, size, size + 5, size)
        .fillStyle(color)
        .fillTriangle(0, -size - 3, -size, size - 2, size, size - 2)
        .lineStyle(2, 0xfff2a0, 0.85)
        .strokeTriangle(0, -size - 3, -size, size - 2, size, size - 2)
        .fillStyle(0x0b1a2b)
        .fillCircle(0, 0, size * 0.55)
        .fillStyle(0x21e6ff)
        .fillCircle(0, 0, size * 0.27)
        .fillStyle(0xffffff)
        .fillCircle(0, 0, 2);
    } else if (this.enemyType === EnemyType.SHOOTER) {
      body
        .fillStyle(0x301323)
        .fillRoundedRect(-size - 11, -5, size * 2 + 22, 10, 4)
        .fillStyle(0x0a101c)
        .fillCircle(0, 0, size + 4)
        .lineStyle(3, 0xff9a72, 0.9)
        .strokeCircle(0, 0, size + 2)
        .fillStyle(color)
        .fillCircle(0, 0, size - 3)
        .fillStyle(0x15283a)
        .fillRoundedRect(-size * 0.75, -7, size * 1.5, 14, 5)
        .fillStyle(0xff476f)
        .fillCircle(0, -2, 6)
        .fillStyle(0xffffff)
        .fillCircle(0, -2, 2)
        .fillStyle(0xff9a72)
        .fillTriangle(-8, size - 2, 8, size - 2, 0, size + 11);
    } else {
      const points = Array.from({ length: 8 }, (_, index) => {
        const angle = (Math.PI * 2 * index) / 8 - Math.PI / 8;
        return new Phaser.Math.Vector2(Math.cos(angle) * (size + 4), Math.sin(angle) * (size + 4));
      });
      body
        .fillStyle(0x080d18)
        .fillPoints(points, true)
        .lineStyle(4, 0xbad8ff, 0.65)
        .strokePoints(points, true)
        .fillStyle(color)
        .fillCircle(0, 0, size - 5)
        .fillStyle(0x17243b)
        .fillRoundedRect(-size * 0.8, -8, size * 1.6, 16, 5)
        .fillStyle(0xd566ff)
        .fillRect(-size * 0.52, -3, size * 1.04, 6)
        .fillStyle(0xeaffff)
        .fillCircle(0, size * 0.52, 4);
      for (let index = 0; index < 4; index++) {
        const angle = (Math.PI / 2) * index;
        body.fillStyle(color, 0.65).fillCircle(
          Math.cos(angle) * (size + 8), Math.sin(angle) * (size + 8), 4,
        );
      }
    }

    if (this.enemyType === EnemyType.BOSS) {
      // A broccoli canopy distinguishes the commander from an enlarged tank.
      for (let index = -2; index <= 2; index++) {
        const x = index * size * 0.3;
        const y = -size * (0.67 + (2 - Math.abs(index)) * 0.12);
        body.fillStyle(0x113c30).fillCircle(x, y, size * 0.3)
          .fillStyle(0x49ac63).fillCircle(x, y - 3, size * 0.23)
          .fillStyle(0x9af58a, 0.65).fillCircle(x - 3, y - 8, size * 0.09);
      }
    }
    const attachments: Phaser.GameObjects.GameObject[] = [];
    if (this.enemyType === EnemyType.GRUNT || this.enemyType === EnemyType.SHOOTER) {
      for (const side of [-1, 1]) {
        const fin = scene.add.graphics().setPosition(side * size * 0.8, 0);
        fin.fillStyle(this.enemyType === EnemyType.GRUNT ? 0x2d8055 : 0x51283a)
          .fillTriangle(0, -8, side * 18, -14, side * 12, 14)
          .lineStyle(2, color, 0.85).lineBetween(0, 0, side * 14, -7);
        this.fins.push(fin);
        attachments.push(fin);
      }
    }
    if (this.enemyType === EnemyType.RUNNER) {
      this.engineGlow = scene.add.ellipse(0, size + 8, 10, 25, 0xffc857, 0.8)
        .setBlendMode(Phaser.BlendModes.ADD);
      attachments.push(this.engineGlow);
    } else if (this.enemyType !== EnemyType.SHOOTER) {
      for (const side of [-1, 1]) {
        const foot = scene.add.ellipse(side * size * 0.65, size * 0.7, size * 0.58, size * 0.8, 0x15283a)
          .setStrokeStyle(2, color, 0.75);
        this.feet.push(foot);
        attachments.push(foot);
      }
    }
    if (this.enemyType === EnemyType.SHOOTER || this.enemyType === EnemyType.BOSS) {
      this.chargeGlow = scene.add.circle(0, -size * 0.45, size * 0.35, 0xffb979, 0.15)
        .setStrokeStyle(2, 0xffe5bf, 0.6).setBlendMode(Phaser.BlendModes.ADD);
    }
    this.chassis = scene.add.container(0, 0, [...attachments, halo, body]);
    this.chassis.name = `enemy-chassis-${this.enemyType.toLowerCase()}`;
    if (this.chargeGlow) this.chassis.add(this.chargeGlow);
    if (this.enemyType === EnemyType.BOSS) {
      this.crownRotor = scene.add.graphics();
      this.crownRotor.lineStyle(3, 0xd566ff, 0.8);
      for (let index = 0; index < 4; index++) {
        const a = index * Math.PI / 2;
        this.crownRotor.beginPath().arc(0, 0, size + 18, a, a + 0.7).strokePath();
        this.crownRotor.fillStyle(0xffc857).fillCircle(Math.cos(a) * (size + 18), Math.sin(a) * (size + 18), 4);
      }
      this.chassis.add(this.crownRotor);
    }
    // The shadow stays on the floor while the chassis turns, recoils and hovers.
    return scene.add.container(this.x, this.y, [shadow, this.chassis]).setDepth(6);
  }

  private syncVisual(target: { x: number; y: number }) {
    this.visual.setPosition(this.x, this.y);
    const phase = this.visualPhase;
    const moving = (this.body as Phaser.Physics.Arcade.Body).velocity.lengthSq() > 1;
    const detail = this.animateDetails ? 1 : 0;
    const gait = Math.sin(phase * (this.enemyType === EnemyType.TANK ? 0.75 : 1.8));
    const hit = Math.max(0, 1 - (this.visualTime - this.hitAt) / 160);
    const recoil = Math.max(0, 1 - (this.visualTime - this.firedAt) / 220);
    if (this.vegetableVisual) {
      this.vegetableVisual.updatePose(this.visualTime, this.visualOffset, moving, target.x < this.x,
        !!this.pendingAttack || !!this.charge || !!this.melee, recoil, hit);
      const top = this.y - this.vegetableVisual.artHeight * 0.7 - 5;
      this.healthBack.setPosition(this.x, top);
      this.healthFill.setPosition(this.x - this.def.size, top);
      this.eliteLabel?.setPosition(this.x, top - 13);
      return;
    }
    if (this.bossVisual) {
      this.bossVisual.updatePose(this.visualTime, this.bossPhase, !!this.pendingAttack,
        recoil, hit, moving, target.x < this.x);
      // The global boss panel carries its health; a miniature bar would cut through the face.
      this.healthBack.setVisible(false);
      this.healthFill.setVisible(false);
      return;
    }
    if (this.minibossVisual) {
      this.minibossVisual.updatePose(this.visualTime, moving, !!this.pendingAttack, recoil, hit, target.x < this.x);
      this.healthBack.setVisible(false);
      this.healthFill.setVisible(false);
      return;
    }
    const pulse = 1 + Math.sin(phase) * 0.025 * detail;
    this.chassis.setScale(pulse + hit * this.hitStrength, 2 - pulse - hit * this.hitStrength * 0.45);
    this.chassis.setAlpha(hit > 0.65 ? 0.5 : 1);
    this.chassis.rotation = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y) + Math.PI / 2;
    this.chassis.y = 0;
    if (this.enemyType === EnemyType.GRUNT || this.enemyType === EnemyType.TANK) {
      this.chassis.rotation += gait * 0.075 * detail * Number(moving);
      this.chassis.y = -Math.abs(gait) * 2.5 * detail * Number(moving);
    } else if (this.enemyType === EnemyType.SHOOTER) {
      this.chassis.y = (-4 + Math.sin(phase) * 3) * detail;
    }
    // Recoil is translated backwards along the firing direction in world coordinates.
    this.chassis.x = -Math.sin(this.chassis.rotation) * recoil * 5 * detail;
    this.chassis.y += Math.cos(this.chassis.rotation) * recoil * 5 * detail;
    for (let index = 0; index < this.feet.length; index++) {
      this.feet[index].y = this.def.size * 0.7 + gait * (index ? -1 : 1) * 5 * detail * Number(moving);
    }
    for (let index = 0; index < this.fins.length; index++) {
      this.fins[index].rotation = (index ? -1 : 1) *
        (Math.sin(phase * 1.8) * 0.2 * detail + (this.pendingAttack ? 0.35 : 0));
    }
    this.shadow.setScale(1 - Math.abs(Math.sin(phase)) * 0.08 * detail, 1);
    this.engineGlow?.setScale(1 + Math.sin(phase * 3) * 0.16 * detail,
      moving ? 1.1 + Math.sin(phase * 4) * 0.3 * detail : 0.35);
    this.chargeGlow?.setScale(this.pendingAttack ? 1.6 : 0.65 + recoil)
      .setAlpha(this.pendingAttack ? 0.9 : 0.2 + recoil * 0.6);
    this.crownRotor?.setRotation(this.animateDetails ? this.visualTime * 0.0005 * this.bossPhase : 0);
    this.healthBack.setPosition(this.x, this.y - this.def.size - 10);
    this.healthFill.setPosition(this.x - this.def.size, this.y - this.def.size - 10);
    if (this.eliteLabel) this.eliteLabel.setPosition(this.x, this.y - this.def.size - 24);
  }

  /**
   * Warning drawn before the shot is released. The ring contracts inward over the lead time so
   * its collapse marks the moment of the attack, which is readable at a glance; a ring that
   * expanded and faded gave the player no way to time the release.
   */
  private showAttackTelegraph(color: number, radius: number, leadMs: number, aim?: number) {
    const ring = this.scene.add
      .circle(this.x, this.y, radius, color, 0.08)
      .setStrokeStyle(3, color, 0.95)
      .setScale(1.6)
      .setDepth(14);
    this.telegraphs.add(ring);
    ring.once('destroy', () => this.telegraphs.delete(ring));
    this.scene.tweens.add({
      targets: ring,
      scale: 0.85,
      alpha: { from: 0.35, to: 1 },
      duration: leadMs,
      ease: 'Quad.In',
      onComplete: () => {
        if (!this.scene?.sys?.isActive()) {
          ring.destroy();
          return;
        }
        this.scene.tweens.add({
          targets: ring,
          scale: 1.35,
          alpha: 0,
          duration: 180,
          ease: 'Quad.Out',
          onComplete: () => ring.destroy(),
        });
      },
    });
    if (aim === undefined) return;
    // A cone along the firing line, so a directed volley is distinguishable from a radial one.
    const cone = this.scene.add
      .triangle(this.x, this.y, 0, -radius * 0.42, 0, radius * 0.42, radius * 2.1, 0, color, 0.16)
      .setRotation(aim)
      .setDepth(13);
    this.telegraphs.add(cone);
    cone.once('destroy', () => this.telegraphs.delete(cone));
    this.scene.tweens.add({
      targets: cone,
      alpha: 0.42,
      duration: leadMs,
      ease: 'Quad.In',
      onComplete: () => {
        if (!this.scene?.sys?.isActive()) {
          cone.destroy();
          return;
        }
        this.scene.tweens.add({
          targets: cone,
          alpha: 0,
          duration: 150,
          onComplete: () => cone.destroy(),
        });
      },
    });
  }
}
