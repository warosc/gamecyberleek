import { describe, expect, it } from 'vitest';
import { OfflineOnlineService } from '../src/game/online/OnlinePorts';
import { isSafeStreamEvent, OfflineStreamingGateway } from '../src/game/online/StreamingPorts';

describe('offline online boundaries', () => {
  it('keeps the default service offline', async () => {
    const service = new OfflineOnlineService();
    expect(await service.signIn()).toBeNull();
    expect(await service.fetchLeaderboard()).toEqual([]);
  });

  it('accepts only bounded stream event payloads', () => {
    expect(isSafeStreamEvent({ type: 'buff', payload: { id: 'shield' }, issuedAt: 1, nonce: 'x'.repeat(16) })).toBe(true);
    expect(isSafeStreamEvent({ type: 'admin', payload: {}, issuedAt: 1, nonce: 'x'.repeat(16) })).toBe(false);
    expect(isSafeStreamEvent({ type: 'spawn', payload: {}, issuedAt: 1, nonce: 'short' })).toBe(false);
  });

  it('does not enqueue events while offline', async () => {
    expect(await new OfflineStreamingGateway().enqueue({ type: 'spawn', payload: {}, issuedAt: 1, nonce: 'x'.repeat(16) })).toBe(false);
  });

  it('serves the local daily board for the matching date only', async () => {
    const service = new OfflineOnlineService(() => ({ date: '2026-09-23', scores: [900, 400] }));
    expect(await service.submitDailyRun('2026-09-23', { kills: 1, level: 1, durationMs: 1000, victory: false })).toBeUndefined();
    expect(await service.openLiveBoard('2026-09-23')).toBeUndefined();
    expect(await service.fetchDailyBoard('2026-09-23')).toEqual([
      { rank: 1, displayName: 'LOCAL', score: 900 },
      { rank: 2, displayName: 'LOCAL', score: 400 },
    ]);
    expect(await service.fetchDailyBoard('2026-09-24')).toEqual([]);
  });
});
