import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { GameScene } from '../../src/game/scenes/GameScene';

declare global { interface Window { combatGame: Phaser.Game } }

async function deploy(page: Page) {
  await page.route(url => url.pathname === '/src/main.ts', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace(
      'new Phaser.Game(gameConfig);', 'window.combatGame = new Phaser.Game(gameConfig);',
    ) });
  });
  await page.goto('/');
  await page.waitForFunction(() => window.combatGame?.scene.isActive('Menu'));
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(box.x + box.width * 245 / 1280, box.y + box.height * 425 / 720);
  await page.waitForFunction(() => window.combatGame.scene.isActive('Game'));
}

test('laboratory hazard rewards leaving both marked axes', async ({ page }) => {
  await deploy(page);
  const result = await page.evaluate(() => {
    const scene = window.combatGame.scene.getScene('Game') as GameScene;
    const hazard = (scene as unknown as { sectorHazards: { update: (time: number, enabled: boolean) => void } }).sectorHazards;
    const before = scene.player.health.current;
    hazard.update(22000, true);
    scene.player.setPosition(scene.player.x + 100, scene.player.y + 100);
    hazard.update(23201, true);
    const safe = scene.player.health.current;
    hazard.update(48000, true);
    hazard.update(49201, true);
    return { before, safe, hit: scene.player.health.current };
  });
  expect(result.safe).toBe(result.before);
  expect(result.hit).toBeLessThan(result.safe);
});

test('greenhouse and frozen reactor load their unique scenery', async ({ page }) => {
  await deploy(page);
  const loadSector = async (arenaIndex: number, marker: string) => {
    await page.evaluate(index => {
      const scene = window.combatGame.scene.getScene('Game') as GameScene;
      scene.scene.stop('UI');
      scene.scene.restart({ arenaIndex: index });
    }, arenaIndex);
    await page.waitForFunction(name => Boolean(
      window.combatGame.scene.getScene('Game').children.getByName(name),
    ), marker);
    return page.evaluate(name => {
      const scene = window.combatGame.scene.getScene('Game') as GameScene;
      const layer = scene.children.getByName(name) as Phaser.GameObjects.Container;
      return { arena: scene.arenaIndex, pieces: layer.list.length };
    }, marker);
  };
  const greenhouse = await loadSector(1, 'arena-biome-greenhouse');
  expect(greenhouse.arena).toBe(1);
  expect(greenhouse.pieces).toBeGreaterThanOrEqual(26);
  const reactor = await loadSector(2, 'arena-biome-reactor');
  expect(reactor.arena).toBe(2);
  expect(reactor.pieces).toBeGreaterThanOrEqual(21);
});

test('shooting a sector device consumes it and damages nearby enemies', async ({ page }) => {
  await deploy(page);
  await page.evaluate(async () => {
    const scene = window.combatGame.scene.getScene('Game') as GameScene;
    const enemyModulePath = '/src/game/entities/enemies/Enemy.ts';
    const { Enemy } = await import(enemyModulePath);
    scene.enemies.clear(true, true);
    const devices = (scene as unknown as { sectorDevices: { group: Phaser.Physics.Arcade.StaticGroup } }).sectorDevices.group;
    const device = devices.getChildren()[0] as Phaser.GameObjects.Arc;
    const target = new Enemy(scene, device.x + 30, device.y, 'GRUNT');
    target.setName('device-test-target');
    scene.enemies.add(target);
    scene.projectiles.fire(device.x, device.y, 0, scene.player.stats, scene.survivalMs);
  });
  await expect.poll(() => page.evaluate(() => {
    const scene = window.combatGame.scene.getScene('Game') as GameScene;
    const devices = (scene as unknown as { sectorDevices: { group: Phaser.Physics.Arcade.StaticGroup } }).sectorDevices.group;
    return devices.countActive(true);
  })).toBe(2);
  expect(await page.evaluate(() => !window.combatGame.scene.getScene('Game').children.getByName('device-test-target'))).toBe(true);
});
