import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());

describe('PWA shell', () => {
  it('declares installable square icons and production cache version', () => {
    const manifest = JSON.parse(readFileSync(resolve(root, 'public/manifest.webmanifest'), 'utf8')) as {
      icons: Array<{ src: string; sizes: string }>;
    };
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: '/assets/character/leek/icon-192.png', sizes: '192x192' }),
      expect.objectContaining({ src: '/assets/character/leek/icon-512.png', sizes: '512x512' }),
    ]));
    expect(readFileSync(resolve(root, 'public/sw.js'), 'utf8')).toContain("leek-ops-v3");
  });
});
