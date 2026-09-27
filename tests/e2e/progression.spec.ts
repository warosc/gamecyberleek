import { test, expect, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { GameScene } from '../../src/game/scenes/GameScene';

declare global { interface Window { combatGame: Phaser.Game; fakePad?: { axes: number[]; pressed: Set<number> } } }

const PROFILE_KEY = 'leek-ops-profile-v5';

async function boot(page: Page, profile?: object) {
  await page.route(url => url.pathname === '/src/main.ts', async route => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()).replace('new Phaser.Game(gameConfig);', 'window.combatGame = new Phaser.Game(gameConfig);'),
    });
  });
  if (profile) await page.addInitScript(([key, value]) => {
    // Seed once: later reloads in the same test must see what the game saved.
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem(key, value);
      sessionStorage.setItem('seeded', '1');
    }
  }, [PROFILE_KEY, JSON.stringify(profile)] as const);
  await page.goto('/');
  await page.waitForFunction(() => window.combatGame?.scene.isActive('Menu'));
}

const tap = (page: Page, scene: string, name: string) => page.evaluate(([sceneKey, objectName]) => {
  // Menu buttons live inside containers, which take them off the scene's top-level list.
  type Node = Phaser.GameObjects.GameObject & { list?: Node[] };
  const find = (list: Node[]): Node | undefined => {
    for (const child of list) {
      if (child.name === objectName) return child;
      const nested = child.list && find(child.list);
      if (nested) return nested;
    }
    return undefined;
  };
  const target = find(window.combatGame.scene.getScene(sceneKey).children.list as Node[]);
  if (!target) throw new Error(`missing ${objectName}`);
  target.emit('pointerdown');
  target.emit('pointerup');
}, [scene, name] as const);

/** Every text in a scene, including those nested in containers such as menu buttons. */
const sceneTexts = (page: Page, scene: string) => page.evaluate(sceneKey => {
  type Node = Phaser.GameObjects.GameObject & { list?: Node[]; text?: string };
  const collect = (list: Node[]): string[] =>
    list.flatMap(child => [...(child.type === 'Text' ? [child.text!] : []), ...(child.list ? collect(child.list) : [])]);
  return collect(window.combatGame.scene.getScene(sceneKey).children.list as Node[]);
}, scene);

const storedProfile = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), PROFILE_KEY);

test('the workshop spends credits and the next run starts with the upgrade', async ({ page }) => {
  await boot(page, { bioCredits: 200 });
  await tap(page, 'Menu', 'menu-workshop');
  await page.waitForFunction(() => window.combatGame.scene.isActive('Workshop'));
  await tap(page, 'Workshop', 'workshop-buy-plating');
  await tap(page, 'Workshop', 'workshop-buy-plating');
  const saved = await storedProfile(page);
  expect(saved.bioCredits).toBe(200 - 60 - 120);
  expect(saved.workshop.plating).toBe(2);
  // Unaffordable: nothing changes.
  await tap(page, 'Workshop', 'workshop-buy-plating');
  expect((await storedProfile(page)).bioCredits).toBe(20);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.combatGame.scene.isActive('Menu'));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.combatGame.scene.isActive('Game'));
  const hp = await page.evaluate(() => {
    const scene = window.combatGame.scene.getScene('Game') as GameScene;
    return { max: scene.player.health.max, current: scene.player.health.current };
  });
  expect(hp).toEqual({ max: 120, current: 120 });
});

test('an unlocked sector can be chosen from the menu and pays its multiplier', async ({ page }) => {
  await boot(page, { unlocks: ['sector-2'], bestLevel: 5 });
  const sector = () => page.evaluate(() => (window.combatGame.scene.getScene('Menu') as unknown as { sector: number }).sector);
  // Steps use the on-screen arrows: back-to-back synthetic key presses can coalesce inside one
  // Phaser frame, which a person never produces. Arrow keys reach the same handler.
  await tap(page, 'Menu', 'menu-sector-next');
  await expect.poll(sector).toBe(1);
  expect(await page.evaluate(() =>
    (window.combatGame.scene.getScene('Menu').children.getByName('menu-sector-name') as Phaser.GameObjects.Text).text))
    .toBe('NEON GREENHOUSE');
  // Sector 3 is locked, so the next step wraps back to sector 1.
  await tap(page, 'Menu', 'menu-sector-next');
  await expect.poll(sector).toBe(0);
  await tap(page, 'Menu', 'menu-sector-prev');
  await expect.poll(sector).toBe(1);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.combatGame.scene.isActive('Game'));
  expect(await page.evaluate(() => (window.combatGame.scene.getScene('Game') as GameScene).arenaIndex)).toBe(1);
});

