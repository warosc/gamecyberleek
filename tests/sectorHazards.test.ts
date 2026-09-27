import { describe, expect, it } from 'vitest';
import { HAZARD_FIRST_MS, HAZARD_INTERVAL_MS, HAZARD_LEAD_MS, SECTOR_HAZARDS, sectorHazardHits } from '../src/game/config/SectorHazards';

describe('sector hazards', () => {
  it('provides readable timing without overlapping continuously', () => {
    expect(HAZARD_FIRST_MS).toBeGreaterThan(15000);
    expect(HAZARD_LEAD_MS).toBeGreaterThanOrEqual(1000);
    expect(HAZARD_INTERVAL_MS).toBeGreaterThan(HAZARD_LEAD_MS * 10);
    expect(SECTOR_HAZARDS).toHaveLength(3);
  });

  it('uses a different safe response in each sector', () => {
    const origin = { x: 500, y: 400 };
    expect(sectorHazardHits(0, { x: 500, y: 700 }, origin)).toBe(true);
    expect(sectorHazardHits(0, { x: 600, y: 500 }, origin)).toBe(false);
    expect(sectorHazardHits(1, { x: 620, y: 400 }, origin)).toBe(true);
    expect(sectorHazardHits(1, { x: 700, y: 400 }, origin)).toBe(false);
    expect(sectorHazardHits(2, { x: 650, y: 700 }, origin)).toBe(true);
    expect(sectorHazardHits(2, { x: 575, y: 700 }, origin)).toBe(false);
  });
});
