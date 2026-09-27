import type { PlayerStats } from './PlayerStats';

export type WeaponMode = PlayerStats['weaponMode'];

export interface WeaponSilhouette {
  muzzleDistance: number;
  bodyLength: number;
  bodyHeight: number;
  accent: 'cell' | 'spore' | 'coil' | 'rail';
}

export const WEAPON_SILHOUETTES: Record<WeaponMode, WeaponSilhouette> = {
  pulse: { muzzleDistance: 37, bodyLength: 31, bodyHeight: 13, accent: 'cell' },
  plasma: { muzzleDistance: 48, bodyLength: 41, bodyHeight: 22, accent: 'spore' },
  arc: { muzzleDistance: 42, bodyLength: 34, bodyHeight: 17, accent: 'coil' },
  laser: { muzzleDistance: 51, bodyLength: 45, bodyHeight: 11, accent: 'rail' },
};
