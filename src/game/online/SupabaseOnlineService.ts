import type { LeaderboardEntry, OnlineService } from './OnlinePorts';
import type { OperativeIdentity } from './OperativeIdentity';

/**
 * Supabase adapter for the online port. It talks to the RPC functions in
 * supabase/migrations/0001_leek_ops_online.sql over plain fetch with the project's public anon
 * key: no SDK, no auth session, and no table access (the tables are closed by RLS).
 *
 * Every call has a timeout and rejects on failure; callers treat the network as optional.
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
    try {
      const response = await this.fetchImpl(`${this.url.replace(/\/$/, '')}/rest/v1/rpc/${name}`, {
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
      if (!response.ok) throw new Error(`${name} failed: ${response.status}`);
      const text = await response.text();
      return (text ? JSON.parse(text) : null) as T;
    } finally {
      clearTimeout(timer);
    }
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

  async fetchLeaderboard() {
    return [] as const;
  }

  async submitDailyScore(date: string, score: number) {
    const { code, callsign } = this.identity();
    await this.rpc('leek_submit_daily', { p_code: code, p_callsign: callsign, p_day: date, p_score: Math.max(0, Math.floor(score)) });
  }

  async fetchDailyBoard(date: string): Promise<readonly LeaderboardEntry[]> {
    const rows = await this.rpc<{ rank: number; callsign: string; score: number }[]>('leek_daily_board', { p_day: date, p_limit: 10 });
    return (rows ?? []).map(row => ({ rank: Number(row.rank), displayName: row.callsign, score: row.score }));
  }

  async signOut() {
    // Identity is the code on the device; there is no server session to end.
  }
}
