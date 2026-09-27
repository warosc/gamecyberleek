"""LEEK OPS soundtrack composer.

Writes the game's music as arrangement specs and Standard MIDI Files:

    python tools/music/compose.py            # -> public/assets/music/*.mid + *.json
    python tools/music/compose.py --fl       # also export through the FL Studio MCP (fl_export_midi)

Track names match the channels of the FL Studio template project (Drums, Perc, Sub Bass,
Bass Groove, Chords Pad, Pluck Arp, Lead Hook, Riser), so an imported file lands on the right
instruments. The game plays the same .mid files with its own Web Audio synth until rendered
audio exists (see public/assets/music/README.md).

Deterministic: the same script always writes the same notes.
"""
from __future__ import annotations

import json
import os
import random
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'public', 'assets', 'music')

QUALITIES = {
    'm': [0, 3, 7], 'M': [0, 4, 7], 'm7': [0, 3, 7, 10], 'M7': [0, 4, 7, 11], '7': [0, 4, 7, 10],
    'sus4': [0, 5, 7], 'dim': [0, 3, 6],
}
NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6,
        'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}
SCALES = {
    'aeolian': [0, 2, 3, 5, 7, 8, 10], 'dorian': [0, 2, 3, 5, 7, 9, 10], 'harmonic': [0, 2, 3, 5, 7, 8, 11],
    'ionian': [0, 2, 4, 5, 7, 9, 11], 'minor_pent': [0, 3, 5, 7, 10],
}
# General MIDI drum map, channel 10.
KICK, SNARE, CLAP, HAT, OPEN_HAT, CRASH, TOM_LO, TOM_HI, CONGA, SHAKER = 36, 38, 39, 42, 46, 49, 45, 50, 63, 70


def chord(symbol):
    """'Am' -> (root pitch class, intervals); 'Bbmaj7' style names use QUALITIES keys."""
    name = symbol[:2] if len(symbol) > 1 and symbol[1] in '#b' else symbol[:1]
    quality = symbol[len(name):] or 'M'
    return NOTE[name], QUALITIES[quality]


class Track:
    def __init__(self, name, channel):
        self.name, self.channel, self.notes = name, channel, []

    def add(self, pitch, beat, beats, velocity):
        """Times in beats (4/4); stored in bars as the FL MCP spec expects."""
        self.notes.append({'pitch': int(pitch), 'start_bars': round(beat / 4, 5),
                           'length_bars': round(max(beats, 0.05) / 4, 5), 'velocity': round(velocity, 3)})

    def spec(self):
        return {'name': self.name, 'channel': self.channel, 'notes': self.notes}


def new_tracks():
    return {key: Track(name, ch) for key, name, ch in [
        ('drums', 'Drums', 9), ('perc', 'Perc', 9), ('sub', 'Sub Bass', 0), ('bass', 'Bass Groove', 1),
        ('pad', 'Chords Pad', 2), ('arp', 'Pluck Arp', 3), ('lead', 'Lead Hook', 4), ('riser', 'Riser', 5)]}


def voicing(root_pc, intervals, octave=4):
    """Close voicing around the given octave, keeping the top voice below E5."""
    base = 12 * (octave + 1) + root_pc
    notes = [base + i for i in intervals]
    return [n - 12 if n > 76 else n for n in notes]


# ---------------------------------------------------------------------------------------------
# Parts
# ---------------------------------------------------------------------------------------------

def pad_part(t, bars, prog, start_bar, velocity=0.5, stabs=False):
    for index in range(bars):
        root, intervals = chord(prog[index % len(prog)])
        beat = (start_bar + index) * 4
        if stabs:
            for hit in (0, 1.5, 3):
                for p in voicing(root, intervals):
                    t.add(p, beat + hit, 0.45, velocity)
        else:
            for p in voicing(root, intervals):
                t.add(p, beat, 3.9, velocity)


def sub_part(t, bars, prog, start_bar, velocity=0.7):
    for index in range(bars):
        root, _ = chord(prog[index % len(prog)])
        t.add(24 + 12 + root if root < 5 else 24 + root, (start_bar + index) * 4, 3.8, velocity)


