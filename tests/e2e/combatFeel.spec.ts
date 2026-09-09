import { test, expect, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { GameScene } from '../../src/game/scenes/GameScene';
import type { Enemy } from '../../src/game/entities/enemies/Enemy';

declare global { interface Window { combatGame: Phaser.Game } }
async function deploy(page: Page) {
  await page.route(url => url.pathname === '/src/main.ts', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('new Phaser.Game(gameConfig);', 'window.combatGame = new Phaser.Game(gameConfig);') });
  });
  await page.goto('/');
  await page.waitForFunction(() => window.combatGame?.scene.isActive('Menu'));
  const b = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(b.x + b.width * 245 / 1280, b.y + b.height * 425 / 720);
  await page.waitForFunction(() => window.combatGame.scene.isActive('Game'));
}

test('charge locks its direction, recovers, and shooter respects its warning', async ({page}) => {
  await deploy(page);
  const result = await page.evaluate(async () => {
    const s = window.combatGame.scene.getScene('Game') as GameScene;
    s.togglePause();
    const path = '/src/game/entities/enemies/Enemy.ts';
    const { Enemy } = await import(path);
    const runner = new Enemy(s, 500, 500, 'RUNNER') as Enemy;
    const target = {x:750,y:500};
    const body = runner.body as Phaser.Physics.Arcade.Body;
    runner.updateBehavior(target, 1000, () => {});
    const windup = body.velocity.length();
    target.y = 800;
    runner.updateBehavior(target, 1699, () => {});
    const stillWaiting = body.velocity.length();
    runner.updateBehavior(target, 1701, () => {});
    const impulse = {x:body.velocity.x, y:body.velocity.y};
    runner.updateBehavior(target, 2251, () => {});
    const recovery = body.velocity.length();
    runner.destroy();
    const shooter = new Enemy(s, 500, 500, 'SHOOTER') as Enemy;
    const shots: number[] = [];
    target.x=800; target.y=500;
    const fire=(_x:number,_y:number,a:number)=>shots.push(a);
    shooter.updateBehavior(target, 1000, fire);
    target.y=800;
    shooter.updateBehavior(target, 1649, fire);
    const before=shots.length;
    shooter.updateBehavior(target, 1651, fire);
    shooter.destroy();
    return {windup,stillWaiting,impulse,recovery,before,shots};
  });
  expect(result.windup).toBe(0); expect(result.stillWaiting).toBe(0);
  expect(result.impulse.x).toBe(520); expect(result.impulse.y).toBe(0);
  expect(result.recovery).toBe(0); expect(result.before).toBe(0); expect(result.shots).toEqual([0]);
});

test('dash commits to input direction and protects only during its window', async ({page}) => {
  await deploy(page);
  const r = await page.evaluate(() => {
    const s = window.combatGame.scene.getScene('Game') as GameScene;
    s.togglePause();
    const v=s.mobileInput; v.active=true; v.dash=true; v.movement.set(1,0);
    s.player.update(10000,s.input.activePointer,()=>{},v);
    s.player.takeDamage(10);
    const during=s.player.health.current;
    v.dash=false; v.movement.set(-1,0);
    s.player.update(10080,s.input.activePointer,()=>{},v);
    const direction=(s.player.body as Phaser.Physics.Arcade.Body).velocity.x;
    s.player.update(10200,s.input.activePointer,()=>{},v);
    s.player.takeDamage(10);
    const after=s.player.health.current;
    s.player.takeDamage(10);
    return {during,direction,after,protectedFromStack:s.player.health.current};
  });
  expect(r.during).toBe(100); expect(r.direction).toBe(600);
  expect(r.after).toBe(90); expect(r.protectedFromStack).toBe(90);
});

