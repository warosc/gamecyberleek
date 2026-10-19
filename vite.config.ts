import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const DEV_LOG_FILE = '.devlog.log';

/** Dev-only: records browser runtime samples and uncaught errors into .devlog.log. */
function devLogBridge(): Plugin {
  return {
    name: 'leek-dev-log-bridge',
    apply: 'serve',
    configureServer(server) {
      writeFileSync(DEV_LOG_FILE, `--- dev log started ---\n`);
      server.middlewares.use('/__devlog', (request, response) => {
        if (request.method !== 'POST') {
          response.statusCode = 405;
          return response.end();
        }
        let body = '';
        request.on('data', (chunk) => (body += chunk));
        request.on('end', () => {
          try {
            const entry = JSON.parse(body) as Record<string, unknown>;
            const { kind, ...rest } = entry;
            const details = Object.entries(rest)
              .map(([key, value]) => `${key}=${value}`)
              .join(' ');
            appendFileSync(DEV_LOG_FILE, `[${String(kind)}] ${details}\n`);
          } catch {
            appendFileSync(DEV_LOG_FILE, `[raw] ${body}\n`);
          }
          response.statusCode = 204;
          response.end();
        });
      });
    },
  };
}

export const SW_BUILD_PLACEHOLDER = '__LEEK_BUILD__';

/** Writes the build version into the copied service worker; fails loudly if the marker is gone. */
export function stampServiceWorker(outDir: string, build: string): void {
  const file = join(outDir, 'sw.js');
  const source = readFileSync(file, 'utf8');
  // Exactly one: a missing marker would ship a constant cache name again, and a second one
  // means something other than the cache name would be rewritten.
  if (source.split(SW_BUILD_PLACEHOLDER).length !== 2) {
    throw new Error(`${file} must contain ${SW_BUILD_PLACEHOLDER} exactly once`);
  }
  writeFileSync(file, source.replace(SW_BUILD_PLACEHOLDER, build));
}

/** "<package version>-<short sha>-<build time>": unique per build, traceable to a commit. */
function buildVersion(): string {
  const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
  let sha = 'nogit';
  try {
    sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    // Dockerfile.prod builds without .git; the timestamp alone still makes the cache unique.
  }
  return `${version}-${sha}-${Date.now().toString(36)}`;
}

/**
 * Build-only: public/sw.js is copied verbatim, so its cache name is stamped after the bundle is
 * written. A deploy that kept the old name kept serving the old cache to offline players.
 */
function serviceWorkerVersion(): Plugin {
  let outDir = 'dist';
  return {
    name: 'leek-sw-version',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      stampServiceWorker(outDir, buildVersion());
    },
  };
}

export default defineConfig({
  plugins: [devLogBridge(), serviceWorkerVersion()],
  server: { host: '0.0.0.0', port: 5173 },
  preview: { host: '0.0.0.0', port: 4173 },
  build: {
    rollupOptions: {
      // Phaser changes far less often than the game: in its own chunk it stays cached across
      // game deploys, and the game chunk a returning player downloads is a fraction of the size.
      output: { manualChunks: { phaser: ['phaser'] } },
    },
    // Phaser alone is ~1.4 MB minified (~370 KB gzip); that chunk is expected and cached long-term.
    chunkSizeWarningLimit: 1450,
  },
  // tests/e2e belongs to Playwright, which drives a real browser; vitest runs in node and
  // cannot load @playwright/test.
  test: { include: ['tests/**/*.test.ts'], exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**'] },
});
