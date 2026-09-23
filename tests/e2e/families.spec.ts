import { test, expect, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { GameScene } from '../../src/game/scenes/GameScene';
import type { Enemy } from '../../src/game/entities/enemies/Enemy';

declare global { interface Window { combatGame: Phaser.Game; spawnTest: (type: string, dx: number, dy: number) => Enemy } }

async function deploy(page: Page, arenaIndex = 0) {
  await page.route(url => url.pathname === '/src/main.ts', async route => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()).replace('new Phaser.Game(gameConfig);', 'window.combatGame = new Phaser.Game(gameConfig);'),
    });
  });
  await page.goto('/');
  await page.waitForFunction(() => window.combatGame?.scene.isActive('Menu'));
  await page.evaluate(index => window.combatGame.scene.getScene('Menu').scene.start('Game', { arenaIndex: index }), arenaIndex);
  await page.waitForFunction(() => window.combatGame.scene.isActive('Game'));
  await page.evaluate(async () => {
    const path = '/src/game/entities/enemies/Enemy.ts';
    const { Enemy } = await import(path);
    window.spawnTest = (type, dx, dy) => {
      const scene = window.combatGame.scene.getScene('Game') as GameScene;
      const enemy = new Enemy(scene, scene.player.x + dx, scene.player.y + dy, type) as Enemy;
      scene.enemies.add(enemy);
      return enemy;
    };
    // Keep the player alive and the arena quiet so each mechanic is observed on its own.
    const scene = window.combatGame.scene.getScene('Game') as GameScene;
    scene.player.health.max = scene.player.health.current = 99999;
    scene.enemies.clear(true, true);
  });
}

const game = (page: Page) => page.evaluate(() => (window.combatGame.scene.getScene('Game') as GameScene).survivalMs);

test('a medic pulse heals a wounded ally', async ({ page }) => {
  await deploy(page);
  await page.evaluate(() => {
    // The medic holds 280-420px from the player; a chasing ally would leave its pulse radius,
    // so the ally is pinned beside the medic and only the medic's own behaviour is exercised.
    const ally = window.spawnTest('TANK', 360, 60);
    ally.health.current = 20;
    ally.updateBehavior = () => (ally.body as Phaser.Physics.Arcade.Body).setVelocity(0);
    window.spawnTest('MEDIC', 350, 0);
    (window as unknown as { ally: Enemy }).ally = ally;
  });
  await expect.poll(() => page.evaluate(() => (window as unknown as { ally: Enemy }).ally.health.current), { timeout: 15_000 })
    .toBeGreaterThan(20);
});

test('a bulwark aura reduces damage to nearby allies but not to itself', async ({ page }) => {
  await deploy(page);
  await page.evaluate(() => {
    (window as unknown as { pair: Enemy[] }).pair = [window.spawnTest('TANK', 700, 0), window.spawnTest('BULWARK', 740, 0)];
  });
  await page.waitForTimeout(200);
  const result = await page.evaluate(() => {
    const [ally, bulwark] = (window as unknown as { pair: Enemy[] }).pair;
    const allyBefore = ally.health.current;
    const bulwarkBefore = bulwark.health.current;
    ally.hit(40);
    bulwark.hit(40);
    return { ally: allyBefore - ally.health.current, bulwark: bulwarkBefore - bulwark.health.current };
  });
  expect(result).toEqual({ ally: 22, bulwark: 40 });
});

test('a brood splits into two runners when it dies', async ({ page }) => {
  await deploy(page);
  const counts = await page.evaluate(() => {
    const scene = window.combatGame.scene.getScene('Game') as GameScene;
    const brood = window.spawnTest('BROOD', 700, 0);
    const internals = scene as unknown as { resolveEnemyDeath: (enemy: Enemy) => void };
    internals.resolveEnemyDeath(brood);
    return (scene.enemies.getChildren() as Enemy[]).filter(enemy => enemy.active).map(enemy => enemy.enemyType);
  });
  expect(counts).toEqual(['RUNNER', 'RUNNER']);
});

test('burn damages over gameplay time and stops while paused', async ({ page }) => {
  await deploy(page);
  await page.evaluate(() => {
    const scene = window.combatGame.scene.getScene('Game') as GameScene;
    const target = window.spawnTest('TANK', 900, 0);
    (window as unknown as { target: Enemy }).target = target;
    scene.player.stats.burnDamage = 4;
    (scene as unknown as { applyWeaponStatuses: (enemy: Enemy) => void }).applyWeaponStatuses(target);
  });
  const hp = () => page.evaluate(() => (window as unknown as { target: Enemy }).target.health.current);
  await expect.poll(hp, { timeout: 5000 }).toBeLessThan(110);
  await page.evaluate(() => (window.combatGame.scene.getScene('Game') as GameScene).togglePause());
  const paused = await hp();
  const pausedAt = await game(page);
  await page.waitForTimeout(1200);
  expect(await hp()).toBe(paused);
  expect(await game(page)).toBe(pausedAt);
});

test('each sector fields its own commander and the cryo lance slows the player', async ({ page }) => {
  await deploy(page, 2);
  const boss = await page.evaluate(() => {
    const scene = window.combatGame.scene.getScene('Game') as GameScene;
    (scene as unknown as { encounters: { spawnBoss: () => boolean } }).encounters.spawnBoss();
    const commander = (scene.enemies.getChildren() as Enemy[]).find(enemy => enemy.enemyType === 'BOSS')!;
    return { max: commander.health.max };
  });
  expect(boss.max).toBe(Math.round(1800 * 1.24));
  await expect.poll(() => page.evaluate(() => {
    type Node = Phaser.GameObjects.GameObject & { list?: Node[]; text?: string };
    const collect = (list: Node[]): string[] =>
      list.flatMap(child => [...(child.type === 'Text' ? [child.text!] : []), ...(child.list ? collect(child.list) : [])]);
    return collect(window.combatGame.scene.getScene('UI').children.list as Node[]).some(text => text.includes('ROMA-X'));
  })).toBe(true);
  const chilled = await page.evaluate(() => {
    const scene = window.combatGame.scene.getScene('Game') as GameScene;
    scene.player.chill(2000);
    return scene.player.isChilled;
  });
  expect(chilled).toBe(true);
});
