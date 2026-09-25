import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { webpInfo } from './webpInfo';

describe('BRÓK-9 production sprite', () => {
  it('ships a real alpha cutout within a bounded texture and download budget', () => {
    const file = readFileSync('public/assets/enemies/brok9/commander.webp');
    const info = webpInfo(file);
    expect(info.alpha).toBe(true);
    expect(info.width).toBeLessThanOrEqual(1024);
    expect(info.height).toBeLessThanOrEqual(1024);
    expect(file.length).toBeLessThan(300_000);
  });
});
