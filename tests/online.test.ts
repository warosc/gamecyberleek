import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CODE_PATTERN, generateCallsign, generateCode, normalizeCallsign, normalizeCode, normalizeIdentity,
} from '../src/game/online/OperativeIdentity';
import { SupabaseOnlineService } from '../src/game/online/SupabaseOnlineService';

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

  it('calls the RPC functions with the anon key and the operative identity', async () => {
    await service().submitDailyScore('2026-09-25', 1234.7);
    expect(calls[0].url).toBe('https://demo.supabase.co/rest/v1/rpc/leek_submit_daily');
    expect(calls[0].headers.apikey).toBe('anon-key');
    expect(calls[0].body).toEqual({ p_code: identity.code, p_callsign: 'PUERRO-1', p_day: '2026-09-25', p_score: 1234 });
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
