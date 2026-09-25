export type StreamEventType = 'spawn' | 'buff' | 'challenge';

export interface StreamEvent {
  readonly type: StreamEventType;
  readonly payload: Readonly<Record<string, string | number>>;
  readonly issuedAt: number;
  readonly nonce: string;
}

/** Secure server boundary for Phase H; browser clients must not hold provider secrets. */
export interface StreamingEventGateway {
  enqueue(event: StreamEvent): Promise<boolean>;
  disconnect(): Promise<void>;
}

export class OfflineStreamingGateway implements StreamingEventGateway {
  async enqueue(event: StreamEvent) { void event; return false; }
  async disconnect() { /* Offline no-op. */ }
}

export function isSafeStreamEvent(value: unknown): value is StreamEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<StreamEvent>;
  return (
    (event.type === 'spawn' || event.type === 'buff' || event.type === 'challenge') &&
    !!event.payload && typeof event.payload === 'object' &&
    typeof event.issuedAt === 'number' && Number.isFinite(event.issuedAt) &&
    typeof event.nonce === 'string' && event.nonce.length >= 16 && event.nonce.length <= 128
  );
}