def bass_part(t, bars, prog, start_bar, style, velocity=0.72):
    for index in range(bars):
        root, intervals = chord(prog[index % len(prog)])
        low = 36 + root if root < 8 else 24 + root
        beat = (start_bar + index) * 4
        if style == 'offbeat':
            for step in range(4):
                t.add(low + (12 if step % 2 else 0), beat + step + 0.5, 0.42, velocity)
        elif style == 'groove':
            pattern = [(0, 0), (0.75, 0), (1.5, 12), (2, 0), (2.75, 7), (3.5, 10 if 10 in intervals else 7)]
            for offset, interval in pattern:
                t.add(low + interval, beat + offset, 0.4, velocity * (1 if offset in (0, 2) else 0.8))
        elif style == 'gallop':
            for step in range(4):
                for sub, length in ((0, 0.45), (0.5, 0.2), (0.75, 0.2)):
                    t.add(low, beat + step + sub, length, velocity * (1 if sub == 0 else 0.75))
        elif style == 'sixteenths':
            for step in range(16):
                accent = step % 4 == 0
                t.add(low + (12 if step in (6, 14) else 0), beat + step * 0.25, 0.22, velocity * (1 if accent else 0.7))


def arp_part(t, bars, prog, start_bar, scale_root, rate=0.5, pattern=(0, 1, 2, 1), velocity=0.45, octave=5):
    for index in range(bars):
        root, intervals = chord(prog[index % len(prog)])
        tones = voicing(root, intervals, octave)
        tones = sorted(tones) + [tones[0] + 12]
        steps = int(4 / rate)
        for step in range(steps):
            tone = tones[pattern[step % len(pattern)] % len(tones)]
            t.add(tone, (start_bar + index) * 4 + step * rate, rate * 0.8, velocity * (1 if step % 2 == 0 else 0.8))


def drum_part(t, bars, start_bar, style, fill_every=8, crash_first=True):
    for index in range(bars):
        beat = (start_bar + index) * 4
        fill = fill_every and (index % fill_every == fill_every - 1)
        if crash_first and index % 8 == 0:
            t.add(CRASH, beat, 1, 0.7)
        if style == 'four':
            for b in range(4):
                t.add(KICK, beat + b, 0.25, 0.95)
                t.add(HAT, beat + b + 0.5, 0.1, 0.55)
            t.add(SNARE, beat + 1, 0.25, 0.8)
            t.add(CLAP, beat + 3, 0.25, 0.75)
            t.add(OPEN_HAT, beat + 3.5, 0.3, 0.5)
        elif style == 'laid':
            for hit in (0, 1.75, 2.5):
                t.add(KICK, beat + hit, 0.25, 0.85)
            t.add(CLAP, beat + 1, 0.25, 0.7)
            t.add(CLAP, beat + 3, 0.25, 0.75)
            for s in range(8):
                t.add(HAT, beat + s * 0.5 + (0.06 if s % 2 else 0), 0.1, 0.45 if s % 2 else 0.6)
        elif style == 'drive':
            for hit in (0, 1, 2, 2.75, 3):
                t.add(KICK, beat + hit, 0.25, 0.95)
            t.add(SNARE, beat + 1, 0.25, 0.85)
            t.add(SNARE, beat + 3, 0.25, 0.85)
            for s in range(16):
                t.add(HAT, beat + s * 0.25, 0.08, 0.6 if s % 4 == 0 else 0.4)
        elif style == 'heavy':
            for s in range(8):
                t.add(KICK, beat + s * 0.5, 0.2, 0.95 if s % 2 == 0 else 0.7)
            t.add(SNARE, beat + 1, 0.25, 0.95)
            t.add(SNARE, beat + 3, 0.25, 0.95)
            for s in range(4):
                t.add(OPEN_HAT if s == 3 else HAT, beat + s + 0.5, 0.15, 0.5)
        elif style == 'soft':
            t.add(KICK, beat, 0.25, 0.6)
            t.add(KICK, beat + 2.5, 0.25, 0.5)
            for s in range(8):
                t.add(HAT, beat + s * 0.5, 0.08, 0.3 if s % 2 else 0.4)
        if fill:
            for s in range(4):
                t.add(TOM_HI if s < 2 else TOM_LO, beat + 3 + s * 0.25, 0.2, 0.7 + s * 0.05)


def perc_part(t, bars, start_bar, style):
    for index in range(bars):
        beat = (start_bar + index) * 4
        if style == 'shaker':
            for s in range(16):
                t.add(SHAKER, beat + s * 0.25, 0.08, 0.35 if s % 2 else 0.5)
        elif style == 'conga':
            for offset, vel in ((0.5, 0.5), (1.25, 0.4), (2, 0.55), (2.75, 0.45), (3.5, 0.5)):
                t.add(CONGA, beat + offset, 0.2, vel)


