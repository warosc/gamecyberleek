/**
 * Development-only bridge that forwards runtime samples and uncaught errors from the
 * browser to the Vite dev server terminal. Completely inert unless VITE_DEBUG_GAME is
 * enabled, and never bundled into a production run because every call site is gated.
 */

const ENDPOINT = '/__devlog';

export interface PerfSample {
  runSeconds: number;
  fps: number;
  worstFrameMs: number;
  displayObjects: number;
  tweens: number;
  enemies: number;
  projectiles: number;
  orbs: number;
  rig: 'layered' | 'fallback';
  animation: string;
}

export const devTelemetryEnabled = import.meta.env.DEV && import.meta.env.VITE_DEBUG_GAME === 'true';

/** Distinguishes concurrent devices (phone vs desktop) sharing one dev server log. */
const SESSION_ID = Math.random().toString(36).slice(2, 7);

function send(payload: Record<string, unknown>) {
  if (!devTelemetryEnabled) return;
  payload.dev = SESSION_ID;
  // keepalive lets the final sample survive a tab close or a hard freeze recovery.
  void fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => undefined);
}

let lastSampleAt = 0;
let worstSeen = 0;

export function reportPerf(sample: PerfSample) {
  if (!devTelemetryEnabled) return;
  const now = performance.now();
  const spike = sample.worstFrameMs >= 120 && sample.worstFrameMs > worstSeen;
  if (spike) worstSeen = sample.worstFrameMs;
  // One line per second, plus an immediate line whenever a new worst-ever stall appears.
  if (!spike && now - lastSampleAt < 1000) return;
  lastSampleAt = now;
  send({ kind: spike ? 'spike' : 'perf', ...sample });
}

/** Reports how much of the screen the canvas actually occupies, for mobile layout work. */
export function reportViewport(tag: string) {
  if (!devTelemetryEnabled) return;
  const canvas = document.querySelector('canvas');
  const box = canvas?.getBoundingClientRect();
  send({
    kind: 'viewport',
    tag,
    window: `${window.innerWidth}x${window.innerHeight}`,
    screen: `${window.screen.width}x${window.screen.height}`,
    canvasCss: box ? `${Math.round(box.width)}x${Math.round(box.height)}` : 'none',
    canvasAttr: canvas ? `${canvas.width}x${canvas.height}` : 'none',
    // How much of the visible viewport the canvas covers. Low means bars or a bad fit.
    coverage: box
      ? `${Math.round((100 * (box.width * box.height)) / (window.innerWidth * window.innerHeight))}%`
      : '0%',
    dpr: window.devicePixelRatio,
  });
}

export function installDevTelemetry() {
  if (!devTelemetryEnabled) return;
  window.addEventListener('error', (event) => {
    send({
      kind: 'error',
      message: event.message,
      source: `${event.filename}:${event.lineno}:${event.colno}`,
      stack: event.error instanceof Error ? event.error.stack : undefined,
    });
  });
  window.addEventListener('unhandledrejection', (event) => {
    send({
      kind: 'rejection',
      message: String(event.reason),
      stack: event.reason instanceof Error ? event.reason.stack : undefined,
    });
  });
  // A lost WebGL context freezes rendering without throwing, and is a common way for a
  // mobile GPU to bail out under memory pressure. Captured because it does not bubble.
  window.addEventListener(
    'webglcontextlost',
    () => send({ kind: 'error', message: 'WebGL context lost' }),
    true,
  );

  const screen = `${window.screen.width}x${window.screen.height}@${window.devicePixelRatio}`;
  send({
    kind: 'session',
    screen,
    touch: navigator.maxTouchPoints,
    cores: navigator.hardwareConcurrency ?? '?',
    memoryGb: (navigator as { deviceMemory?: number }).deviceMemory ?? '?',
    ua: navigator.userAgent.slice(0, 90),
  });
}
