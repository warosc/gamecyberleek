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
