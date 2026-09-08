import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('BRÓK-9 production sprite', () => {
  it('ships a real alpha cutout within a bounded texture and download budget', () => {
    const png = readFileSync('public/assets/enemies/brok9/commander.png');
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png[25]).toBe(6);
    expect(png.readUInt32BE(16)).toBeLessThanOrEqual(2048);
    expect(png.readUInt32BE(20)).toBeLessThanOrEqual(2048);
    expect(png.length).toBeLessThan(2_000_000);
  });
});