test('three milestone choices resume safely and the finale starts once at four minutes', async ({page}) => {
  await deploy(page);
  const r=await page.evaluate(() => {
    const s=window.combatGame.scene.getScene('Game') as GameScene;
    const offered: string[][]=[];
    const callouts: string[]=[];
    s.events.on('player-level-up',(options:{id:string}[])=>offered.push(options.map(o=>o.id)));
    s.events.on('run-phase-changed',(phase:{title:string})=>callouts.push(phase.title));
    for (const t of [60000,120000,180000]) {
      s.survivalMs=t-1; s.update(0,1);
      if (s.state !== 'LEVEL_UP') throw Error('Missing milestone');
      s.selectAbility('pulse_protocol');
      s.selectAbility('fan'); // A double click must not grant a second upgrade.
    }
    s.survivalMs=209999; s.update(0,1);
    s.survivalMs=239999; s.update(0,1); s.update(0,1);
    return {offered, callouts, piercing:s.player.stats.projectilePiercing, protocolLevel:s.abilityLevels.get('pulse_protocol'), weapon:s.player.stats.weaponName, count:s.player.stats.projectileCount,
      bosses:s.enemies.getChildren().filter(e=>(e as Enemy).enemyType==='BOSS').length,state:s.state};
  });
  expect(r.offered).toHaveLength(3);
  expect(r.callouts).toEqual(['DESCARGA DE RED','EMBESTIDA DETECTADA','FUEGO A DISTANCIA','BRECHA ABIERTA','ULTIMA OLEADA']);
  expect(r.offered.every(o=>o.join(',')==='pulse_protocol,fan,phase_dash')).toBe(true);
  expect(r.protocolLevel).toBe(3); expect(r.weapon).toBe('RAIL SPROUT');
  expect(r.piercing).toBe(2); expect(r.count).toBe(1); expect(r.bosses).toBe(1); expect(r.state).toBe('BOSS');
});

test('melee has a warning window and dead enemies remove their attack indicators', async ({page}) => {
  await deploy(page);
  const r=await page.evaluate(async () => {
    const s=window.combatGame.scene.getScene('Game') as GameScene;
    s.togglePause();
    const path='/src/game/entities/enemies/Enemy.ts';
    const {Enemy}=await import(path);
    const e=new Enemy(s,500,500,'GRUNT') as Enemy;
    const before=s.children.length;
    e.updateBehavior({x:550,y:500},1000,()=>{});
    const warning=e.canContact;
    const hasIndicator=s.children.length>before;
    e.updateBehavior({x:550,y:500},1499,()=>{});
    const early=e.canContact;
    e.updateBehavior({x:550,y:500},1501,()=>{});
    const strike=e.canContact;
    e.updateBehavior({x:550,y:500},1681,()=>{});
    const recover=e.canContact;
    e.destroy();
    return {warning,hasIndicator,early,strike,recover,remaining:s.children.length};
  });
  expect(r.warning).toBe(false); expect(r.hasIndicator).toBe(true);
  expect(r.early).toBe(false); expect(r.strike).toBe(true); expect(r.recover).toBe(false);
});

test('crowds cannot prepare more than three attacks at once', async ({page}) => {
  await deploy(page);
  const count=await page.evaluate(async () => {
    const s=window.combatGame.scene.getScene('Game') as GameScene;
    const path='/src/game/entities/enemies/Enemy.ts';
    const {Enemy}=await import(path);
    s.enemies.clear(true,true);
    for(let i=0;i<12;i++) {
      const angle=i*Math.PI/6;
      s.enemies.add(new Enemy(s,s.player.x+Math.cos(angle)*200,s.player.y+Math.sin(angle)*200,'RUNNER'));
    }
    s.update(0,16);
    return s.enemies.getChildren().filter(e=>(e as Enemy).isPreparingAttack).length;
  });
  expect(count).toBe(3);
});

