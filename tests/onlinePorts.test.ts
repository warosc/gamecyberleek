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
});
