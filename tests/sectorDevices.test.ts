import { describe, expect, it } from 'vitest';
import { SECTOR_DEVICES, SECTOR_DEVICE_POSITIONS } from '../src/game/config/SectorDevices';

describe('sector tactical devices', () => {
  it('provides one distinct readable effect per world', () => {
    expect(SECTOR_DEVICES.map(device => device.effect)).toEqual(['emp', 'renewal', 'cryo']);
    expect(SECTOR_DEVICES[1].heal).toBeGreaterThan(0);
    expect(SECTOR_DEVICES[0].damage).toBeGreaterThan(SECTOR_DEVICES[1].damage);
    expect(SECTOR_DEVICE_POSITIONS).toHaveLength(3);
  });
});
