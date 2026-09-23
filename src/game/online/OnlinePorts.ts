import type { PlayerProfile } from '../systems/ProfileStore';

export interface AccountSession {
  readonly userId: string;
  readonly displayName: string;
  readonly expiresAt: number;
}

export interface LeaderboardEntry {
  readonly rank: number;
  readonly displayName: string;
  readonly score: number;
}

/** Provider boundary for Phase G. Offline gameplay never calls a network implementation. */
export interface OnlineService {
  signIn(): Promise<AccountSession | null>;
  uploadProfile(profile: PlayerProfile): Promise<void>;
  fetchLeaderboard(): Promise<readonly LeaderboardEntry[]>;
  /** Daily operation scores are keyed by the local calendar date of the run. */
  submitDailyScore(date: string, score: number): Promise<void>;
  fetchDailyBoard(date: string): Promise<readonly LeaderboardEntry[]>;
  signOut(): Promise<void>;
}

/**
 * The default adapter. It has no network access: the daily board it returns is this device's
 * own top scores, read from the profile, so the UI can use one code path online and offline.
 */
export class OfflineOnlineService implements OnlineService {
  constructor(private readonly localDaily: () => { date: string; scores: readonly number[] } = () => ({ date: '', scores: [] })) {}
  async signIn() { return null; }
  async uploadProfile(profile: PlayerProfile) { void profile; /* Offline no-op. */ }
  async fetchLeaderboard() { return [] as const; }
  async submitDailyScore(date: string, score: number) { void date; void score; /* Recorded locally by ProfileStore. */ }
  async fetchDailyBoard(date: string): Promise<readonly LeaderboardEntry[]> {
    const local = this.localDaily();
    if (local.date !== date) return [];
    return local.scores.map((score, index) => ({ rank: index + 1, displayName: 'LOCAL', score }));
  }
  async signOut() { /* Offline no-op. */ }
}

let service: OnlineService | undefined;

/** The active adapter. Replacing it is the only change a real backend needs on the client. */
export function onlineService(): OnlineService {
  return (service ??= new OfflineOnlineService());
}

export function setOnlineService(next: OnlineService) {
  service = next;
}
