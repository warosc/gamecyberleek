import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CODE_PATTERN, generateCallsign, generateCode, normalizeCallsign, normalizeCode, normalizeIdentity,
} from '../src/game/online/OperativeIdentity';
import { SupabaseOnlineService } from '../src/game/online/SupabaseOnlineService';
import { OnlineError } from '../src/game/online/OnlinePorts';

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  clear() { this.store.clear(); }
  getItem(key: string) { return this.store.get(key) ?? null; }
  key(index: number) { return [...this.store.keys()][index] ?? null; }
  removeItem(key: string) { this.store.delete(key); }
  setItem(key: string, value: string) { this.store.set(key, value); }
}

describe('operative identity', () => {
  it('generates well-formed, unambiguous codes and callsigns', () => {
    const codes = new Set(Array.from({ length: 200 }, generateCode));
    expect(codes.size).toBe(200);
    for (const code of codes) {
      expect(code).toMatch(CODE_PATTERN);
      expect(code).not.toMatch(/[IO01]/);
    }
    expect(generateCallsign()).toMatch(/^OPERATIVO-\d{4}$/);
  });

  it('accepts codes as people type them and rejects anything else', () => {
    expect(normalizeCode('abcd efgh jkmn pqrs')).toBe('ABCD-EFGH-JKMN-PQRS');
    expect(normalizeCode('ABCDEFGHJKMNPQRS')).toBe('ABCD-EFGH-JKMN-PQRS');
    expect(normalizeCode('ABCD-EFGH-JKMN-PQR')).toBeUndefined();
    expect(normalizeCode('ABCD-EFGH-JKMN-PQRO')).toBeUndefined();
  });

  it('cleans callsigns to the server rule', () => {
    expect(normalizeCallsign('  Puerro veloz ')).toBe('PUERRO-VELOZ');
    expect(normalizeCallsign('ñ!')).toBeUndefined();
    expect(normalizeCallsign('A'.repeat(30))).toBe('A'.repeat(16));
    expect(normalizeIdentity({ code: 'x', callsign: 'OK-1' })).toBeUndefined();
  });
});

describe('supabase adapter', () => {
  const identity = { code: 'ABCD-EFGH-JKMN-PQRS', callsign: 'PUERRO-1' };
  const calls: { url: string; body: unknown; headers: Record<string, string> }[] = [];
  let reply: unknown = null;
  let status = 200;
  const fakeFetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)), headers: init.headers as Record<string, string> });
    return new Response(reply === null ? '' : JSON.stringify(reply), { status });
  }) as unknown as typeof fetch;
  const service = () => new SupabaseOnlineService('https://demo.supabase.co/', 'anon-key', () => identity, fakeFetch);

  beforeEach(() => { calls.length = 0; reply = null; status = 200; });

  it('sends run facts for the server to score, with the key only in apikey for publishable keys', async () => {
    reply = 3350;
    const best = await service().submitDailyRun('2026-09-25', { kills: 120.6, level: 9, durationMs: 200000.4, victory: false });
    expect(best).toBe(3350);
    expect(calls[0].url).toBe('https://demo.supabase.co/rest/v1/rpc/leek_submit_daily_run');
    expect(calls[0].headers.apikey).toBe('anon-key');
    expect(calls[0].headers.Authorization).toBeUndefined();
    expect(calls[0].body).toEqual({
      p_code: identity.code, p_callsign: 'PUERRO-1', p_day: '2026-09-25', p_kills: 120, p_level: 9, p_duration_ms: 200000, p_victory: false,
    });
  });

  it('adds the bearer header for legacy JWT anon keys', async () => {
    await new SupabaseOnlineService('https://demo.supabase.co', 'eyJlegacy', () => identity, fakeFetch).fetchDailyBoard('2026-09-25');
    expect(calls[0].headers.Authorization).toBe('Bearer eyJlegacy');
  });

  it('reports conflicts and transient failures as typed errors', async () => {
    status = 409;
    reply = { message: 'the cloud save is further ahead (5 runs)' };
    const conflict = await service().uploadProfile({} as never).catch(error => error);
    expect(conflict).toBeInstanceOf(OnlineError);
    expect(conflict.isConflict).toBe(true);
    expect(conflict.message).toContain('further ahead');
    status = 429;
    expect((await service().uploadProfile({} as never).catch(error => error)).isTransient).toBe(true);
    const offline = new SupabaseOnlineService('https://demo.supabase.co', 'k', () => identity,
      (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch);
    const network = await offline.fetchDailyBoard('2026-09-25').catch(error => error);
    expect(network.status).toBe(0);
    expect(network.isTransient).toBe(true);
  });

  it('maps the daily board and cloud saves', async () => {
    reply = [{ rank: 1, callsign: 'ACE', score: 900 }];
    expect(await service().fetchDailyBoard('2026-09-25')).toEqual([{ rank: 1, displayName: 'ACE', score: 900 }]);
    reply = [{ profile: { runs: 3 }, callsign: 'ACE', updated_at: '2026-09-25T10:00:00Z' }];
    expect(await service().downloadProfile(identity.code)).toEqual({ profile: { runs: 3 }, callsign: 'ACE', updatedAt: '2026-09-25T10:00:00Z' });
    reply = [];
    expect(await service().downloadProfile(identity.code)).toBeUndefined();
  });

  it('rejects on server errors so callers can report them', async () => {
    status = 500;
    await expect(service().uploadProfile({} as never)).rejects.toThrow('leek_put_save failed: 500');
  });

  it('reads cloud save metadata', async () => {
    reply = [{ runs: 7, updated_at: '2026-09-25T10:00:00Z' }];
    expect(await service().cloudSaveInfo(identity.code)).toEqual({ runs: 7, updatedAt: '2026-09-25T10:00:00Z' });
  });
});

describe('profile operative helpers', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    vi.resetModules();
  });

  it('creates the identity once and keeps it', async () => {
    const { ensureOperative, loadProfile } = await import('../src/game/systems/ProfileStore');
    const first = ensureOperative();
    expect(ensureOperative()).toEqual(first);
    expect(loadProfile().operative).toEqual(first);
  });

  it('renames only to valid callsigns', async () => {
    const { ensureOperative, renameOperative, loadProfile } = await import('../src/game/systems/ProfileStore');
    const { code } = ensureOperative();
    expect(renameOperative('leek master')).toBe('LEEK-MASTER');
    expect(renameOperative('!!')).toBeUndefined();
    expect(loadProfile().operative).toEqual({ code, callsign: 'LEEK-MASTER' });
  });

  it('restores a cloud save under the code it came from, re-validating fields', async () => {
    const { restoreCloudProfile, loadProfile } = await import('../src/game/systems/ProfileStore');
    restoreCloudProfile({ runs: 7, bioCredits: -3, operative: { code: 'WXYZ-WXYZ-WXYZ-WXYZ', callsign: 'OLD' } }, 'ABCD-EFGH-JKMN-PQRS', 'ACE');
    expect(loadProfile()).toMatchObject({ runs: 7, bioCredits: 0, operative: { code: 'ABCD-EFGH-JKMN-PQRS', callsign: 'ACE' } });
  });
});
