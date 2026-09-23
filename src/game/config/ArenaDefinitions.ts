export interface ArenaTheme {
  id: 'lab' | 'greenhouse' | 'reactor';
  name: string;
  subtitle: string;
  background: number;
  grid: number;
  accent: number;
  secondary: number;
  floorTint: number;
  /** Bio-credit multiplier for runs in this sector; later sectors pay more for more risk. */
  rewardMultiplier: number;
}

export const ARENA_THEMES: ArenaTheme[] = [
  {
    id: 'lab',
    name: 'CYBER VEGETABLE LAB',
    subtitle: 'SECTOR C-01',
    background: 0x07111f,
    grid: 0x124157,
    accent: 0x21e6ff,
    secondary: 0x73ef62,
    floorTint: 0xffffff,
    rewardMultiplier: 1,
  },
  {
    id: 'greenhouse',
    name: 'NEON GREENHOUSE',
    subtitle: 'BIO-DOME G-07',
    background: 0x07170f,
    grid: 0x185638,
    accent: 0x73ef62,
    secondary: 0x21e6ff,
    floorTint: 0xb9ffd0,
    rewardMultiplier: 1.25,
  },
  {
    id: 'reactor',
    name: 'FROZEN REACTOR',
    subtitle: 'CRYO CORE B-12',
    background: 0x090b22,
    grid: 0x26366f,
    accent: 0x76a9ff,
    secondary: 0xd566ff,
    floorTint: 0xbcc9ff,
    rewardMultiplier: 1.5,
  },
];

export function sectorRewardMultiplier(sector: number) {
  return ARENA_THEMES[Math.min(Math.max(0, sector), ARENA_THEMES.length - 1)].rewardMultiplier;
}
