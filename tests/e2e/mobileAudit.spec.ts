import { test, expect, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { GameScene } from '../../src/game/scenes/GameScene';

declare global { interface Window { combatGame: Phaser.Game } }

/**
 * Mobile UX + performance audit suite.
 *
 * The three viewports below are the phone-landscape sizes this audit was asked to cover
 * (iPhone 13/14-class, a small Android/iPhone SE-class, and a Pixel-class device). Touch
 * targets are measured in real CSS pixels rather than logical game units, because the mobile
 * canvas is scaled down by `shortestEdge / 720` (see ViewportLayout.ts) -- a control sized
 * generously in logical space can still render smaller than a thumb on the narrowest phones.
 */
const MOBILE_RESOLUTIONS = [
  { name: '844x390 (iPhone 13/14 landscape)', width: 844, height: 390 },
  { name: '740x360 (small phone landscape)', width: 740, height: 360 },
  { name: '915x412 (Pixel-class landscape)', width: 915, height: 412 },
];

/** Apple HIG / Material minimum comfortable touch target, in CSS px. */
const MIN_TOUCH_TARGET = 44;

async function deploy(page: Page) {
  await page.route((url) => url.pathname === '/src/main.ts', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()).replace(
        'new Phaser.Game(gameConfig);',
        'window.combatGame = new Phaser.Game(gameConfig);',
      ),
    });
  });
  await page.goto('/');
  await page.waitForFunction(() => window.combatGame?.scene.isActive('Menu'));
  const logical = await page.evaluate(() => ({
    w: window.combatGame.scale.gameSize.width,
    h: window.combatGame.scale.gameSize.height,
  }));
  const box = (await page.locator('canvas').boundingBox())!;
  const at = (x: number, y: number) => ({
    x: box.x + (x / logical.w) * box.width,
    y: box.y + (y / logical.h) * box.height,
  });
  const deployButton = at(245, 425);
  await page.mouse.click(deployButton.x, deployButton.y);
  await page.waitForFunction(() => window.combatGame?.scene.isActive('Game'));
}

/** Reads a named UI game object's on-screen (CSS px) footprint and logical-space bounds. Searches
 * into containers too: Phaser reparents a child off the scene's own display list once it joins
 * one (e.g. BossBanner's and ContractHud's named rectangles live inside their own container). */
async function measureUiElement(page: Page, name: string) {
  return page.evaluate((objectName) => {
    const findByName = (list: unknown, targetName: string): unknown => {
      for (const child of list as { name?: string; list?: unknown }[]) {
        if (child.name === targetName) return child;
        if (child.list) {
          const found = findByName(child.list, targetName);
          if (found) return found;
        }
      }
      return null;
    };
    const ui = window.combatGame.scene.getScene('UI');
    const object = findByName(ui.children.list, objectName) as (Phaser.GameObjects.Components.ComputedSize &
      Phaser.GameObjects.Components.Transform &
      Phaser.GameObjects.Components.Visible) | null;
    if (!object) return null;
    const canvas = document.querySelector('canvas')!;
    const box = canvas.getBoundingClientRect();
    const scaleX = box.width / window.combatGame.scale.gameSize.width;
    const scaleY = box.height / window.combatGame.scale.gameSize.height;
    const halfW = object.displayWidth / 2;
    const halfH = object.displayHeight / 2;
    return {
      visible: object.visible,
      cssWidth: object.displayWidth * scaleX,
      cssHeight: object.displayHeight * scaleY,
      left: object.x - halfW,
      right: object.x + halfW,
      top: object.y - halfH,
      bottom: object.y + halfH,
    };
  }, name);
}