test('the canvas fills phone landscape and mobile zoom enlarges only the world', async ({ page }) => {
  await deploy(page);
  const layout = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')!;
    const rect = canvas.getBoundingClientRect();
    const scene = window.combatGame.scene.getScene('Game') as GameScene;
    const ui = window.combatGame.scene.getScene('UI');
    return {
      coverageX: rect.width / window.innerWidth,
      coverageY: rect.height / window.innerHeight,
      logicalWidth: window.combatGame.scale.gameSize.width,
      touch: scene.mobileInput.active,
      worldZoom: scene.cameras.main.zoom,
      uiZoom: ui.cameras.main.zoom,
      secondaryHudVisible: ['hud-operation-panel', 'hud-arena-name', 'hud-operation-state', 'hud-weapon-slot', 'hud-armor-slot']
        .some(name => (ui.children.getByName(name) as Phaser.GameObjects.Components.Visible | null)?.visible),
      pauseVisible: (ui.children.getByName('hud-pause') as Phaser.GameObjects.Components.Visible | null)?.visible,
    };
  });
  expect(layout.coverageX).toBeGreaterThan(0.995);
  expect(layout.coverageY).toBeGreaterThan(0.995);
  if (layout.touch) {
    expect(layout.logicalWidth).toBeGreaterThanOrEqual(1280);
    expect(layout.worldZoom).toBe(1.35);
    expect(layout.uiZoom).toBe(1);
    expect(layout.secondaryHudVisible).toBe(false);
    expect(layout.pauseVisible).toBe(true);
  } else {
    expect(layout.logicalWidth).toBe(1280);
    expect(layout.worldZoom).toBe(1);
    expect(layout.secondaryHudVisible).toBe(true);
  }
});

test('loadout selection changes combat and Arc Leek chains between nearby enemies', async ({ page }) => {
  await page.route(url => url.pathname === '/src/main.ts', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('new Phaser.Game(gameConfig);', 'window.combatGame = new Phaser.Game(gameConfig);') });
  });
  await page.goto('/');
  await page.waitForFunction(() => window.combatGame?.scene.isActive('Menu'));
  await page.evaluate(() => {
    const menu = window.combatGame.scene.getScene('Menu');
    menu.children.getByName('weapon-arc')?.emit('pointerup');
    menu.scene.start('Game', { weaponId: 'arc' });
  });
  await page.waitForFunction(() => window.combatGame.scene.isActive('Game'));
  const result = await page.evaluate(async () => {
    const scene = window.combatGame.scene.getScene('Game') as GameScene;
    scene.togglePause();
    scene.enemies.clear(true, true);
    const enemyModulePath = '/src/game/entities/enemies/Enemy.ts';
    const { Enemy } = await import(enemyModulePath);
    const targets = [0, 1, 2].map(index => {
      const enemy = new Enemy(scene, 620 + index * 90, 500, 'GRUNT') as Enemy;
      scene.enemies.add(enemy);
      return enemy;
    });
    scene.projectiles.fire(570, 500, 0, scene.player.stats, 1000);
    const projectile = scene.projectiles.group.getChildren().find(item => item.active)!;
    (scene as unknown as { projectileHit: (p: Phaser.GameObjects.GameObject, e: Phaser.GameObjects.GameObject) => void })
      .projectileHit(projectile, targets[0]);
    return {
      name: scene.player.stats.weaponName,
      mode: scene.player.stats.weaponMode,
      chainTargets: scene.player.stats.chainTargets,
      health: targets.map(target => target.health.current),
    };
  });
  expect(result.name).toBe('ARC LEEK');
  expect(result.mode).toBe('arc');
  expect(result.chainTargets).toBe(2);
  expect(result.health[0]).toBeLessThan(50);
  expect(result.health[1]).toBeLessThan(50);
  expect(result.health[2]).toBeLessThan(50);
});

