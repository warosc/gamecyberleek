import {
  OnlineError, type CloudSaveInfo, type DailyRunFacts, type LeaderboardEntry, type OnlineService,
} from './OnlinePorts';
import type { OperativeIdentity } from './OperativeIdentity';
import type { LiveBoardSession, LiveEntry } from './LiveRanking';

/** Live reports are throttled: the board only needs to feel live, not be exact. */
const LIVE_UPDATE_MS = 1500;
/** How often the live board is read back; rows expire on the server 20 s after their last report. */
const LIVE_POLL_MS = 2500;

/**
 * A random per-session presence key. crypto.randomUUID exists only in secure contexts, and the
 * game is also served over plain HTTP, so this uses getRandomValues, which is always there.
 */
export function livePresenceKey() {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Adapter for the game's own online API: PostgREST in front of Postgres on the VPS, serving the
 * RPC functions in supabase/migrations at `<baseUrl>/rpc/<name>`. The base is normally the
 * same-origin path `/online`, so there is no CORS and no key: the tables are closed to the anon role
 * and only those functions are callable.
 *
 * Every call has a timeout and rejects with an OnlineError; callers treat the network as optional.
 */
export class RestOnlineService implements OnlineService {
  readonly online = true;

  constructor(
    private readonly baseUrl: string,
    private readonly identity: () => OperativeIdentity,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
    private readonly timeoutMs = 8000,
  ) {}

  private async rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    let text: string;
    try {
      response = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}/rpc/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      // The body is read under the same timeout: a response whose body never arrives would
      // otherwise leave the caller waiting forever, and OnlineSync's queue with it.
      text = await response.text();
    } catch (error) {
      throw new OnlineError(0, `${name}: ${error instanceof Error ? error.message : 'network error'}`);
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) {
      let message = `${name} failed: ${response.status}`;
      try { message = (JSON.parse(text) as { message?: string }).message ?? message; } catch { /* keep default */ }
      throw new OnlineError(response.status, message);
    }
    return (text ? JSON.parse(text) : null) as T;
  }

  async signIn() {
    const { callsign } = this.identity();
    return { userId: 'operative', displayName: callsign, expiresAt: Number.POSITIVE_INFINITY };
  }

  async uploadProfile(profile: object) {
    const { code, callsign } = this.identity();
    // The code is the key to the cloud slot; it must never travel inside the stored save, where
    // anyone who could read the table would get every player's key.
    const stored: Record<string, unknown> = { ...profile };
    delete stored.operative;
    await this.rpc('leek_put_save', { p_code: code, p_callsign: callsign, p_profile: stored });
  }

  async downloadProfile(code: string) {
    const rows = await this.rpc<{ profile: unknown; callsign: string; updated_at: string }[]>('leek_get_save', { p_code: code });
    const row = rows?.[0];
    return row ? { profile: row.profile, callsign: row.callsign, updatedAt: row.updated_at } : undefined;
  }

  async cloudSaveInfo(code: string): Promise<CloudSaveInfo | undefined> {
    const rows = await this.rpc<{ runs: number; updated_at: string }[]>('leek_save_info', { p_code: code });
    const row = rows?.[0];
    return row ? { runs: row.runs, updatedAt: row.updated_at } : undefined;
  }

  async fetchLeaderboard() {
    return [] as const;
  }

  async startDailyRun(date: string) {
    try {
      return await this.rpc<string>('leek_start_daily_run', { p_code: this.identity().code, p_day: date }) ?? undefined;
    } catch (error) {
      // 404: the server predates run tickets (migration 0003); the run is posted the old way.
      if (error instanceof OnlineError && error.status === 404) return undefined;
      throw error;
    }
  }

  async submitDailyRun(date: string, run: DailyRunFacts) {
    const { code, callsign } = this.identity();
    return this.rpc<number>('leek_submit_daily_run', {
      ...(run.ticket ? { p_ticket: run.ticket } : {}),
      p_code: code, p_callsign: callsign, p_day: date,
      p_kills: Math.max(0, Math.floor(run.kills)), p_level: Math.max(1, Math.floor(run.level)),
      p_duration_ms: Math.max(0, Math.floor(run.durationMs)), p_victory: run.victory,
    });
  }

  async fetchDailyBoard(date: string): Promise<readonly LeaderboardEntry[]> {
    const rows = await this.rpc<{ rank: number; callsign: string; score: number }[]>('leek_daily_board', { p_day: date, p_limit: 10 });
    return (rows ?? []).map(row => ({ rank: Number(row.rank), displayName: row.callsign, score: row.score }));
  }

  async openLiveBoard(date: string): Promise<LiveBoardSession | undefined> {
    // A random key per run: the board is public, so it must never carry the operative code.
    const key = livePresenceKey();
    const { callsign } = this.identity();
    const listeners: ((entries: LiveEntry[]) => void)[] = [];
    let open = true;
    let pending: { score: number; seconds: number } | undefined;
    let lastSentAt = 0;
    let sendTimer: ReturnType<typeof setTimeout> | undefined;

    const send = () => {
      sendTimer = undefined;
      if (!open || !pending) return;
      const { score, seconds } = pending;
      pending = undefined;
      lastSentAt = Date.now();
      // The server checks run time against real time and the score against its ceiling; a
      // rejected or failed report only leaves this player's row as it was.
      void this.rpc('leek_live_update', { p_day: date, p_key: key, p_callsign: callsign, p_score: score, p_seconds: seconds })
        .catch(() => undefined);
    };
    const poll = () => {
      void this.rpc<{ id: string; callsign: string; score: number; self: boolean }[]>('leek_live_board', { p_day: date, p_key: key })
        .then(rows => {
          if (!open) return;
          const entries = (rows ?? []).map(row => ({ id: row.id, callsign: row.callsign, score: row.score, self: row.self }));
          for (const listener of listeners) listener(entries);
        })
        .catch(() => undefined);
    };
    poll();
    const pollTimer = setInterval(poll, LIVE_POLL_MS);

    return {
      update(score: number, seconds: number) {
        pending = { score: Math.max(0, Math.floor(score)), seconds: Math.max(0, Math.floor(seconds)) };
        if (sendTimer) return;
        sendTimer = setTimeout(send, Math.max(0, LIVE_UPDATE_MS - (Date.now() - lastSentAt)));
      },
      onChange(listener) {
        listeners.push(listener);
      },
      // Nothing to tell the server: a row that stops reporting drops off the board after 20 s.
      async leave() {
        open = false;
        clearInterval(pollTimer);
        if (sendTimer) clearTimeout(sendTimer);
        listeners.length = 0;
      },
    };
  }

  async signOut() {
    // Identity is the code on the device; there is no server session to end.
  }
}
