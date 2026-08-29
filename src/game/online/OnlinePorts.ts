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
  signOut(): Promise<void>;
}

export class OfflineOnlineService implements OnlineService {
  async signIn() { return null; }
  async uploadProfile() { /* Offline no-op. */ }
  async fetchLeaderboard() { return [] as const; }
  async signOut() { /* Offline no-op. */ }
}
