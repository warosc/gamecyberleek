import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import config, { SW_BUILD_PLACEHOLDER, stampServiceWorker } from '../vite.config';

const root = resolve(process.cwd());
const source = readFileSync(resolve(root, 'public/sw.js'), 'utf8');

type FetchEvent = { request: Request; respondWith: (response: Promise<Response>) => void };

// Response objects built in node report type "default"; the browser's same-origin responses are
// "basic", opaque cross-origin ones "opaque".
const withType = (response: Response, type = 'basic') => Object.defineProperty(response, 'type', { value: type });

/** Runs public/sw.js against stand-ins for the worker globals and records what it caches. */
function loadWorker(network: () => Promise<Response>, put?: () => Promise<void>) {
  const stored: string[] = [];
  const listeners: Record<string, (event: FetchEvent) => void> = {};
  const cache = {
    put: put ?? (async (request: Request) => void stored.push(request.url)),
    addAll: async () => undefined,
  };
  const caches = { open: async () => cache, match: async () => undefined, keys: async () => [], delete: async () => true };
  const self = {
    location: { origin: 'https://game.test' },
    addEventListener: (type: string, listener: (event: FetchEvent) => void) => (listeners[type] = listener),
  };
  new Function('self', 'caches', 'fetch', source)(self, caches, network);
  return { stored, dispatchFetch: (event: FetchEvent) => listeners.fetch(event) };
}

describe('PWA shell', () => {
  it('declares installable square icons', () => {
    const manifest = JSON.parse(readFileSync(resolve(root, 'public/manifest.webmanifest'), 'utf8')) as {
      icons: Array<{ src: string; sizes: string }>;
    };
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: '/assets/character/leek/icon-192.png', sizes: '192x192' }),
      expect.objectContaining({ src: '/assets/character/leek/icon-512.png', sizes: '512x512' }),
    ]));
  });

  // The cache name used to be a hand-bumped literal; a forgotten bump kept players on the old
  // cache. Now the build stamps it, so the test pins the mechanism instead of a version.
  it('stamps a per-build cache name into the emitted service worker', () => {
    const worker = source;
    expect(worker).toContain(`const CACHE = 'leek-ops-${SW_BUILD_PLACEHOLDER}';`);
    expect(worker.split(SW_BUILD_PLACEHOLDER)).toHaveLength(2);

    const plugins = (config as { plugins: Array<{ name: string; apply?: string }> }).plugins;
    expect(plugins).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'leek-sw-version', apply: 'build' })]));

    const outDir = mkdtempSync(join(tmpdir(), 'leek-sw-'));
    try {
      copyFileSync(resolve(root, 'public/sw.js'), join(outDir, 'sw.js'));
      stampServiceWorker(outDir, '0.2.0-abc1234-xyz');
      const stamped = readFileSync(join(outDir, 'sw.js'), 'utf8');
      expect(stamped).toContain("const CACHE = 'leek-ops-0.2.0-abc1234-xyz';");
      expect(stamped).not.toContain(SW_BUILD_PLACEHOLDER);
      // Stamping twice, or a worker that lost its marker, must fail the build rather than ship
      // a constant cache name.
      expect(() => stampServiceWorker(outDir, 'again')).toThrow(SW_BUILD_PLACEHOLDER);
      writeFileSync(join(outDir, 'sw.js'), `${worker}\n// ${SW_BUILD_PLACEHOLDER}\n`);
      expect(() => stampServiceWorker(outDir, 'twice')).toThrow(SW_BUILD_PLACEHOLDER);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('caches only complete same-origin responses and leaves the backend alone', async () => {
    const respond = async (url: string, response: Response, type = 'basic') => {
      const worker = loadWorker(async () => withType(response, type));
      let responded: Promise<Response> | undefined;
      worker.dispatchFetch({ request: new Request(url), respondWith: (promise) => (responded = promise) });
      await responded;
      await new Promise((settle) => setTimeout(settle, 0));
      return { responded, stored: worker.stored };
    };

    expect((await respond('https://game.test/assets/a.png', new Response('ok'))).stored).toEqual(['https://game.test/assets/a.png']);
    // A 404/503 mid-deploy, a range response, an opaque one: served, never cached.
    expect((await respond('https://game.test/assets/a.png', new Response('gone', { status: 404 }))).stored).toEqual([]);
    expect((await respond('https://game.test/assets/a.png', new Response('down', { status: 503 }))).stored).toEqual([]);
    expect((await respond('https://game.test/music.mid', new Response('part', { status: 206 }))).stored).toEqual([]);
    expect((await respond('https://game.test/x', new Response('ok'), 'opaque')).stored).toEqual([]);
    // Supabase is not intercepted at all, so it is neither cached nor replayed offline.
    const backend = await respond('https://example.supabase.co/rest/v1/runs', new Response('[]'));
    expect(backend.responded).toBeUndefined();
    expect(backend.stored).toEqual([]);
  });

  it('swallows a failed cache write instead of raising an unhandled rejection', async () => {
    const worker = loadWorker(async () => withType(new Response('ok')), () => Promise.reject(new Error('quota')));
    const unhandled: unknown[] = [];
    const track = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', track);
    try {
      let responded: Promise<Response> | undefined;
      worker.dispatchFetch({ request: new Request('https://game.test/a.js'), respondWith: (promise) => (responded = promise) });
      expect((await responded!).status).toBe(200);
      await new Promise((settle) => setTimeout(settle, 10));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', track);
    }
  });

  it('serves an offline page for navigations with no network and no cache', () => {
    const worker = readFileSync(resolve(root, 'public/sw.js'), 'utf8');
    expect(worker).toContain("'/offline.html'");
    expect(worker).toMatch(/mode === 'navigate'/);
    const page = readFileSync(resolve(root, 'public/offline.html'), 'utf8');
    expect(page).toContain('location.reload()');
  });
});
