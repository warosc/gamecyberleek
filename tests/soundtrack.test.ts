import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const played: { voice: string; when: number }[] = [];
vi.mock('../src/game/audio/MidiSynth', async original => ({
  ...(await original<typeof import('../src/game/audio/MidiSynth')>()),
  playVoice: (_context: unknown, _out: unknown, voice: string, _pitch: number, _velocity: number, when: number) =>
    played.push({ voice, when }),
}));

const { parseMidi } = await import('../src/game/audio/MidiFile');
const { MusicDirector, layerFor, prepareCue } = await import('../src/game/audio/MusicDirector');

const manifest = JSON.parse(readFileSync('public/assets/music/manifest.json', 'utf8')) as Record<string, { midi: string; bpm: number; bars: number; loop: boolean }>;
const arrangements = JSON.parse(readFileSync('tools/music/arrangements.json', 'utf8')) as Record<string, { bpm: number; tracks: { name: string; notes: unknown[] }[] }>;
const load = (cue: string) => {
  const bytes = readFileSync(`public/assets/music/${manifest[cue].midi}`);
  return parseMidi(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
};

describe('soundtrack files', () => {
  it.each(Object.keys(manifest))('%s parses with every composed note and track', cue => {
    const song = load(cue);
    expect(song.bpm).toBeCloseTo(manifest[cue].bpm, 3);
    const composed = arrangements[cue].tracks;
    expect(song.tracks.map(track => track.name).sort()).toEqual(composed.map(track => track.name).sort());
    expect(song.tracks.reduce((sum, track) => sum + track.notes.length, 0))
      .toBe(composed.reduce((sum, track) => sum + track.notes.length, 0));
    const loopLength = manifest[cue].bars * 4 * 60 / manifest[cue].bpm;
    for (const track of song.tracks) for (const note of track.notes) {
      expect(note.time).toBeGreaterThanOrEqual(0);
      expect(note.time).toBeLessThan(loopLength + 1e-6);
      expect(note.velocity).toBeGreaterThan(0);
      expect(note.velocity).toBeLessThanOrEqual(1);
    }
  });

  it('gives each sector its own tempo and a distinct boss theme', () => {
    expect(new Set(['lab', 'greenhouse', 'reactor', 'boss'].map(cue => manifest[cue].bpm)).size).toBe(4);
    expect(manifest.boss.bpm).toBeGreaterThan(manifest.lab.bpm);
    expect(manifest.victory.loop).toBe(false);
  });

  it('rejects files that are not MIDI', () => {
    expect(() => parseMidi(new TextEncoder().encode('RIFF....').buffer)).toThrow();
  });
});

describe('dynamic mix layers', () => {
  it('adds layers with intensity and danger, and plays everything on menu and boss', () => {
    expect(layerFor('combat', 0)).toBe(0);
    expect(layerFor('combat', 1)).toBe(1);
    expect(layerFor('combat', 5)).toBe(2);
    expect(layerFor('danger', 0)).toBe(1);
    expect(layerFor('menu', 0)).toBe(2);
    expect(layerFor('boss', 0)).toBe(2);
  });
});

describe('music director', () => {
  const context = { currentTime: 10, state: 'running' } as unknown as AudioContext;
  beforeEach(() => { played.length = 0; });

  it('schedules only a short lookahead and only the allowed layers', () => {
    const director = new MusicDirector(context, {} as GainNode);
    director.register('lab', load('lab'), manifest.lab as never);
    director.update(0, 'lab', 0);
    expect(played.length).toBeGreaterThan(0);
    expect(played.every(note => note.when - 10 <= 0.23)).toBe(true);
    expect(played.some(note => note.voice === 'lead' || note.voice === 'arp')).toBe(false);
  });

  it('advances with the caller clock, never schedules a note twice, and freezes when the clock stops', () => {
    const director = new MusicDirector(context, {} as GainNode);
    director.register('boss', load('boss'), manifest.boss as never);
    const prepared = prepareCue(load('boss'), manifest.boss);
    for (let clock = 0; clock <= 4000; clock += 16) director.update(clock, 'boss', 2);
    const expected = prepared.events.filter(event => event.time < 4 + 0.22).length;
    expect(played.length).toBe(expected);
    const before = played.length;
    // A paused game stops calling with new time: nothing more is scheduled.
    for (let frame = 0; frame < 30; frame++) director.update(4000, 'boss', 2);
    expect(played.length).toBe(before);
  });

  it('loops seamlessly past the end of the cue', () => {
    const director = new MusicDirector(context, {} as GainNode);
    director.register('menu', load('menu'), manifest.menu as never);
    const length = manifest.menu.bars * 4 * 60 / manifest.menu.bpm;
    for (let clock = 0; clock <= (length + 2) * 1000; clock += 20) director.update(clock, 'menu', 2);
    const perLoop = prepareCue(load('menu'), manifest.menu).events.length;
    expect(played.length).toBeGreaterThan(perLoop);
  });
});
