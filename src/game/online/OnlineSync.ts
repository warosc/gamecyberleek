import { OnlineError, type DailyRunFacts, type OnlineService } from './OnlinePorts';

/**
 * Daily runs that could not reach the server wait here and are retried later, so a dropped
 * connection at the end of a run does not lose the score. Bounded and local-only.
 */
const KEY = 'leek-ops-pending-daily-v1';
const MAX_PENDING = 10;

export interface PendingDailyRun {
  date: string;
  run: DailyRunFacts;
}

function read(): PendingDailyRun[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((entry): entry is PendingDailyRun =>
      Boolean(entry) && typeof entry.date === 'string' && typeof entry.run === 'object' && entry.run !== null) : [];
  } catch {
    return [];
  }
}

function write(entries: PendingDailyRun[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX_PENDING)));
  } catch {
    // Storage unavailable: the retry is a convenience, never a requirement.
  }
}

export function pendingDailyRuns() {
  return read();
}

let flushing: Promise<void> | undefined;

/**
 * Submits the queued runs oldest first, spaced past the server's per-operative rate limit.
 * Transient failures (network, 429, 5xx) stay queued; permanent ones (a run the server rejects
 * as implausible, or a day that has closed) are dropped so they cannot block the queue.
 */
export function flushDailyRuns(service: OnlineService, spacingMs = 3200): Promise<void> {
  if (!service.online) return Promise.resolve();
  if (flushing) return flushing;
  // The reset is chained after the assignment on purpose: with an empty queue the body finishes
  // synchronously, and a reset inside it would run first and leave `flushing` stuck forever.
  flushing = (async () => {
    let queue = read();
    while (queue.length) {
      const [next, ...rest] = queue;
      try {
        await service.submitDailyRun(next.date, next.run);
      } catch (error) {
        if (!(error instanceof OnlineError) || error.isTransient) return;
      }
      queue = rest;
      write(queue);
      if (queue.length) await new Promise(resolve => setTimeout(resolve, spacingMs));
    }
  })().finally(() => {
    flushing = undefined;
  });
  return flushing;
}

/** Queues a finished daily run and tries to send everything pending. */
export function submitDailyRun(service: OnlineService, date: string, run: DailyRunFacts) {
  if (!service.online) return Promise.resolve();
  write([...read(), { date, run }]);
  return flushDailyRuns(service);
}
