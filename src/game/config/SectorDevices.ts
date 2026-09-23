export type SectorDeviceEffect = 'emp' | 'renewal' | 'cryo';

export const SECTOR_DEVICES = [
  { name: 'CAPACITOR EMP', effect: 'emp' as const, color: 0x21e6ff, radius: 220, damage: 65, heal: 0 },
  { name: 'VAINA RENOVADORA', effect: 'renewal' as const, color: 0x73ef62, radius: 185, damage: 42, heal: 24 },
  { name: 'NÚCLEO CRIO', effect: 'cryo' as const, color: 0x76a9ff, radius: 200, damage: 48, heal: 0 },
] as const;

export const SECTOR_DEVICE_POSITIONS = [[345, 600], [1000, 220], [1655, 600]] as const;
