import {
  OnlineError, type CloudSaveInfo, type DailyRunFacts, type LeaderboardEntry, type OnlineService,
} from './OnlinePorts';
import type { OperativeIdentity } from './OperativeIdentity';
import { rankLive, type LiveBoardSession, type LiveEntry } from './LiveRanking';

/** Presence updates are throttled: the live board only needs to feel live, not be exact. */
const LIVE_UPDATE_MS = 1500;

/**
 * Supabase adapter for the online port. It talks to the RPC functions in supabase/migrations
 * over plain fetch with the project's public key: no SDK for data, no auth session, and no table
 * access (the tables are closed by RLS). The live board uses Realtime presence, loaded on demand
 * so offline players never download it.
 *
 * Every call has a timeout and rejects with an OnlineError; callers treat the network as optional.
 */
export class SupabaseOnlineService implements OnlineService {
  readonly online = true;

  constructor(
    private readonly url: string,
    private readonly anonKey: string,
    private readonly identity: () => OperativeIdentity,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
    private readonly timeoutMs = 8000,
  ) {}

  private async rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.url.replace(/\/$/, '')}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: {
          apikey: this.anonKey,
          // Legacy anon keys are JWTs and also go in Authorization; publishable keys
          // (sb_publishable_...) are not JWTs and belong in the apikey header only.
          ...(this.anonKey.startsWith('eyJ') ? { Authorization: `Bearer ${this.anonKey}` } : {}),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      throw new OnlineError(0, `${name}: ${error instanceof Error ? error.message : 'network error'}`);
    } finally {
      clearTimeout(timer);
    }
    const text = await response.text();
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
    await this.rpc('leek_put_save', { p_code: code, p_callsign: callsign, p_profile: profile });
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

  async submitDailyRun(date: string, run: DailyRunFacts) {
    const { code, callsign } = this.identity();
    return this.rpc<number>('leek_submit_daily_run', {
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
    const { RealtimeClient } = await import('@supabase/realtime-js');
    const client = new RealtimeClient(`${this.url.replace(/\/$/, '')}/realtime/v1`, { params: { apikey: this.anonKey } });
    // A random per-session key: presence is public, so it must never carry the operative code.
    const selfId = globalThis.crypto.randomUUID();
    const channel = client.channel(`leek-daily-${date}`, { config: { presence: { key: selfId } } });
    const listeners: ((entries: LiveEntry[]) => void)[] = [];
    const { callsign } = this.identity();
    let subscribed = false;
    let pending: number | undefined;
    let sentScore = -1;
    let lastSentAt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const send = () => {
      timer = undefined;
      if (!subscribed || pending === undefined || pending === sentScore) return;
      sentScore = pending;
      lastSentAt = Date.now();
      void channel.track({ callsign, score: pending }).catch(() => undefined);
    };
    channel.on('presence', { event: 'sync' }, () => {
      const entries = rankLive(channel.presenceState() as Record<string, { callsign?: unknown; score?: unknown }[]>, selfId);
      for (const listener of listeners) listener(entries);
    });
    channel.subscribe(status => {
      if (status === 'SUBSCRIBED') {
        subscribed = true;
        if (pending === undefined) pending = 0;
        send();
      }
    });

    return {
      update(score: number) {
        pending = Math.max(0, Math.floor(score));
        if (timer) return;
        timer = setTimeout(send, Math.max(0, LIVE_UPDATE_MS - (Date.now() - lastSentAt)));
      },
      onChange(listener) {
        listeners.push(listener);
      },
      async leave() {
        if (timer) clearTimeout(timer);
        listeners.length = 0;
        try {
          await client.removeChannel(channel);
        } finally {
          client.disconnect();
        }
      },
    };
  }

  async signOut() {
    // Identity is the code on the device; there is no server session to end.
  }
}