test('three rapid eliminations activate momentum and increase XP', async ({ page }) => {
  await deploy(page);
  const result = await page.evaluate(async () => {
    const scene = window.combatGame.scene.getScene('Game') as GameScene;
    scene.togglePause();
    scene.orbs.clear(true, true);
    const enemyModulePath = '/src/game/entities/enemies/Enemy.ts';
    const { Enemy } = await import(enemyModulePath);
    for (let index = 0; index < 3; index++) {
      const enemy = new Enemy(scene, 600 + index * 70, 500, 'GRUNT') as Enemy;
      scene.survivalMs = 1000 + index * 300;
      (scene as unknown as { resolveEnemyDeath: (enemy: Enemy) => void }).resolveEnemyDeath(enemy);
    }
    const values = scene.orbs.getChildren().map(orb => (orb as unknown as { value: number }).value);
    const ui = window.combatGame.scene.getScene('UI');
    const firstOrb = scene.orbs.getChildren()[0] as unknown as { visual: Phaser.GameObjects.Container };
    const xpExplained = Boolean(ui.children.getByName('xp-discovery'));
    return { values, shardParts: firstOrb.visual.list.length, shardVisible: firstOrb.visual.visible, xpExplained,
      momentumVisible: (ui.children.getByName('momentum-hud') as unknown as { visible?: boolean })?.visible };
  });
  expect(result.values).toHaveLength(3);
  expect(result.values[2]).toBeGreaterThan(result.values[0]);
  expect(result.shardParts).toBe(3);
  expect(result.shardVisible).toBe(true);
  expect(result.xpExplained).toBe(true);
  expect(result.momentumVisible).toBe(true);
});

test('mid-run miniboss spawns once, keeps the run active and guarantees equipment', async ({ page }) => {
  await deploy(page);
  const result = await page.evaluate(() => {
    const scene = window.combatGame.scene.getScene('Game') as GameScene;
    const internal = scene as unknown as {
      encounters: { spawnMiniboss: () => boolean };
      resolveEnemyDeath: (enemy: Enemy) => void;
    };
    internal.encounters.spawnMiniboss();
    internal.encounters.spawnMiniboss();
    const minibosses = scene.enemies.getChildren().filter(object => (object as Enemy).enemyType === 'MINIBOSS') as Enemy[];
    const stateAtSpawn = scene.state;
    internal.resolveEnemyDeath(minibosses[0]);
    return { count: minibosses.length, stateAtSpawn, drops: scene.lootDrops.getChildren().length };
  });
  expect(result).toEqual({ count: 1, stateAtSpawn: 'PLAYING', drops: 1 });
});

test('sector objective grants its advertised combat reward only once', async ({ page }) => {
  await deploy(page);
  const result = await page.evaluate(() => {
    const scene = window.combatGame.scene.getScene('Game') as GameScene;
    const internal = scene as unknown as { objective: { record: (metric: 'kills') => boolean } };
    const damageBefore = scene.player.stats.attackDamage;
    for (let kill = 0; kill < 18; kill++) internal.objective.record('kills');
    const damageAfter = scene.player.stats.attackDamage;
    internal.objective.record('kills');
    const ui = window.combatGame.scene.getScene('UI');
    const panel = ui.children.getByName('objective-panel') as Phaser.GameObjects.Container;
    const copy = panel.list.filter(item => item.type === 'Text').map(item => (item as Phaser.GameObjects.Text).text);
    return { damageBefore, damageAfter, status: scene.objectiveState.status, copy };
  });
  expect(result.damageAfter - result.damageBefore).toBe(6);
  expect(result.status).toBe('complete');
  expect(result.copy.join(' ')).toContain('COMPLETADO');
});

