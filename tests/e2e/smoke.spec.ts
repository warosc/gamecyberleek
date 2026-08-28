import { test, expect, type Page } from '@playwright/test';

/**
 * The four defects that froze this game all threw inside a Phaser callback, which stops
 * `requestAnimationFrame` for good. Unit tests could not see any of them, and one was
 * reachable only on WebKit. This suite boots the real game and plays it.
 *
 * Liveness is read from the telemetry the game already posts once per second: if the loop
 * dies, `runSeconds` stops advancing. That also detects a silent freeze, such as a lost
 * WebGL context, which throws nothing at all.
 */

const LOGICAL = { width: 1280, height: 720 };
const DEPLOY_BUTTON = { x: 245, y: 425 };
/** Level-up and chest modals both put their middle card here. */
const MIDDLE_CARD = { x: 640, y: 360 };

interface Telemetry {
  runSeconds: number[];
  failures: string[];
}

function watch(page: Page): Telemetry {
  const telemetry: Telemetry = { runSeconds: [], failures: [] };

  page.on('pageerror', (error) => telemetry.failures.push(`pageerror: ${error.message}`));

  page.on('request', (request) => {
    if (!request.url().endsWith('/__devlog')) return;
    const body = request.postData();
    if (!body) return;
    let entry: { kind?: string; runSeconds?: number; message?: string };
    try {
      entry = JSON.parse(body);
    } catch {
      return;
    }
    if (entry.kind === 'perf' && typeof entry.runSeconds === 'number') {
      telemetry.runSeconds.push(entry.runSeconds);
    } else if (entry.kind === 'error' || entry.kind === 'rejection') {
      telemetry.failures.push(`${entry.kind}: ${entry.message}`);
    }
  });

  return telemetry;
}

/** Maps a logical game coordinate to a page coordinate through the scaled canvas. */
async function canvasMapper(page: Page) {
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas has no bounding box');
  return (x: number, y: number) => ({
    x: box.x + (x / LOGICAL.width) * box.width,
    y: box.y + (y / LOGICAL.height) * box.height,
  });
}

test('boots, survives a run, and redeploys without killing the game loop', async ({ page }) => {
  const telemetry = watch(page);
  await page.goto('/');

  const at = await canvasMapper(page);

  // MenuScene: DEPLOY.
  const deploy = at(DEPLOY_BUTTON.x, DEPLOY_BUTTON.y);
  await page.mouse.click(deploy.x, deploy.y);

  await expect
    .poll(() => telemetry.runSeconds.length, { timeout: 20_000, message: 'run never started' })
    .toBeGreaterThan(0);

  // Play blind. Clicking the middle card position selects a level-up or chest reward when a
  // modal is open and is a harmless shot otherwise, so no test-only hook is needed. ENTER
  // redeploys on the Game Over screen and does nothing during play.
  const centre = at(MIDDLE_CARD.x, MIDDLE_CARD.y);
  for (let tick = 0; tick < 60; tick++) {
    const angle = (tick / 60) * Math.PI * 2;
    const aim = at(640 + Math.cos(angle) * 260, 360 + Math.sin(angle) * 200);
    await page.mouse.move(aim.x, aim.y);
    await page.mouse.down();
    await page.waitForTimeout(120);
    await page.mouse.up();
    await page.mouse.click(centre.x, centre.y);
    if (tick % 6 === 5) await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
  }

  expect(telemetry.failures, telemetry.failures.join('\n')).toEqual([]);

  // Liveness: the loop must still be advancing at the end, not stuck on a frozen frame.
  const before = telemetry.runSeconds.length;
  await page.waitForTimeout(4_000);
  expect(telemetry.runSeconds.length, 'telemetry stopped: the game loop is frozen').toBeGreaterThan(
    before,
  );
});

test('starts a fresh run after the player dies', async ({ page }) => {
  const telemetry = watch(page);
  await page.goto('/');
  const at = await canvasMapper(page);

  const deploy = at(DEPLOY_BUTTON.x, DEPLOY_BUTTON.y);
  await page.mouse.click(deploy.x, deploy.y);
  await expect
    .poll(() => telemetry.runSeconds.length, { timeout: 20_000 })
    .toBeGreaterThan(0);

  // Stand still and take contact damage until the run ends, then redeploy. A restart shows up
  // as the run clock going backwards, which is precisely what the null-physics-world bug broke.
  const centre = at(MIDDLE_CARD.x, MIDDLE_CARD.y);
  const restarted = () =>
    telemetry.runSeconds.some((value, index) => index > 0 && value < telemetry.runSeconds[index - 1]);

  for (let tick = 0; tick < 90 && !restarted(); tick++) {
    await page.mouse.click(centre.x, centre.y);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(700);
  }

  expect(telemetry.failures, telemetry.failures.join('\n')).toEqual([]);
  expect(restarted(), 'never observed a second run: redeploy is broken').toBe(true);
});
