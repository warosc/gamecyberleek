export interface PlayerProfile {
  runs: number;
  bestLevel: number;
  victories: number;
  bioCredits: number;
  vibration: boolean;
  autoFire: boolean;
}

const KEY = 'leek-ops-profile-v1';
const defaults: PlayerProfile = {
  runs: 0,
  bestLevel: 1,
  victories: 0,
  bioCredits: 0,
  vibration: true,
  autoFire: false,
};

export function loadProfile(): PlayerProfile {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...defaults };
  }
}

export function saveRun(level: number, victory: boolean) {
  const profile = loadProfile();
  profile.runs++;
  profile.bestLevel = Math.max(profile.bestLevel, level);
  profile.victories += Number(victory);
  profile.bioCredits += level * 5 + (victory ? 100 : 0);
  localStorage.setItem(KEY, JSON.stringify(profile));
  return profile;
}

export function updateProfile(patch: Partial<PlayerProfile>) {
  const profile = { ...loadProfile(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(profile));
  return profile;
}