test('results screen explains performance, build and permanent rewards', async ({ page }) => {
  await deploy(page);
  await page.evaluate(() => {
    const game = window.combatGame;
    game.scene.stop('UI');
    game.scene.start('GameOver', {
      time: 93_000, level: 6, victory: true, arenaIndex: 0, weaponId: 'pulse',
      equipment: ['GUANTE CRIO', 'NÚCLEO ESPORA'], synergy: 'CIRCUITO VERDE',
      masteryEarned: 11, creditsEarned: 130, newUnlocks: ['sector-2'],
      summary: {
        startedAt: '', durationMs: 93_000, level: 6, kills: 42, damageDealt: 1337,
        damageTaken: 64, shotsFired: 100, hits: 73, abilityUses: { nova: 2, shield: 1, overdrive: 0 },
        upgrades: ['power', 'rapid', 'fan'], weapon: 'PULSEGUN-01', bossReached: true,
        bossDefeated: true, outcome: 'victory', restarted: false,
      },
    });
  });
  await page.waitForFunction(() => window.combatGame.scene.isActive('GameOver'));
  const result = await page.evaluate(() => {
    const scene = window.combatGame.scene.getScene('GameOver');
    const text = (name: string) => (scene.children.getByName(name) as Phaser.GameObjects.Text)?.text;
    return {
      kills: text('results-kills'), damage: text('results-damage'), accuracy: text('results-accuracy'),
      build: text('results-build'), equipment: text('results-equipment'), rewards: text('results-rewards'),
      unlocks: text('results-unlocks'),
    };
  });
  expect(result).toEqual(expect.objectContaining({
    kills: '42', damage: '1337', accuracy: '73%', build: 'SINERGIA ACTIVA: CIRCUITO VERDE',
  }));
  expect(result.equipment).toContain('GUANTE CRIO');
  expect(result.rewards).toContain('+130 BIO-CRÉDITOS');
  expect(result.unlocks).toContain('sector-2');
});

test('weapon mastery migrates safely and applies permanent rank bonuses', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('leek-ops-profile-v3', JSON.stringify({
    schemaVersion: 3, runs: 4, bestLevel: 7, victories: 1, bioCredits: 140,
    vibration: true, autoFire: false, unlocks: [], weaponMastery: { pulse: 60, spore: 0, arc: 0 },
  })));
  await deploy(page);
  const stats = await page.evaluate(() => {
    const scene = window.combatGame.scene.getScene('Game') as GameScene;
    return { damage: scene.player.stats.attackDamage, cooldown: scene.player.stats.attackCooldown, critical: scene.player.stats.criticalChance };
  });
  expect(stats.damage).toBe(21);
  expect(stats.cooldown).toBeCloseTo(218.5);
  expect(stats.critical).toBeCloseTo(0.11);
});

test('loot pauses for an inventory decision and installs into the backpack', async ({ page }) => {
  await deploy(page);
  const found = await page.evaluate(() => {
    const scene = window.combatGame.scene.getScene('Game') as GameScene;
    const internal = scene as unknown as {
      loot: { spawnEquipmentDrop: () => void };
      collectEquipment: (drop: Phaser.GameObjects.GameObject) => void;
    };
    internal.loot.spawnEquipmentDrop();
    internal.collectEquipment(scene.lootDrops.getChildren()[0]);
    return { state: scene.state, count: scene.inventory.count };
  });
  expect(found).toEqual({ state: 'INVENTORY', count: 0 });
  await page.keyboard.press('1');
  await expect.poll(() => page.evaluate(() => {
    const scene = window.combatGame.scene.getScene('Game') as GameScene;
    return { state: scene.state, count: scene.inventory.count };
  })).toEqual({ state: 'PLAYING', count: 1 });
});