def melody(t, bars, prog, start_bar, scale_root, scale, rng, rhythm, octave=5, velocity=0.62, motif_bars=2):
    """Chord tones on strong beats, scale steps between; the motif's rhythm and contour repeat
    every `motif_bars` with its pitches re-fit to the new chords, so phrases are recognisable."""
    degrees = SCALES[scale]
    base = 12 * (octave + 1) + scale_root
    pool = sorted({base + d + 12 * o for d in degrees for o in (-1, 0, 1) if 60 <= base + d + 12 * o <= 84})
    contour = [rng.choice((-2, -1, 1, 2, 0)) for _ in rhythm]
    previous = pool[len(pool) // 2]
    for index in range(bars):
        root, intervals = chord(prog[index % len(prog)])
        chord_pcs = {(root + i) % 12 for i in intervals}
        beat0 = (start_bar + index) * 4
        cycle = index % motif_bars
        for position, (offset, length) in enumerate(rhythm):
            if offset // 4 != cycle:
                continue
            strong = (offset % 4) in (0, 2)
            target = previous + contour[position] * 2
            candidates = [p for p in pool if (p % 12 in chord_pcs) or not strong]
            pitch = min(candidates, key=lambda p: (abs(p - target), p))
            t.add(pitch, beat0 + offset % 4, length, velocity * (1.05 if strong else 0.9))
            previous = pitch


def riser_part(t, start_bar, bars=1, low=60, velocity=0.4):
    steps = bars * 8
    for s in range(steps):
        t.add(low + s, start_bar * 4 + s * 0.5, 0.45, velocity + 0.3 * s / steps)


# ---------------------------------------------------------------------------------------------
# Cues
# ---------------------------------------------------------------------------------------------

RHYTHM_STRAIGHT = [(0, 1), (1, 0.5), (1.5, 0.5), (2, 1.5), (4, 0.75), (4.75, 0.25), (5, 1), (6, 2)]
RHYTHM_SYNC = [(0, 0.75), (0.75, 0.75), (1.5, 1), (3, 0.5), (4, 1.5), (5.5, 0.5), (6, 0.5), (6.5, 1.5)]
RHYTHM_DRIVE = [(0, 0.5), (0.5, 0.5), (1, 0.5), (1.5, 1.5), (3, 1), (4, 0.5), (4.5, 0.5), (5, 1), (6, 0.5), (6.5, 0.5), (7, 1)]


def cue_menu():
    rng = random.Random('menu')
    t = new_tracks()
    prog = ['Am', 'Am', 'F', 'F', 'C', 'C', 'G', 'G', 'Am', 'Am', 'F', 'F', 'Dm', 'Dm', 'E', 'E']
    pad_part(t['pad'], 16, prog, 0, velocity=0.45)
    sub_part(t['sub'], 16, prog, 0, velocity=0.55)
    arp_part(t['arp'], 12, prog[4:], 4, NOTE['A'], velocity=0.35, pattern=(0, 2, 1, 3))
    drum_part(t['drums'], 8, 8, 'soft', fill_every=0, crash_first=False)
    melody(t['lead'], 8, prog[8:], 8, NOTE['A'], 'aeolian', rng, RHYTHM_STRAIGHT, velocity=0.5)
    return {'id': 'menu', 'bpm': 92, 'bars': 16, 'tracks': t}


def cue_lab():
    rng = random.Random('lab')
    t = new_tracks()
    a = ['Am', 'F', 'C', 'G']
    b = ['Dm', 'Am', 'F', 'E']
    brk = ['F', 'G', 'Am', 'Am']
    # intro 0-4 | A 4-12 | B 12-20 | break 20-24 | A' 24-32
    pad_part(t['pad'], 4, a, 0, 0.45)
    arp_part(t['arp'], 4, a, 0, NOTE['A'], velocity=0.35)
    for start, prog, bars in ((4, a, 8), (12, b, 8), (24, a, 8)):
        pad_part(t['pad'], bars, prog, start, 0.42)
        sub_part(t['sub'], bars, prog, start)
        bass_part(t['bass'], bars, prog, start, 'offbeat')
        drum_part(t['drums'], bars, start, 'four')
        arp_part(t['arp'], bars, prog, start, NOTE['A'], pattern=(0, 1, 2, 3, 2, 1))
    melody(t['lead'], 8, b, 12, NOTE['A'], 'aeolian', rng, RHYTHM_STRAIGHT)
    pad_part(t['pad'], 4, brk, 20, 0.5)
    melody(t['lead'], 4, brk, 20, NOTE['A'], 'aeolian', rng, RHYTHM_STRAIGHT, velocity=0.55)
    riser_part(t['riser'], 23)
    melody(t['lead'], 8, a, 24, NOTE['A'], 'aeolian', rng, RHYTHM_SYNC)
    perc_part(t['perc'], 8, 24, 'shaker')
    return {'id': 'lab', 'bpm': 128, 'bars': 32, 'tracks': t}


def cue_greenhouse():
    rng = random.Random('greenhouse')
    t = new_tracks()
    a = ['Dm7', 'Dm7', 'G7', 'G7']
    b = ['BbM7', 'BbM7', 'C', 'C', 'Dm7', 'Dm7', 'Am7', 'Am7']
    for start, prog, bars in ((0, a, 8), (8, b, 8), (16, a, 8), (24, b, 8)):
        pad_part(t['pad'], bars, prog, start, 0.4)
        sub_part(t['sub'], bars, prog, start, 0.6)
        bass_part(t['bass'], bars, prog, start, 'groove', 0.65)
        drum_part(t['drums'], bars, start, 'laid')
        perc_part(t['perc'], bars, start, 'conga')
        arp_part(t['arp'], bars, prog, start, NOTE['D'], rate=0.25, pattern=(0, 2, 1, 3, 2, 4, 1, 2), velocity=0.3)
    melody(t['lead'], 8, b, 8, NOTE['D'], 'dorian', rng, RHYTHM_SYNC, velocity=0.55)
    melody(t['lead'], 8, a, 16, NOTE['D'], 'minor_pent', rng, RHYTHM_STRAIGHT, velocity=0.55)
    melody(t['lead'], 8, b, 24, NOTE['D'], 'dorian', rng, RHYTHM_SYNC, velocity=0.6)
    riser_part(t['riser'], 15, low=62)
    return {'id': 'greenhouse', 'bpm': 116, 'bars': 32, 'tracks': t}


def cue_reactor():
    rng = random.Random('reactor')
    t = new_tracks()
    a = ['Em', 'C', 'D', 'B']
    b = ['Am', 'Em', 'C', 'B']
    for start, prog, bars in ((0, a, 8), (8, b, 8), (16, a, 8), (24, b, 8)):
        pad_part(t['pad'], bars, prog, start, 0.4, stabs=start >= 16)
        sub_part(t['sub'], bars, prog, start)
        bass_part(t['bass'], bars, prog, start, 'gallop')
        drum_part(t['drums'], bars, start, 'drive')
        arp_part(t['arp'], bars, prog, start, NOTE['E'], rate=0.25, pattern=(0, 1, 2, 3), velocity=0.32, octave=5)
    perc_part(t['perc'], 16, 16, 'shaker')
    melody(t['lead'], 8, b, 8, NOTE['E'], 'harmonic', rng, RHYTHM_DRIVE)
    melody(t['lead'], 8, a, 16, NOTE['E'], 'aeolian', rng, RHYTHM_SYNC)
    melody(t['lead'], 8, b, 24, NOTE['E'], 'harmonic', rng, RHYTHM_DRIVE, velocity=0.66)
    riser_part(t['riser'], 7, low=64)
    riser_part(t['riser'], 23, low=64)
    return {'id': 'reactor', 'bpm': 136, 'bars': 32, 'tracks': t}


def cue_boss():
    rng = random.Random('boss')
    t = new_tracks()
    a = ['Cm', 'Ab', 'Fm', 'G']
    b = ['Cm', 'Bb', 'Ab', 'G']
    for start, prog, bars in ((0, a, 8), (8, b, 8), (16, a, 8), (24, b, 8)):
        pad_part(t['pad'], bars, prog, start, 0.5, stabs=True)
        sub_part(t['sub'], bars, prog, start, 0.8)
        bass_part(t['bass'], bars, prog, start, 'sixteenths', 0.75)
        drum_part(t['drums'], bars, start, 'heavy', fill_every=4)
        arp_part(t['arp'], bars, prog, start, NOTE['C'], rate=0.25, pattern=(0, 2, 1, 3), velocity=0.3)
    perc_part(t['perc'], 32, 0, 'shaker')
    melody(t['lead'], 8, a, 0, NOTE['C'], 'harmonic', rng, RHYTHM_DRIVE, velocity=0.62)
    melody(t['lead'], 8, b, 8, NOTE['C'], 'harmonic', rng, RHYTHM_SYNC, velocity=0.66)
    melody(t['lead'], 16, a + b, 16, NOTE['C'], 'harmonic', rng, RHYTHM_DRIVE, velocity=0.7)
    for start in (7, 15, 23, 31):
        riser_part(t['riser'], start, low=60, velocity=0.45)
    return {'id': 'boss', 'bpm': 150, 'bars': 32, 'tracks': t}


def cue_victory():
    t = new_tracks()
    for step, pitch in enumerate((72, 76, 79, 84)):
        t['lead'].add(pitch, step * 0.5, 0.5 if step < 3 else 3.5, 0.75)
    for bar, symbol in enumerate(('C', 'F', 'G')):
        root, intervals = chord(symbol)
        for p in voicing(root, intervals):
            t['pad'].add(p, bar * 4, 3.8 if bar < 2 else 7.8, 0.55)
        t['sub'].add(36 + root if root < 8 else 24 + root, bar * 4, 3.8, 0.7)
    t['drums'].add(CRASH, 0, 2, 0.8)
    t['drums'].add(CRASH, 8, 2, 0.8)
    return {'id': 'victory', 'bpm': 120, 'bars': 4, 'tracks': t}


def cue_defeat():
    t = new_tracks()
    for step, pitch in enumerate((76, 74, 72, 71, 69)):
        t['lead'].add(pitch, step * 1.0, 0.95 if step < 4 else 6, 0.55)
    for p in voicing(NOTE['A'], QUALITIES['m']):
        t['pad'].add(p, 0, 11.5, 0.45)
    t['sub'].add(45, 0, 11.5, 0.6)
    return {'id': 'defeat', 'bpm': 80, 'bars': 3, 'tracks': t}


CUES = [cue_menu, cue_lab, cue_greenhouse, cue_reactor, cue_boss, cue_victory, cue_defeat]


def write_mid(path, specs, bpm):
    """Standard MIDI File through the FL Studio MCP's own writer when installed, else mido."""
    try:
        from fl_studio_mcp.music.midi_export import write_midi
    except ImportError:
        write_midi = None
    if write_midi:
        write_midi(specs, bpm, path)
        return
    import mido
    ppq, bar = 480, 480 * 4
    mf = mido.MidiFile(type=1, ticks_per_beat=ppq)
    conductor = mido.MidiTrack([mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(bpm), time=0)])
    mf.tracks.append(conductor)
    for spec in specs:
        track = mido.MidiTrack([mido.MetaMessage('track_name', name=spec['name'], time=0)])
        events = []
        for n in spec['notes']:
            start = round(n['start_bars'] * bar)
            events.append((start, 1, mido.Message('note_on', note=n['pitch'], velocity=max(1, round(n['velocity'] * 127)), channel=spec['channel'])))
            events.append((start + max(1, round(n['length_bars'] * bar)), 0, mido.Message('note_off', note=n['pitch'], velocity=0, channel=spec['channel'])))
        previous = 0
        for tick, _, message in sorted(events, key=lambda e: (e[0], e[1])):
            message.time = tick - previous
            previous = tick
            track.append(message)
        mf.tracks.append(track)
    mf.save(path)


