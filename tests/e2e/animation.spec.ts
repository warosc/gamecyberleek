import { test, expect, type Page } from '@playwright/test';
import type { GameScene } from '../../src/game/scenes/GameScene';
import type Phaser from 'phaser';
import type { Enemy } from '../../src/game/entities/enemies/Enemy';

declare global {
  interface Window { animationTestScene: GameScene; animationTestGame: Phaser.Game; rosterEnemies: Enemy[] }
}

async function deploy(page: Page) {
  // Instrument the served entry point only in this test browser.
  await page.route(url => url.pathname === '/src/main.ts', async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace('new Phaser.Game(gameConfig);',
      'window.animationTestGame = new Phaser.Game(gameConfig);');
    await route.fulfill({ response, body });
  });
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForFunction(() => window.animationTestGame?.scene.isActive('Menu'), undefined, { timeout: 20000 });
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(box.x + box.width * 245 / 1280, box.y + box.height * 425 / 720);
  await page.waitForFunction(() => window.animationTestGame.scene.isActive('Game'));
  await page.evaluate(() => {
    window.animationTestScene = window.animationTestGame.scene.getScene('Game') as GameScene;
  });
  await page.evaluate(() => window.animationTestScene.player.activateShield(60000));
}

test('keyboard and mouse remain usable when the PC reports a touch screen', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 1 }));
  await deploy(page);
  expect(await page.evaluate(() => window.animationTestScene.mobileInput.active)).toBe(true);
  const position = () => page.evaluate(() => ({ x: window.animationTestScene.player.x, y: window.animationTestScene.player.y }));
  const start = await position();
  await page.keyboard.down('w');
  await expect.poll(async () => (await position()).y).toBeLessThan(start.y - 10);
  await page.keyboard.up('w');
  const afterW = await position();
  await page.keyboard.down('ArrowRight');
  await expect.poll(async () => (await position()).x).toBeGreaterThan(afterW.x + 10);
  await page.keyboard.down('Space');
  await expect.poll(() => page.evaluate(() => window.animationTestScene.player.getDashCharge())).toBeLessThan(1);
  await page.keyboard.up('Space');
  await page.keyboard.up('ArrowRight');

  // An idle touch aim must not capture mouse aiming or suppress click-to-fire.
  await page.evaluate(() => window.animationTestScene.mobileInput.aim.set(-1, 0));
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.5);
  await page.mouse.down();
  await expect.poll(() => page.evaluate(() => window.animationTestScene.projectiles.group.countActive(true))).toBeGreaterThan(0);
  expect(await page.evaluate(() => Math.cos(window.animationTestScene.player.aim))).toBeGreaterThan(0);
  await page.mouse.up();

  // Releasing the keyboard leaves the touch stick usable in the same run.
  const beforeTouch = await position();
  await page.evaluate(() => window.animationTestScene.mobileInput.movement.set(-1, 0));
  await expect.poll(async () => (await position()).x).toBeLessThan(beforeTouch.x - 10);
  await page.evaluate(() => window.animationTestScene.mobileInput.movement.set(0, 0));
});

test('animates a live arena and keeps legs moving while firing, then freezes on pause', async ({ page }, testInfo) => {
  const failures: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  await deploy(page);
  // Virtual input exercises the same movement/weapon path on desktop and touch browsers.
  await page.evaluate(() => {
    const scene = window.animationTestScene;
    scene.mobileInput.active = true;
    scene.mobileInput.movement.set(1, 0);
    scene.mobileInput.firing = true;
    scene.player.stats.attackCooldown = 100;
  });
  await page.waitForTimeout(500);
  const sample = () => page.evaluate(() => {
    const scene = window.animationTestScene;
    const rig = scene.player.list.find(child => 'setAnimationState' in child) as unknown as Phaser.GameObjects.Container;
    const leg = rig.list.find(child => (child as Phaser.GameObjects.Image).texture?.key === 'rig-leg-right') as Phaser.GameObjects.Image;
    const rotor = scene.children.getByName('arena-reactor-rotor') as Phaser.GameObjects.Graphics;
    return { leg: leg.rotation, rotor: rotor.rotation, x: scene.player.x, time: scene.survivalMs,
      state: scene.player.animationState, shots: scene.projectiles.group.countActive(true) };
  });
  const first = await sample();
  await page.waitForTimeout(150);
  const second = await sample();
  expect(first.state).toBe('attack');
  expect(second.state).toBe('attack');
  expect(second.x).toBeGreaterThan(first.x);
  expect(second.leg).not.toBeCloseTo(first.leg, 3);
  expect(second.rotor).not.toBe(first.rotor);
  expect(second.shots).toBeGreaterThan(0);

  await page.evaluate(async () => {
    const scene = window.animationTestScene;
    scene.mobileInput.movement.set(0, 0);
    scene.mobileInput.firing = false;
    const path = '/src/game/entities/enemies/Enemy.ts';
    const { Enemy } = await import(path);
    for (const [index, type] of ['GRUNT', 'RUNNER', 'TANK', 'SHOOTER', 'BOSS'].entries()) {
      scene.enemies.add(new Enemy(scene, scene.player.x - 280 + index * 125, scene.player.y - 175, type));
    }
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: testInfo.outputPath('living-lab.png') });
  await page.evaluate(() => window.animationTestScene.togglePause());
  await page.waitForTimeout(100);
  const paused = await sample();
  await page.waitForTimeout(400);
  expect(await sample()).toEqual(paused);
  await page.evaluate(() => window.animationTestScene.resumeGame());
  await page.waitForTimeout(200);
  expect((await sample()).time).toBeGreaterThan(paused.time);
  expect(failures).toEqual([]);
});

