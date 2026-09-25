import { expect, test } from '@playwright/test';

test('shows immediate branded loading progress until the Phaser menu is ready', async ({ page }) => {
  await page.route('**/assets/ui/menu-backdrop.png', async route => {
    await new Promise(resolve => setTimeout(resolve, 700));
    await route.continue();
  });
  await page.goto('/');
  const splash = page.locator('#boot-splash');
  await expect(splash).toBeVisible();
  await expect(splash).toContainText('CYBERLEEK');
  await expect(page.locator('#boot-progress')).toBeVisible();
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.scene === 'Preload');
  // The first progress event can land a moment after Preload starts, so wait for the bar to move
  // while the delayed backdrop still holds the load open.
  await expect.poll(() => page.evaluate(() => parseFloat((document.querySelector('#boot-progress') as HTMLElement).style.width) || 0))
    .toBeGreaterThan(3);
  const duringLoad = await page.evaluate(() => ({
    status: document.querySelector('#boot-status')?.textContent,
    reducedMotionRule: [...document.styleSheets].some(sheet => {
      try { return [...sheet.cssRules].some(rule => rule.cssText.includes('prefers-reduced-motion')); }
      catch { return false; }
    }),
  }));
  expect(duringLoad.status).toBeTruthy();
  expect(duringLoad.reducedMotionRule).toBe(true);
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.scene === 'Menu');
  await expect(splash).toHaveAttribute('aria-hidden', 'true');
  await expect(splash).toHaveClass(/boot-complete/);
});