def main():
    os.makedirs(OUT, exist_ok=True)
    manifest = {}
    specs_by_cue = {}
    for build in CUES:
        cue = build()
        specs = [track.spec() for track in cue['tracks'].values() if track.notes]
        path = os.path.join(OUT, '%s.mid' % cue['id'])
        write_mid(path, specs, cue['bpm'])
        specs_by_cue[cue['id']] = {'bpm': cue['bpm'], 'tracks': specs}
        manifest[cue['id']] = {'midi': '%s.mid' % cue['id'], 'bpm': cue['bpm'], 'bars': cue['bars'],
                               'loop': cue['id'] not in ('victory', 'defeat')}
        print('%-11s %3d bpm %2d bars %4d notes  %s' % (cue['id'], cue['bpm'], cue['bars'],
              sum(len(s['notes']) for s in specs), os.path.relpath(path, ROOT)))
    with open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8') as handle:
        json.dump(manifest, handle, indent=2)
        handle.write('\n')
    with open(os.path.join(ROOT, 'tools', 'music', 'arrangements.json'), 'w', encoding='utf-8') as handle:
        json.dump(specs_by_cue, handle)
    if '--fl' in sys.argv:
        export_through_fl_mcp(specs_by_cue)


def export_through_fl_mcp(specs_by_cue):
    """Calls the FL Studio MCP's fl_export_midi tool, which writes where FL imports from."""
    import asyncio
    from fastmcp import Client
    from fl_studio_mcp.server import build_server

    async def run():
        async with Client(build_server()) as client:
            for cue_id, cue in specs_by_cue.items():
                target = os.path.join(os.path.expanduser('~'), '.flstudio-mcp', 'exports', 'leek-ops', 'leek-ops-%s.mid' % cue_id)
                result = await client.call_tool('fl_export_midi', {
                    'tracks': cue['tracks'], 'bpm': cue['bpm'], 'output_path': target,
                })
                data = result.structured_content or {}
                print('FL MCP  %-11s ok=%s  %s' % (cue_id, data.get('ok'), data.get('path')))

    asyncio.run(run())


if __name__ == '__main__':
    main()