for (const resolution of MOBILE_RESOLUTIONS) {
  test.describe(`mobile HUD @ ${resolution.name}`, () => {
    test.use({
      viewport: { width: resolution.width, height: resolution.height },
      isMobile: true,
      hasTouch: true,
    });

    test('canvas fills the viewport and touch controls clear the minimum tap size', async ({ page }) => {
      await deploy(page);
      await page.waitForTimeout(300);

      const coverage = await page.evaluate(() => {
        const box = document.querySelector('canvas')!.getBoundingClientRect();
        return {
          x: box.width / window.innerWidth,
          y: box.height / window.innerHeight,
          canvasW: box.width,
          canvasH: box.height,
        };
      });
      // Same bar the existing "canvas fills phone landscape" smoke test uses.
      expect(coverage.x).toBeGreaterThan(0.995);
      expect(coverage.y).toBeGreaterThan(0.995);

      const pause = (await measureUiElement(page, 'hud-pause'))!;
      expect(pause.cssWidth, 'pause button width').toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
      expect(pause.cssHeight, 'pause button height').toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
      // And it must stay fully on the logical canvas -- not clipped past the right/top edge.
      expect(pause.right).toBeLessThanOrEqual(await page.evaluate(() => window.combatGame.scale.gameSize.width));
      expect(pause.top).toBeGreaterThanOrEqual(0);

      const dash = (await measureUiElement(page, 'mobilecontrols-dash'))!;
      expect(dash.cssWidth, 'dash pad width').toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
      expect(dash.cssHeight, 'dash pad height').toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);

      const autoZone = (await measureUiElement(page, 'mobilecontrols-auto-zone'))!;
      expect(autoZone.cssWidth, 'auto-fire hit zone width').toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
      expect(autoZone.cssHeight, 'auto-fire hit zone height').toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    });

    test('the enlarged pause button never overlaps the momentum HUD when both are visible', async ({ page }) => {
      await deploy(page);
      await page.evaluate(async () => {
        const scene = window.combatGame.scene.getScene('Game') as GameScene;
        scene.togglePause();
        const enemyModulePath = '/src/game/entities/enemies/Enemy.ts';
        const { Enemy } = await import(enemyModulePath);
        for (let index = 0; index < 3; index++) {
          const enemy = new Enemy(scene, 600 + index * 70, 500, 'GRUNT');
          scene.survivalMs = 1000 + index * 300;
          (scene as unknown as { resolveEnemyDeath: (enemy: unknown) => void }).resolveEnemyDeath(enemy);
        }
        scene.togglePause();
      });
      await page.waitForTimeout(200);

      const pause = (await measureUiElement(page, 'hud-pause'))!;
      const momentum = await measureUiElement(page, 'momentum-hud');
      expect(momentum, 'momentum HUD should appear after a 3-kill chain').not.toBeNull();
      expect(momentum!.visible).toBe(true);

      const overlapX = Math.max(0, Math.min(pause.right, momentum!.right) - Math.max(pause.left, momentum!.left));
      const overlapY = Math.max(0, Math.min(pause.bottom, momentum!.bottom) - Math.max(pause.top, momentum!.top));
      expect(overlapX * overlapY, 'pause button and momentum HUD must not overlap').toBe(0);
    });

    test('the compact contract tracker never overlaps the HP panel, boss/miniboss banner, pause button or touch controls', async ({ page }) => {
      await deploy(page);

      const rows = await Promise.all([0, 1, 2].map((index) => measureUiElement(page, `contract-row-${index}`)));
      for (const row of rows) expect(row, 'every contract row must exist and be visible').not.toBeNull();
      for (const row of rows) expect(row!.visible).toBe(true);

      // Geometry is fixed at creation regardless of current visibility (the boss banner and
      // momentum HUD only reveal themselves later in a run), so this also guards the layout
      // for the moment they do appear.
      const guardNames = ['hud-hp-panel', 'boss-banner-panel', 'hud-pause', 'mobilecontrols-dash', 'mobilecontrols-auto-zone'];
      const guarded = await Promise.all(guardNames.map((name) => measureUiElement(page, name)));
      for (const [index, guard] of guarded.entries())
        expect(guard, `${guardNames[index]} must exist on this layout`).not.toBeNull();

      for (const row of rows) {
        for (const guard of guarded) {
          const overlapX = Math.max(0, Math.min(row!.right, guard!.right) - Math.max(row!.left, guard!.left));
          const overlapY = Math.max(0, Math.min(row!.bottom, guard!.bottom) - Math.max(row!.top, guard!.top));
          expect(overlapX * overlapY, 'contract row must not overlap a protected HUD element').toBe(0);
        }
      }
    });
  });
}

test.describe('contract HUD on PC', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('the compact contract tracker never overlaps the HP panel, boss/miniboss banner, or the secondary HUD panels', async ({ page }) => {
    await deploy(page);

    const rows = await Promise.all([0, 1, 2].map((index) => measureUiElement(page, `contract-row-${index}`)));
    for (const row of rows) expect(row, 'every contract row must exist and be visible').not.toBeNull();
    for (const row of rows) expect(row!.visible).toBe(true);

    const guardNames = ['hud-hp-panel', 'boss-banner-panel', 'hud-pause', 'hud-weapon-slot', 'hud-armor-slot', 'hud-operation-panel'];
    const guarded = await Promise.all(guardNames.map((name) => measureUiElement(page, name)));
    for (const [index, guard] of guarded.entries())
      expect(guard, `${guardNames[index]} must exist on this layout`).not.toBeNull();

    for (const row of rows) {
      for (const guard of guarded) {
        const overlapX = Math.max(0, Math.min(row!.right, guard!.right) - Math.max(row!.left, guard!.left));
        const overlapY = Math.max(0, Math.min(row!.bottom, guard!.bottom) - Math.max(row!.top, guard!.top));
        expect(overlapX * overlapY, 'contract row must not overlap a protected HUD element').toBe(0);
      }
    }
  });
});

