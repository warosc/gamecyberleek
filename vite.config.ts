import { appendFileSync, writeFileSync } from 'node:fs';
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

export default defineConfig({
  plugins: [devLogBridge()],
  server: { host: '0.0.0.0', port: 5173 },
  preview: { host: '0.0.0.0', port: 4173 },
  // tests/e2e belongs to Playwright, which drives a real browser; vitest runs in node and
  // cannot load @playwright/test.
  test: { exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**'] },
});