test('a new weapon replaces the active weapon, its stats and its visible model', async ({ page }) => {
  await deploy(page);
  await page.evaluate(async () => {
    const scene = window.combatGame.scene.getScene('Game') as GameScene;
    const equipmentPath = '/src/game/loot/Equipment.ts';
    const { rollEquipment } = await import(equipmentPath);
    const roll = (values: number[]) => {
      let index = 0;
      return () => values[index++] ?? 0;
    };
    const internal = scene as unknown as { pendingLoot?: ReturnType<typeof rollEquipment> };
    internal.pendingLoot = rollEquipment(1, roll([0.1, 0.1, 0.1]));
    scene.state = 'INVENTORY' as typeof scene.state;
    scene.resolveLoot(true);
    internal.pendingLoot = rollEquipment(1, roll([0.1, 0.1, 0.99]));
    scene.state = 'INVENTORY' as typeof scene.state;
    scene.resolveLoot(true);
  });
  await page.waitForTimeout(100);
  const equipped = await page.evaluate(() => {
    const scene = window.combatGame.scene.getScene('Game') as GameScene;
    const weapon = scene.player.getByName('player-aimed-weapon') as Phaser.GameObjects.Container;
    const slide = weapon.list.find(child => (child as Phaser.GameObjects.Container).list?.length) as Phaser.GameObjects.Container;
    const body = slide?.list.find(child => (child as Phaser.GameObjects.Graphics).name.startsWith('weapon-')) as Phaser.GameObjects.Graphics;
    return {
      count: scene.inventory.count,
      name: scene.equippedWeapon,
      mode: scene.player.stats.weaponMode,
      damage: scene.player.stats.attackDamage,
      art: body?.name,
    };
  });
  expect(equipped).toEqual({
    count: 2,
    name: 'CAÑÓN DE PLASMA MK-1',
    mode: 'plasma',
    damage: 29,
    art: 'weapon-plasma',
  });
});

test('inventory opens, swaps stored weapons, recycles items and activates a set synergy', async ({ page }) => {
  await deploy(page);
  await page.evaluate(async () => {
    const scene = window.combatGame.scene.getScene('Game') as GameScene;
    const equipmentPath = '/src/game/loot/Equipment.ts';
    const { rollEquipment } = await import(equipmentPath);
    const makeRoll = (values: number[]) => {
      let index = 0;
      return () => values[index++] ?? 0;
    };
    const internal = scene as unknown as { pendingLoot?: ReturnType<typeof rollEquipment> };
    for (const values of [[0.1, 0.1, 0.99], [0.1, 0.1, 0.1], [0.1, 0.9, 0.1]]) {
      internal.pendingLoot = rollEquipment(3, makeRoll(values));
      scene.state = 'INVENTORY' as typeof scene.state;
      scene.resolveLoot(true);
    }
  });
  await page.evaluate(() => {
    const ui = window.combatGame.scene.getScene('UI');
    (ui.children.getByName('hud-inventory') as Phaser.GameObjects.Rectangle).emit('pointerup');
  });
  await expect.poll(() => page.evaluate(() => {
    const scene = window.combatGame.scene.getScene('Game') as GameScene;
    const ui = window.combatGame.scene.getScene('UI');
    return {
      state: scene.state,
      slots: ui.children.list.flatMap(child =>
        (child as Phaser.GameObjects.Container).list ?? [child]
      ).filter(child => child.name.startsWith('inventory-slot-')).length,
      mobileButton: Boolean(ui.children.getByName('hud-inventory')),
    };
  })).toEqual({ state: 'INVENTORY', slots: 6, mobileButton: true });
  const result = await page.evaluate(() => {
    const scene = window.combatGame.scene.getScene('Game') as GameScene;
    scene.equipInventoryWeapon(0);
    scene.recycleInventoryItem(1);
    const weapon = scene.player.getByName('player-aimed-weapon') as Phaser.GameObjects.Container;
    return {
      count: scene.inventory.count,
      mode: scene.player.stats.weaponMode,
      synergy: scene.activeSynergy?.id,
      damage: scene.player.stats.attackDamage,
      evolved: Boolean(weapon.getByName('weapon-evolution-crown')),
    };
  });
  expect(result).toEqual({ count: 2, mode: 'plasma', synergy: 'plague-bastion', damage: 47, evolved: false });
  await page.keyboard.press('i');
  await expect.poll(() => page.evaluate(() =>
    (window.combatGame.scene.getScene('Game') as GameScene).state)).toBe('PLAYING');
  await expect.poll(() => page.evaluate(() => {
    const scene = window.combatGame.scene.getScene('Game') as GameScene;
    const weapon = scene.player.getByName('player-aimed-weapon') as Phaser.GameObjects.Container;
    return Boolean(weapon.getByName('weapon-evolution-crown'));
  })).toBe(true);
});