test.describe('combat clarity', () => {
  test('a run-phase callout never renders on top of the level-up modal', async ({ page }) => {
    await deploy(page);
    // Jumping straight to just before the first upgrade milestone (60s) crosses the 30s phase
    // boundary in the same frame, firing PhaseBanner and the level-up modal together -- exactly
    // the collision that used to make "LEVEL UP" unreadable (PhaseBanner drew above it at
    // depth 125; modals sit at depth 100-110).
    const result = await page.evaluate(() => {
      const scene = window.combatGame.scene.getScene('Game') as GameScene;
      const ui = window.combatGame.scene.getScene('UI');
      scene.survivalMs = 59999;
      scene.update(0, 1);
      const banner = ui.children.getByName('phase-banner') as Phaser.GameObjects.Components.Depth | null;
      return {
        state: scene.state,
        bannerDepth: banner?.depth ?? null,
      };
    });
    expect(result.state).toBe('LEVEL_UP');
    expect(result.bannerDepth, 'phase banner must exist for this scenario').not.toBeNull();
    // The lowest depth any modal (level-up, chest, pause) uses is 100; the banner must render
    // beneath all of them so its callout never obscures a modal's title or choices.
    expect(result.bannerDepth!).toBeLessThan(100);
  });
});

test.describe('performance under peak combat load', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('sustains the game loop with every pool filled to its designed cap', async ({ page }) => {
    const failures: string[] = [];
    page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));

    await deploy(page);

    const counts = await page.evaluate(async () => {
      const scene = window.combatGame.scene.getScene('Game') as GameScene;
      scene.player.health.max = 999999;
      scene.player.health.current = 999999;
      const enemyModulePath = '/src/game/entities/enemies/Enemy.ts';
      const { Enemy } = await import(enemyModulePath);
      const types = ['GRUNT', 'RUNNER', 'TANK', 'SHOOTER'] as const;

      // Fill the enemy pool to GAMEPLAY.maxEnemies (32): a full wave at the hardest phase.
      for (let i = 0; i < 32; i++) {
        const angle = (i / 32) * Math.PI * 2;
        const enemy = new Enemy(
          scene,
          scene.player.x + Math.cos(angle) * 260,
          scene.player.y + Math.sin(angle) * 260,
          types[i % types.length],
        );
        scene.enemies.add(enemy);
      }
      // Fire well past GAMEPLAY.maxPlayerProjectiles / maxEnemyProjectiles -- the pooled
      // groups cap themselves, so this saturates both pools rather than exceeding them.
      for (let i = 0; i < 150; i++) {
        const angle = (i / 150) * Math.PI * 2;
        scene.projectiles.fire(scene.player.x, scene.player.y, angle, scene.player.stats, scene.survivalMs);
        scene.enemyProjectiles.fire(scene.player.x + 40, scene.player.y, angle, 220, 5, scene.survivalMs);
      }
      // Same for XP orbs, and trigger a burst of hit VFX so the transient-effects pool is
      // under load too, matching a real crowded kill streak.
      const spawnOrb = (scene as unknown as { spawnOrb: (x: number, y: number, value: number) => void }).spawnOrb.bind(scene);
      const impacts = (scene as unknown as {
        impacts: { hit: (x: number, y: number, damage: number, opts: Record<string, boolean>) => void };
      }).impacts;
      for (let i = 0; i < 170; i++) {
        spawnOrb(scene.player.x + (i % 20) * 12, scene.player.y + Math.floor(i / 20) * 12, 5);
        impacts.hit(scene.player.x + (i % 12) * 10, scene.player.y, 8, {
          critical: i % 5 === 0,
          boss: false,
          elite: false,
          fatal: false,
        });
      }

      return {
        enemies: scene.enemies.countActive(true),
        projectiles: scene.projectiles.group.countActive(true),
        enemyProjectiles: scene.enemyProjectiles.group.countActive(true),
        orbs: scene.orbs.countActive(true),
        displayObjects: scene.children.length,
      };
    });

    // These mirror GAMEPLAY.maxEnemies / maxPlayerProjectiles / maxEnemyProjectiles / maxXpOrbs
    // in src/game/config/Constants.ts -- the designed combat ceiling this audit measured against.
    expect(counts.enemies).toBe(32);
    expect(counts.projectiles).toBe(90);
    expect(counts.enemyProjectiles).toBe(100);
    expect(counts.orbs).toBe(160);
    console.log(`[mobileAudit] peak-load display objects: ${counts.displayObjects}`);

    // Liveness under peak load, same technique the existing smoke suite uses: sample the
    // engine's own frame counter over a real window and confirm it kept advancing (a frozen
    // game -- e.g. a lost WebGL context or an uncaught exception in a Phaser callback -- stops
    // this counter dead without necessarily throwing).
    const before = await page.evaluate(() => window.combatGame.loop.frame);
    await page.waitForTimeout(3000);
    const after = await page.evaluate(() => ({
      frame: window.combatGame.loop.frame,
      fps: window.combatGame.loop.actualFps,
    }));
    expect(after.frame, 'render loop must keep advancing under peak load').toBeGreaterThan(before);
    console.log(`[mobileAudit] actualFps under peak load: ${after.fps.toFixed(1)}`);
    expect(failures, failures.join('\n')).toEqual([]);
  });
});