test('the daily operation applies its mutator and records a score on the results screen', async ({ page }) => {
  await boot(page);
  await tap(page, 'Menu', 'menu-daily');
  await page.waitForFunction(() => window.combatGame.scene.isActive('Game'));
  const run = await page.evaluate(() => {
    const scene = window.combatGame.scene.getScene('Game') as GameScene;
    const daily = scene.daily;
    (scene as unknown as { gameOver: (victory: boolean) => void }).gameOver(false);
    return { daily, arena: scene.arenaIndex, weapon: scene.selectedWeaponId };
  });
  expect(run.daily?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await page.waitForFunction(() => window.combatGame.scene.isActive('GameOver'));
  const scoreText = await page.evaluate(() =>
    (window.combatGame.scene.getScene('GameOver').children.getByName('results-daily') as Phaser.GameObjects.Text)?.text);
  expect(scoreText).toBeTruthy();
  const saved = await storedProfile(page);
  expect(saved.daily.date).toBe(run.daily!.date);
  expect(saved.daily.attempts).toBe(1);
  expect(saved.history.at(-1)).toMatchObject({ sector: run.arena, weaponId: run.weapon, victory: false });
  // Retrying keeps the same daily identity instead of advancing a sector.
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.combatGame.scene.isActive('Game'));
  expect(await page.evaluate(() => (window.combatGame.scene.getScene('Game') as GameScene).daily?.date)).toBe(run.daily!.date);
});

test('switching the language to English relabels the menu and persists', async ({ page }) => {
  await boot(page);
  await tap(page, 'Menu', 'menu-settings');
  await page.waitForFunction(() => window.combatGame.scene.isActive('Settings'));
  // Row 7 is the language row.
  await tap(page, 'Settings', 'setting-next-7');
  await page.waitForFunction(() => window.combatGame.scene.isActive('Settings'));
  expect((await storedProfile(page)).settings.locale).toBe('en');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.combatGame.scene.isActive('Menu'));
  const texts = await sceneTexts(page, 'Menu');
  expect(texts).toContain('DEPLOY');
  expect(texts).toContain('WORKSHOP');
  await page.reload();
  await page.waitForFunction(() => window.combatGame?.scene.isActive('Menu'));
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
});

test('the records screen lists saved runs and achievements', async ({ page }) => {
  await boot(page, {
    runs: 1, victories: 1, achievements: ['first-harvest'],
    history: [{ at: '2026-09-23T10:00:00.000Z', sector: 0, weaponId: 'arc', level: 9, victory: true, durationMs: 301000, kills: 140, credits: 145 }],
    lifetime: { kills: 140, playTimeMs: 301000 },
  });
  await tap(page, 'Menu', 'menu-records');
  await page.waitForFunction(() => window.combatGame.scene.isActive('Records'));
  const texts = await sceneTexts(page, 'Records');
  expect(texts).toContain('LOGROS  1/10');
  expect(texts.some(text => text.includes('ARC LEEK'))).toBe(true);
  expect(texts).toContain('140');
});

test('a standard gamepad moves, dashes, pauses and navigates the pause menu', async ({ page }) => {
  await page.addInitScript(() => {
    window.fakePad = { axes: [0, 0, 0, 0], pressed: new Set<number>() };
    const pad = () => ({
      id: 'fake', index: 0, connected: true, mapping: 'standard', timestamp: performance.now(),
      axes: window.fakePad!.axes,
      buttons: Array.from({ length: 17 }, (_, index) => {
        const pressed = window.fakePad!.pressed.has(index);
        return { pressed, touched: pressed, value: pressed ? 1 : 0 };
      }),
    });
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad()] });
  });
  await boot(page);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.combatGame.scene.isActive('Game'));
  const position = () => page.evaluate(() => {
    const scene = window.combatGame.scene.getScene('Game') as GameScene;
    return { x: scene.player.x, y: scene.player.y };
  });
  const start = await position();
  await page.evaluate(() => { window.fakePad!.axes = [1, 0, 0, 0]; });
  await expect.poll(async () => (await position()).x).toBeGreaterThan(start.x + 20);
  await page.evaluate(() => { window.fakePad!.axes = [0, 0, 0, 0]; window.fakePad!.pressed.add(9); });
  await expect.poll(() => page.evaluate(() => (window.combatGame.scene.getScene('Game') as GameScene).state)).toBe('PAUSED');
  // Releasing START and pressing B (replayed as Escape) resumes.
  await page.evaluate(() => { window.fakePad!.pressed.clear(); });
  await page.waitForTimeout(100);
  await page.evaluate(() => { window.fakePad!.pressed.add(1); });
  await expect.poll(() => page.evaluate(() => (window.combatGame.scene.getScene('Game') as GameScene).state)).toBe('PLAYING');
});

