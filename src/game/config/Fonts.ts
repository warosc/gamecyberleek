/**
 * The game's display face. "Arial Black" is not installed on iOS or Android, where every title,
 * button and HUD label fell back to the browser's default serif. LeekDisplay (src/style.css)
 * resolves to Arial Black where the system has it and to Arial Bold or Helvetica Neue Bold
 * elsewhere, all system fonts, so nothing is downloaded and the game stays offline-capable.
 * The plain names after it only matter if the face never loads. Every use also asks for bold,
 * so even a plain Arial fallback stays heavy instead of thin.
 */
export const DISPLAY_FONT = 'LeekDisplay, "Arial Black", Arial, sans-serif';

/**
 * Phaser draws text into a canvas once, with whatever face is ready at that moment. A face the
 * page has not used yet loads lazily, so the first scenes would render in the fallback; this
 * waits for it before the game starts, but never longer than `timeoutMs`.
 */
export async function loadDisplayFont(timeoutMs = 1500) {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  await Promise.race([
    document.fonts.load('bold 16px LeekDisplay').catch(() => undefined),
    new Promise(resolve => setTimeout(resolve, timeoutMs)),
  ]);
}
