import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CODE_PATTERN, generateCallsign, generateCode, normalizeCallsign, normalizeCode, normalizeIdentity,
} from '../src/game/online/OperativeIdentity';
import { RestOnlineService, livePresenceKey } from '../src/game/online/RestOnlineService';
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

describe('online REST adapter', () => {
  const identity = { code: 'ABCD-EFGH-JKMN-PQRS', callsign: 'PUERRO-1' };
  const calls: { url: string; body: unknown; headers: Record<string, string> }[] = [];
  let reply: unknown = null;
  let status = 200;
  const fakeFetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)), headers: init.headers as Record<string, string> });
    return new Response(reply === null ? '' : JSON.stringify(reply), { status });
  }) as unknown as typeof fetch;
  const service = () => new RestOnlineService('/online/', () => identity, fakeFetch);

  beforeEach(() => { calls.length = 0; reply = null; status = 200; });

  it('sends run facts for the server to score, with no key to leak', async () => {
    reply = 3350;
    const best = await service().submitDailyRun('2026-09-25', { kills: 120.6, level: 9, durationMs: 200000.4, victory: false });
    expect(best).toBe(3350);
    expect(calls[0].url).toBe('/online/rpc/leek_submit_daily_run');
    expect(calls[0].headers).toEqual({ 'Content-Type': 'application/json' });
    expect(calls[0].body).toEqual({
      p_code: identity.code, p_callsign: 'PUERRO-1', p_day: '2026-09-25', p_kills: 120, p_level: 9, p_duration_ms: 200000, p_victory: false,
    });
  });

  it('carries the run ticket the server issued when the daily started', async () => {
    reply = '5b1f6a7e-0000-4000-8000-000000000001';
    const ticket = await service().startDailyRun('2026-09-25');
    expect(ticket).toBe('5b1f6a7e-0000-4000-8000-000000000001');
    expect(calls[0].url).toBe('/online/rpc/leek_start_daily_run');
    expect(calls[0].body).toEqual({ p_code: identity.code, p_day: '2026-09-25' });
    reply = 4100;
    await service().submitDailyRun('2026-09-25', { kills: 50, level: 6, durationMs: 90000, victory: false, ticket });
    expect(calls[1].body).toMatchObject({ p_ticket: ticket, p_code: identity.code, p_kills: 50 });
  });

  // The client ships before migration 0003 is applied; until then the ticket function is missing.
  it('runs without a ticket against a server that predates them', async () => {
    status = 404;
    reply = { message: 'Could not find the function public.leek_start_daily_run' };
    expect(await service().startDailyRun('2026-09-25')).toBeUndefined();
    status = 503;
    await expect(service().startDailyRun('2026-09-25')).rejects.toBeInstanceOf(OnlineError);
  });

  it('never uploads the operative code inside the cloud save', async () => {
    await service().uploadProfile({ runs: 4, operative: identity } as never);
    expect(calls[0].body).toEqual({ p_code: identity.code, p_callsign: 'PUERRO-1', p_profile: { runs: 4 } });
  });

  it('times out a response whose body never arrives', async () => {
    const stalled = (async (_url: string, init: RequestInit) => new Response(new ReadableStream({
      start(controller) { init.signal?.addEventListener('abort', () => controller.error(new Error('aborted'))); },
    }))) as unknown as typeof fetch;
    const slow = new RestOnlineService('/online', () => identity, stalled, 20);
    const error = await slow.fetchDailyBoard('2026-09-25').catch(caught => caught);
    expect(error).toBeInstanceOf(OnlineError);
    expect(error.isTransient).toBe(true);
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
    const offline = new RestOnlineService('/online', () => identity,
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

  it('reports the live score throttled and reads the server board while open', async () => {
    vi.useFakeTimers();
    try {
      reply = [{ id: 'abc123def456', callsign: 'ACE', score: 900, self: false }];
      const session = (await service().openLiveBoard('2026-09-25'))!;
      const seen: unknown[] = [];
      session.onChange(entries => seen.push(entries));
      await vi.advanceTimersByTimeAsync(0);
      expect(calls[0].url).toBe('/online/rpc/leek_live_board');
      const key = (calls[0].body as { p_key: string }).p_key;
      expect(key).toMatch(/^[0-9a-f]{32}$/);
      session.update(120.7, 10.9);
      session.update(150, 12);
      await vi.advanceTimersByTimeAsync(1500);
      const updates = calls.filter(call => call.url.endsWith('leek_live_update'));
      // Two updates inside the window collapse into one report carrying the latest values.
      expect(updates).toHaveLength(1);
      expect(updates[0].body).toEqual({ p_day: '2026-09-25', p_key: key, p_callsign: 'PUERRO-1', p_score: 150, p_seconds: 12 });
      await vi.advanceTimersByTimeAsync(2500);
      expect(seen.length).toBeGreaterThanOrEqual(2);
      expect(seen[0]).toEqual([{ id: 'abc123def456', callsign: 'ACE', score: 900, self: false }]);
      await session.leave();
      const before = calls.length;
      await vi.advanceTimersByTimeAsync(10000);
      expect(calls.length).toBe(before);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the live board quiet when the server rejects or is down', async () => {
    vi.useFakeTimers();
    try {
      status = 503;
      const session = (await service().openLiveBoard('2026-09-25'))!;
      const seen: unknown[] = [];
      session.onChange(entries => seen.push(entries));
      session.update(100, 5);
      await vi.advanceTimersByTimeAsync(6000);
      expect(seen).toEqual([]);
      await session.leave();
    } finally {
      vi.useRealTimers();
    }
  });

  it('makes live presence keys without crypto.randomUUID, which plain-HTTP pages lack', () => {
    // Found live in production: over HTTP randomUUID is undefined and the live board never opened.
    vi.stubGlobal('crypto', { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) });
    try {
      const [a, b] = [livePresenceKey(), livePresenceKey()];
      expect(a).toMatch(/^[0-9a-f]{32}$/);
      expect(a).not.toBe(b);
    } finally {
      vi.unstubAllGlobals();
    }
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