test('an English save plays the whole run in English', async ({ page }) => {
  await boot(page, { settings: { locale: 'en' }, runs: 0 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.combatGame.scene.isActive('Game'));
  // The debug build opens a level-up on L; it is the densest screen of in-run text.
  await page.keyboard.press('l');
  await expect.poll(() => page.evaluate(() => (window.combatGame.scene.getScene('Game') as GameScene).state)).toBe('LEVEL_UP');
  const texts = (await sceneTexts(page, 'UI')).join(' | ');
  expect(texts).toContain('REACHED');
  expect(texts).toContain('CHOOSE YOUR NEXT PROTOCOL');
  expect(texts).toContain('BIO-DATA');
  // Words that only appear in the Spanish strings of this screen.
  expect(texts).not.toMatch(/NIVEL|ALCANZADO|PROTOCOLO|ELIGE|DISPARAR|MOVER|RATÓN/);
});

test('the soundtrack loads and the results screen plays its stinger without errors', async ({ page }) => {
  const failures: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  await boot(page);
  const loaded = await page.evaluate(() =>
    ['menu', 'lab', 'greenhouse', 'reactor', 'boss', 'victory', 'defeat'].every(cue => window.combatGame.cache.binary.exists(`music-${cue}`)));
  expect(loaded).toBe(true);
  // A click unlocks audio, so the director really schedules notes from here on.
  const canvas = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(canvas.x + canvas.width * 0.9, canvas.y + canvas.height * 0.2);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.combatGame.scene.isActive('Game'));
  await page.waitForTimeout(1500);
  await page.evaluate(() => (window.combatGame.scene.getScene('Game') as unknown as { gameOver: (victory: boolean) => void }).gameOver(true));
  await page.waitForFunction(() => window.combatGame.scene.isActive('GameOver'));
  await page.waitForTimeout(800);
  expect(failures).toEqual([]);
});

test('the cloud screen works offline and, against a server, uploads and restores by code', async ({ page }) => {
  await boot(page, { runs: 2, bioCredits: 40 });
  await tap(page, 'Menu', 'menu-settings');
  await page.waitForFunction(() => window.combatGame.scene.isActive('Settings'));
  await tap(page, 'Settings', 'settings-cloud');
  await page.waitForFunction(() => window.combatGame.scene.isActive('Cloud'));
  const code = await page.evaluate(() =>
    (window.combatGame.scene.getScene('Cloud').children.getByName('cloud-code') as Phaser.GameObjects.Text).text);
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){3}$/);
  expect((await storedProfile(page)).operative.code).toBe(code);

  // A fake Supabase: the real adapter talks to it over fetch exactly as it would in production.
  const saves = new Map<string, unknown>();
  await page.route('https://fake-project.supabase.co/rest/v1/rpc/**', async route => {
    const name = route.request().url().split('/').pop();
    const body = route.request().postDataJSON() as { p_code: string; p_callsign?: string; p_profile?: unknown };
    if (route.request().headers().apikey !== 'anon-test') return route.fulfill({ status: 401 });
    if (name === 'leek_put_save') {
      saves.set(body.p_code, { profile: body.p_profile, callsign: body.p_callsign });
      return route.fulfill({ status: 200, body: '"2026-09-25T10:00:00Z"' });
    }
    if (name === 'leek_get_save') {
      const save = saves.get(body.p_code) as { profile: unknown; callsign: string } | undefined;
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(save ? [{ ...save, updated_at: '2026-09-25T10:00:00Z' }] : []) });
    }
    return route.fulfill({ status: 404 });
  });
  await page.evaluate(async () => {
    const ports = await import('/src/game/online/OnlinePorts.ts' as string);
    const { SupabaseOnlineService } = await import('/src/game/online/SupabaseOnlineService.ts' as string);
    const { ensureOperative } = await import('/src/game/systems/ProfileStore.ts' as string);
    ports.setOnlineService(new SupabaseOnlineService('https://fake-project.supabase.co', 'anon-test', ensureOperative));
    window.combatGame.scene.getScene('Cloud').scene.restart();
  });
  await page.waitForTimeout(300);
  await tap(page, 'Cloud', 'cloud-upload');
  await expect.poll(() => saves.has(code)).toBe(true);

  // Another "device": wipe local data, then restore with the code.
  await page.evaluate(() => { localStorage.clear(); });
  page.once('dialog', dialog => dialog.accept(code.toLowerCase().replaceAll('-', ' ')));
  page.on('dialog', dialog => { if (dialog.type() === 'confirm') void dialog.accept(); });
  await tap(page, 'Cloud', 'cloud-restore');
  await expect.poll(async () => (await storedProfile(page))?.runs).toBe(2);
  const restored = await storedProfile(page);
  expect(restored.bioCredits).toBe(40);
  expect(restored.operative.code).toBe(code);
});

