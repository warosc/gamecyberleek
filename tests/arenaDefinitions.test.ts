import { describe, expect, it } from 'vitest';
import { ARENA_THEMES } from '../src/game/config/ArenaDefinitions';

describe('arena visual identities', () => {
  it('gives every world a unique biome, palette and label', () => {
    expect(ARENA_THEMES.map(theme => theme.id)).toEqual(['lab', 'greenhouse', 'reactor']);
    expect(new Set(ARENA_THEMES.map(theme => theme.accent)).size).toBe(3);
    expect(new Set(ARENA_THEMES.map(theme => theme.name)).size).toBe(3);
  });
});
