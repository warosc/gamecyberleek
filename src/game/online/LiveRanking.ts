/** One player on the live daily board. */
export interface LiveEntry {
  id: string;
  callsign: string;
  score: number;
  self: boolean;
}

/** A joined live board: push your score, hear everyone's, leave when the run ends. */
export interface LiveBoardSession {
  update(score: number): void;
  onChange(listener: (entries: LiveEntry[]) => void): void;
  leave(): Promise<void>;
}

interface PresencePayload { callsign?: unknown; score?: unknown }

/**
 * Turns a presence state (key -> list of payloads, one per open tab) into a ranking. Each key
 * counts once with its best score; malformed payloads are skipped because presence data comes
 * from other clients and is not validated by the server.
 */
export function rankLive(state: Record<string, PresencePayload[]>, selfId: string): LiveEntry[] {
  const entries: LiveEntry[] = [];
  for (const [id, payloads] of Object.entries(state)) {
    let best: { callsign: string; score: number } | undefined;
    for (const payload of payloads) {
      const callsign = typeof payload.callsign === 'string' ? payload.callsign.slice(0, 16) : '';
      const score = typeof payload.score === 'number' && Number.isFinite(payload.score) ? Math.max(0, Math.floor(payload.score)) : NaN;
      if (!callsign || Number.isNaN(score)) continue;
      if (!best || score > best.score) best = { callsign, score };
    }
    if (best) entries.push({ id, ...best, self: id === selfId });
  }
  return entries.sort((a, b) => b.score - a.score || Number(b.self) - Number(a.self) || a.callsign.localeCompare(b.callsign));
}

/** Players who were at or below you and are now strictly above you. */
export function overtakes(previous: readonly LiveEntry[], next: readonly LiveEntry[]) {
  const selfBefore = previous.find(entry => entry.self);
  const selfNow = next.find(entry => entry.self);
  if (!selfBefore || !selfNow) return [];
  const wasAhead = new Set(previous.filter(entry => !entry.self && entry.score > selfBefore.score).map(entry => entry.id));
  const known = new Set(previous.map(entry => entry.id));
  return next.filter(entry => !entry.self && known.has(entry.id) && !wasAhead.has(entry.id) && entry.score > selfNow.score);
}
