import { describe, expect, it, vi } from 'vitest';
import { SectorObjectiveSystem } from '../src/game/systems/SectorObjectiveSystem';

describe('sector objectives', () => {
  it('tracks only the sector metric and completes once', () => {
    const changed = vi.fn();
    const completed = vi.fn();
    const objective = new SectorObjectiveSystem(0, changed, completed);
    expect(objective.record('shards')).toBe(false);
    for (let kill = 0; kill < 18; kill++) expect(objective.record('kills')).toBe(true);
    expect(objective.snapshot).toMatchObject({ progress: 18, target: 18, status: 'complete' });
    expect(completed).toHaveBeenCalledTimes(1);
    expect(objective.record('kills')).toBe(false);
  });

  it('fails when its response window expires', () => {
    const changed = vi.fn();
    const objective = new SectorObjectiveSystem(1, changed, vi.fn());
    objective.record('shards');
    objective.update(105_001);
    expect(objective.snapshot.status).toBe('failed');
    expect(objective.record('shards')).toBe(false);
    expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'failed' }));
  });

  it('uses a distinct mission for every sector', () => {
    expect(new SectorObjectiveSystem(0, vi.fn(), vi.fn()).snapshot.metric).toBe('kills');
    expect(new SectorObjectiveSystem(1, vi.fn(), vi.fn()).snapshot.metric).toBe('shards');
    expect(new SectorObjectiveSystem(2, vi.fn(), vi.fn()).snapshot.metric).toBe('devices');
  });
});