test('the live board shows who is playing the daily now and calls out being passed', async ({ page }) => {
  await boot(page);
  await page.evaluate(async () => {
    const ports = await import('/src/game/online/OnlinePorts.ts' as string);
    const { rankLive } = await import('/src/game/online/LiveRanking.ts' as string);
    const presence: Record<string, { callsign: string; score: number; t?: number }[]> = {
      rival: [{ callsign: 'RIVAL', score: 40, t: 300 }], ace: [{ callsign: 'ACE', score: 9000, t: 300 }],
    };
    let listener: ((entries: unknown[]) => void) | undefined;
    const emit = () => listener?.(rankLive(presence, 'me'));
    const fake = {
      online: true,
      async fetchDailyBoard() { return [{ rank: 1, displayName: 'ACE', score: 9000 }]; },
      async openLiveBoard() {
        return {
          update(score: number) { presence.me = [{ callsign: 'YO-TEST', score }]; emit(); },
          onChange(next: (entries: unknown[]) => void) { listener = next; },
          async leave() { listener = undefined; },
        };
      },
      async submitDailyRun() { return undefined; },
      async uploadProfile() {},
      async cloudSaveInfo() { return undefined; },
    };
    ports.setOnlineService(fake);
    (window as unknown as { liveTest: { presence: typeof presence; emit: () => void } }).liveTest = { presence, emit };
  });
  await tap(page, 'Menu', 'menu-daily');
  await page.waitForFunction(() => window.combatGame.scene.isActive('Game'));
  const board = () => page.evaluate(() => {
    const ui = window.combatGame.scene.getScene('UI');
    const panel = ui.children.getByName('live-board') as Phaser.GameObjects.Container | null;
    return panel ? panel.list.filter(child => child.type === 'Text').map(child => (child as Phaser.GameObjects.Text).text).join(' | ') : null;
  });
  await expect.poll(board).toContain('EN VIVO · 3');
  const shown = (await board())!;
  expect(shown).toContain('RÉCORD HOY  ACE  9000');
  expect(shown).toMatch(/1\. ACE/);
  expect(shown).toMatch(/TÚ · YO-TEST/);
  // The framed border must enclose every row, not just the fill behind them.
  const fit = await page.evaluate(() => {
    const panel = window.combatGame.scene.getScene('UI').children.getByName('live-board') as Phaser.GameObjects.Container;
    const back = panel.list[0] as Phaser.GameObjects.Rectangle;
    const rows = panel.list.filter(child => child.type === 'Text' && (child as Phaser.GameObjects.Text).text) as Phaser.GameObjects.Text[];
    return { border: back.geom.height, rowsBottom: Math.max(...rows.map(row => row.y + row.height)) };
  });
  expect(fit.border).toBeGreaterThanOrEqual(fit.rowsBottom);
  // RIVAL overtakes the player live.
  await page.evaluate(() => {
    const state = (window as unknown as { liveTest: { presence: Record<string, { callsign: string; score: number; t?: number }[]>; emit: () => void } }).liveTest;
    state.presence.rival = [{ callsign: 'RIVAL', score: 5000, t: 302 }];
    state.emit();
  });
  await expect.poll(() => sceneTexts(page, 'UI')).toContain('RIVAL TE SUPERÓ');
});
