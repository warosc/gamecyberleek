import { test, expect, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { GameScene } from '../../src/game/scenes/GameScene';

// Regressions for defects that only show up with two contacts in one physics step, a heal, a
// late miniboss, or input still held when a modal or the results screen opens. None of them
// throw, so the smoke tests stayed green while players lost upgrades and skipped results.

declare global { interface Window { combatGame: Phaser.Game } }

/** Private members are reachable at runtime; the tests drive them directly instead of playing. */
type Internals = Pick<GameScene, 'state' | 'chests' | 'enemies' | 'player'> & {
  openLevelUp: () => void;
  openChest: (chest: Phaser.GameObjects.GameObject) => void;
  enemyContact: (enemy: Phaser.GameObjects.GameObject) => void;
  gameOver: (victory: boolean) => void;
  loot: { spawnChest: () => void };
  encounters: { spawnMiniboss: () => boolean; spawnBoss: () => boolean };
};

async function deploy(page: Page) {
  await page.route(url => url.pathname === '/src/main.ts', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('new Phaser.Game(gameConfig);', 'window.combatGame = new Phaser.Game(gameConfig);') });
  });
  await page.goto('/');
  await page.waitForFunction(() => window.combatGame?.scene.isActive('Menu'));
  const b = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(b.x + b.width * 245 / 1280, b.y + b.height * 425 / 720);
  await page.waitForFunction(() => window.combatGame.scene.isActive('Game') && window.combatGame.scene.isActive('UI'));
}

const gameState = (page: Page) => page.evaluate(() => (window.combatGame.scene.getScene('Game') as GameScene).state);

test('contacts in the step that opened a level-up wait for it to resolve', async ({ page }) => {
  await deploy(page);
  const result = await page.evaluate(() => {
    const scene = window.combatGame.scene.getScene('Game') as unknown as Internals;
    scene.openLevelUp();
    scene.loot.spawnChest();
    const chest = scene.chests.getChildren().at(-1)!;
    scene.openChest(chest);
    const enemy = scene.enemies.getChildren().find(object => object.active);
    const health = scene.player.health.current;
    if (enemy) scene.enemyContact(enemy);
    return { state: scene.state, chestActive: chest.active, healthKept: scene.player.health.current === health };
  });
  expect(result).toEqual({ state: 'LEVEL_UP', chestActive: true, healthKept: true });
});

test('a heal pulses the health frame green instead of the red hit pulse', async ({ page }) => {
  await deploy(page);
  const frame = await page.evaluate(() => {
    const scene = window.combatGame.scene.getScene('Game') as GameScene;
    const ui = window.combatGame.scene.getScene('UI') as unknown as {
      statusHud: { frame: Phaser.GameObjects.Rectangle };
    };
    scene.events.emit('player-damaged', 80, 100);
    const heal = ui.statusHud.frame.strokeColor;
    scene.events.emit('player-damaged', 70, 100, 10);
    return { heal, hit: ui.statusHud.frame.strokeColor };
  });
  expect(frame).toEqual({ heal: 0x73ef62, hit: 0xff476f });
});

test('a miniboss still alive when the boss arrives takes its health bar with it', async ({ page }) => {
  await deploy(page);
  await page.evaluate(() => {
    const scene = window.combatGame.scene.getScene('Game') as unknown as Internals;
    scene.encounters.spawnMiniboss();
  });
  const panelVisible = () => page.evaluate(() =>
    (window.combatGame.scene.getScene('UI') as unknown as { minibossBanner: { panel: Phaser.GameObjects.Container } })
      .minibossBanner.panel.visible);
  await expect.poll(panelVisible).toBe(true);
  await page.evaluate(() => (window.combatGame.scene.getScene('Game') as unknown as Internals).encounters.spawnBoss());
  await expect.poll(panelVisible).toBe(false);
});

// The leftover press is emitted in the same frame the modal opens. A real key press from the
// test runner lands an unknown number of milliseconds later, past the window under load.
test('ENTER held from combat does not pick a reward the instant it opens', async ({ page }) => {
  await deploy(page);
  await page.evaluate(() => {
    (window.combatGame.scene.getScene('Game') as unknown as Internals).openLevelUp();
    window.combatGame.scene.getScene('UI').input.keyboard!.emit('keydown-ENTER', { repeat: false });
  });
  expect(await gameState(page)).toBe('LEVEL_UP');
  await page.waitForTimeout(600);
  await page.keyboard.press('Enter');
  await expect.poll(() => gameState(page)).toBe('PLAYING');
});

test('the number keys pick a reward at once', async ({ page }) => {
  await deploy(page);
  await page.evaluate(() => (window.combatGame.scene.getScene('Game') as unknown as Internals).openLevelUp());
  await page.keyboard.press('1');
  await expect.poll(() => gameState(page)).toBe('PLAYING');
});

test('the results screen is not skipped by input still held when the run ends', async ({ page }) => {
  await deploy(page);
  const skipped = await page.evaluate(() => new Promise<boolean>((resolve) => {
    const game = window.combatGame;
    (game.scene.getScene('Game') as unknown as Internals).gameOver(false);
    // Press ENTER on the first frame the results screen is up, as a held key would.
    const firstFrame = () => {
      if (!game.scene.isActive('GameOver')) return requestAnimationFrame(firstFrame);
      game.scene.getScene('GameOver').input.keyboard!.emit('keydown-ENTER', { repeat: false });
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(!game.scene.isActive('GameOver'))));
    };
    firstFrame();
  }));
  expect(skipped).toBe(false);
  await page.waitForTimeout(700);
  // SPACE is the dash key and no longer redeploys; ENTER does once the screen is armed.
  await page.keyboard.press('Space');
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.combatGame.scene.isActive('GameOver'))).toBe(true);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.combatGame.scene.isActive('Game'));
});
