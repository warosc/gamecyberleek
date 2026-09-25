import type { PlayerProfile } from '../systems/ProfileStore';
import type { LiveBoardSession } from './LiveRanking';

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

export interface CloudSave {
  profile: unknown;
  callsign: string;
  updatedAt: string;
}

export interface CloudSaveInfo {
  runs: number;
  updatedAt: string;
}

/** What a finished daily run reports; the server computes the score from it. */
export interface DailyRunFacts {
  kills: number;
  level: number;
  durationMs: number;
  victory: boolean;
}

/** An online failure with its HTTP status (0 when the network itself failed). */
export class OnlineError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
  /** 409: the cloud already holds a save with more completed runs. */
  get isConflict() { return this.status === 409; }
  /** Worth retrying later: network down, rate limited or server trouble. */
  get isTransient() { return this.status === 0 || this.status === 429 || this.status >= 500; }
}

/** Provider boundary for Phase G. Offline gameplay never calls a network implementation. */
export interface OnlineService {
  /** False for the offline adapter: screens use it to say whether the cloud is reachable. */
  readonly online: boolean;
  signIn(): Promise<AccountSession | null>;
  /** Rejects with an OnlineError whose isConflict is true when the cloud save is further ahead. */
  uploadProfile(profile: PlayerProfile): Promise<void>;
  /** The save stored under an operative code, or undefined when there is none. */
  downloadProfile(code: string): Promise<CloudSave | undefined>;
  /** Run count and time of the cloud save, without downloading it. */
  cloudSaveInfo(code: string): Promise<CloudSaveInfo | undefined>;
  fetchLeaderboard(): Promise<readonly LeaderboardEntry[]>;
  /** Daily runs are keyed by the local calendar date; resolves with the day's best score. */
  submitDailyRun(date: string, run: DailyRunFacts): Promise<number | undefined>;
  fetchDailyBoard(date: string): Promise<readonly LeaderboardEntry[]>;
  /** Joins the live board of players in today's daily right now; undefined when unavailable. */
  openLiveBoard(date: string): Promise<LiveBoardSession | undefined>;
  signOut(): Promise<void>;
}

/**
 * The default adapter. It has no network access: the daily board it returns is this device's
 * own top scores, read from the profile, so the UI can use one code path online and offline.
 */
export class OfflineOnlineService implements OnlineService {
  readonly online = false;
  constructor(private readonly localDaily: () => { date: string; scores: readonly number[] } = () => ({ date: '', scores: [] })) {}
  async signIn() { return null; }
  async uploadProfile(profile: PlayerProfile) { void profile; /* Offline no-op. */ }
  async downloadProfile(code: string): Promise<CloudSave | undefined> { void code; return undefined; }
  async cloudSaveInfo(code: string): Promise<CloudSaveInfo | undefined> { void code; return undefined; }
  async fetchLeaderboard() { return [] as const; }
  async submitDailyRun(date: string, run: DailyRunFacts) { void date; void run; return undefined; /* Recorded locally by ProfileStore. */ }
  async fetchDailyBoard(date: string): Promise<readonly LeaderboardEntry[]> {
    const local = this.localDaily();
    if (local.date !== date) return [];
    return local.scores.map((score, index) => ({ rank: index + 1, displayName: 'LOCAL', score }));
  }
  async openLiveBoard(date: string) { void date; return undefined; }
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