test('reduced motion keeps the reactor still and survives a return to the menu', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await deploy(page);
  const rotation = () => page.evaluate(() =>
    (window.animationTestScene.children.getByName('arena-reactor-rotor') as Phaser.GameObjects.Graphics).rotation);
  const before = await rotation();
  await page.waitForTimeout(350);
  expect(await rotation()).toBe(before);
  await page.evaluate(() => {
    window.animationTestScene.togglePause();
    window.animationTestScene.returnToMenu();
  });
  await page.waitForTimeout(300);
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(box.x + box.width * 245 / 1280, box.y + box.height * 425 / 720);
  await page.waitForFunction(() => window.animationTestScene.scene.isActive() && window.animationTestScene.survivalMs > 200);
  expect(await rotation()).toBe(0);
});

test('BRÓK-9 loads its production art, changes phases and completes the encounter', async ({ page }, testInfo) => {
  const failures: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  await deploy(page);
  await page.keyboard.press('b');
  const bossState = () => page.evaluate(() => {
    const scene = window.animationTestScene;
    const boss = scene.enemies.getChildren().find(child => (child as Enemy).enemyType === 'BOSS') as Enemy;
    return { phase: boss?.bossPhase, texture: scene.textures.exists('brok9-commander') };
  });
  await expect.poll(bossState).toEqual({ phase: 1, texture: true });
  await page.evaluate(() => {
    const scene = window.animationTestScene;
    const boss = scene.enemies.getChildren().find(child => (child as Enemy).enemyType === 'BOSS') as Enemy;
    boss.setPosition(scene.player.x + 220, scene.player.y - 40);
  });
  await page.waitForTimeout(2400);
  await page.screenshot({ path: testInfo.outputPath('brok9-in-cyberleek.png') });
  for (const [damage, phase] of [[750, 2], [600, 3]]) {
    await page.evaluate(amount => {
      const boss = window.animationTestScene.enemies.getChildren().find(child => (child as Enemy).enemyType === 'BOSS') as Enemy;
      boss.hit(amount);
    }, damage);
    await expect.poll(async () => (await bossState()).phase).toBe(phase);
  }
  await page.evaluate(() => {
    const scene = window.animationTestScene;
    const boss = scene.enemies.getChildren().find(child => (child as Enemy).enemyType === 'BOSS') as Enemy;
    boss.health.current = 1;
    boss.setPosition(scene.player.x + 100, scene.player.y);
    scene.activateSpecial('nova');
  });
  await page.waitForFunction(() => window.animationTestGame.scene.isActive('GameOver'));
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('leek-ops-profile-v2')!).victories)).toBe(1);
  expect(failures).toEqual([]);
});

test('vegetable enemies render, animate, pause and remain visible in the bestiary', async ({ page }, testInfo) => {
  const failures: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  await deploy(page);
  await page.evaluate(async () => {
    const scene = window.animationTestScene;
    const path = '/src/game/entities/enemies/Enemy.ts';
    const { Enemy } = await import(path);
    scene.enemies.clear(true, true);
    window.rosterEnemies = ['GRUNT', 'RUNNER', 'TANK', 'SHOOTER'].map((type, index) => {
      const enemy = new Enemy(scene, scene.player.x - 270 + index * 180, scene.player.y - 120, type);
      scene.enemies.add(enemy);
      return enemy;
    });
    window.rosterEnemies[2].makeElite();
  });
  const poses = () => page.evaluate(() => window.rosterEnemies.map(enemy => {
    const art = (enemy as unknown as { vegetableVisual: Phaser.GameObjects.Container }).vegetableVisual;
    const model = art.list[1] as Phaser.GameObjects.Container;
    const sprite = model.list.find(child => (child as Phaser.GameObjects.Image).texture?.key.startsWith('vegetable-')) as Phaser.GameObjects.Image;
    return { texture: sprite.texture.key, y: model.y, rotation: model.rotation, children: art.list.length };
  }));
  await page.waitForTimeout(100);
  const before = await poses();
  expect(before.map(pose => pose.texture)).toEqual(['vegetable-radish', 'vegetable-carrot', 'vegetable-eggplant', 'vegetable-tomato']);
  await page.waitForTimeout(200);
  expect(await poses()).not.toEqual(before);
  await page.screenshot({ path: testInfo.outputPath('vegetables-in-cyberleek.png') });
  await page.evaluate(() => window.animationTestScene.togglePause());
  const paused = await poses();
  await page.waitForTimeout(250);
  expect(await poses()).toEqual(paused);
  await page.evaluate(() => window.animationTestScene.returnToMenu());
  await page.waitForFunction(() => window.animationTestGame.scene.isActive('Menu'));
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(box.x + box.width * 430 / 1280, box.y + box.height * 498 / 720);
  await page.waitForFunction(() => window.animationTestGame.scene.isActive('Bestiary'));
  await page.screenshot({ path: testInfo.outputPath('cyberleek-bestiary.png') });
  await page.mouse.click(box.x + box.width * 640 / 1280, box.y + box.height * 635 / 720);
  await page.waitForFunction(() => window.animationTestGame.scene.isActive('Menu'));
  expect(failures).toEqual([]);
});
