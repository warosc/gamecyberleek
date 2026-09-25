import { beforeEach, describe, expect, it, vi } from 'vitest';
import { overtakes, rankLive } from '../src/game/online/LiveRanking';
import type { OnlineService } from '../src/game/online/OnlinePorts';

describe('live ranking', () => {
  it('ranks one entry per player by best score, marks self, and skips malformed presence', () => {
    const entries = rankLive({
      me: [{ callsign: 'ME', score: 400 }],
      ace: [{ callsign: 'ACE', score: 900 }, { callsign: 'ACE', score: 950 }],
      bad: [{ callsign: 42, score: 'x' }],
      neg: [{ callsign: 'NEG', score: -5 }],
    }, 'me');
    expect(entries.map(e => [e.callsign, e.score, e.self])).toEqual([['ACE', 950, false], ['ME', 400, true], ['NEG', 0, false]]);
  });

  it('reports only players who moved from at-or-below you to above you', () => {
    const before = rankLive({ me: [{ callsign: 'ME', score: 500 }], a: [{ callsign: 'A', score: 450 }], b: [{ callsign: 'B', score: 900 }] }, 'me');
    const after = rankLive({ me: [{ callsign: 'ME', score: 520 }], a: [{ callsign: 'A', score: 600 }], b: [{ callsign: 'B', score: 950 }], c: [{ callsign: 'C', score: 999 }] }, 'me');
    expect(overtakes(before, after).map(e => e.callsign)).toEqual(['A']);
    expect(overtakes([], after)).toEqual([]);
  });
});

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  clear() { this.store.clear(); }
  getItem(key: string) { return this.store.get(key) ?? null; }
  key(index: number) { return [...this.store.keys()][index] ?? null; }
  removeItem(key: string) { this.store.delete(key); }
  setItem(key: string, value: string) { this.store.set(key, value); }
}

describe('daily run retry queue', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    vi.resetModules();
  });
  const run = { kills: 10, level: 2, durationMs: 60000, victory: false };
  const serviceWith = (submit: OnlineService['submitDailyRun']) => ({ online: true, submitDailyRun: submit }) as unknown as OnlineService;

  it('keeps a run queued while the network is down and sends it once it is back', async () => {
    // Same module graph as OnlineSync after resetModules, so instanceof checks line up.
    const { OnlineError } = await import('../src/game/online/OnlinePorts');
    const sync = await import('../src/game/online/OnlineSync');
    let up = false;
    const sent: string[] = [];
    const service = serviceWith(async date => {
      if (!up) throw new OnlineError(0, 'offline');
      sent.push(date);
      return 1;
    });
    await sync.submitDailyRun(service, '2026-09-25', run);
    expect(sync.pendingDailyRuns()).toHaveLength(1);
    up = true;
    await sync.flushDailyRuns(service, 0);
    expect(sent).toEqual(['2026-09-25']);
    expect(sync.pendingDailyRuns()).toHaveLength(0);
  });

  it('drops runs the server rejects permanently so they cannot block the queue', async () => {
    const { OnlineError } = await import('../src/game/online/OnlinePorts');
    const sync = await import('../src/game/online/OnlineSync');
    const service = serviceWith(async date => {
      if (date === '2026-01-01') throw new OnlineError(400, 'day out of range');
      return 1;
    });
    await sync.submitDailyRun(serviceWith(async () => { throw new OnlineError(503, 'down'); }), '2026-01-01', run);
    await sync.submitDailyRun(serviceWith(async () => { throw new OnlineError(503, 'down'); }), '2026-09-25', run);
    expect(sync.pendingDailyRuns()).toHaveLength(2);
    await sync.flushDailyRuns(service, 0);
    expect(sync.pendingDailyRuns()).toHaveLength(0);
  });

  it('still sends after a startup flush of an empty queue (regression)', async () => {
    // Found live in production: the empty startup flush finished synchronously and left the
    // queue locked, so no daily score of that session was ever sent.
    const sync = await import('../src/game/online/OnlineSync');
    const sent: string[] = [];
    const service = serviceWith(async date => { sent.push(date); return 1; });
    await sync.flushDailyRuns(service);
    await sync.submitDailyRun(service, '2026-09-25', run);
    expect(sent).toEqual(['2026-09-25']);
    expect(sync.pendingDailyRuns()).toHaveLength(0);
  });

  it('does nothing offline', async () => {
    const sync = await import('../src/game/online/OnlineSync');
    await sync.submitDailyRun({ online: false } as OnlineService, '2026-09-25', run);
    expect(sync.pendingDailyRuns()).toHaveLength(0);
  });
});

describe('server and client agree on the daily score', () => {
  it('matches the SQL leek_run_score cases verified against the live database', async () => {
    const { operationScore } = await import('../src/game/progression/DailyOperation');
    expect(operationScore({ kills: 120, level: 9, durationMs: 200000, victory: false })).toBe(3350);
  });
});
