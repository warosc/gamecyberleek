export interface UnlockDefinition {
  id: string;
  name: string;
  description: string;
  requirement: (profile: { victories: number; bestLevel: number }) => boolean;
}

/** Data-only registry; unlocks remain local and offline until an account service is approved. */
export const UNLOCKS: readonly UnlockDefinition[] = [
  { id: 'sector-2', name: 'SECTOR 2', description: 'Reach level 5', requirement: (p) => p.bestLevel >= 5 },
  { id: 'sector-3', name: 'SECTOR 3', description: 'Win one operation', requirement: (p) => p.victories >= 1 },
];
