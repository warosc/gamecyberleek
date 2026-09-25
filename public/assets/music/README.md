# LEEK OPS soundtrack

| Cue | Where it plays | Key / tempo | Length |
|---|---|---|---|
| `menu` | Main menu and sub-menus | A minor · 92 BPM | 16 bars, loops |
| `lab` | Sector 1, Cyber Vegetable Lab | A minor · 128 BPM | 32 bars, loops |
| `greenhouse` | Sector 2, Neon Greenhouse | D dorian · 116 BPM | 32 bars, loops |
| `reactor` | Sector 3, Frozen Reactor | E minor (harmonic) · 136 BPM | 32 bars, loops |
| `boss` | Every commander fight | C minor (harmonic) · 150 BPM | 32 bars, loops |
| `victory` / `defeat` | Results screen | C major / A minor | one-shot stingers |

The `.mid` files are written by `tools/music/compose.py`, through the same writer the FL Studio
MCP's `fl_export_midi` tool uses. `python tools/music/compose.py --fl` also exports copies to
`~/.flstudio-mcp/exports/leek-ops/` via the MCP tool itself.

## How the game plays them

Until rendered audio exists, the game plays the MIDI with its own Web Audio synth
(`src/game/audio/MidiSynth.ts`). The mix is dynamic: drums, bass and pads always play; the pluck
arp and percussion join when a kill chain starts or the run enters its danger phase; the lead
hook and risers join at peak intensity and throughout the boss fight. Music ducks under the boss
arrival and phase callouts, and pauses with the game.

## Replacing the synth with FL Studio renders

Track names match the channels of the FL template project: Drums, Perc, Sub Bass, Bass Groove,
Chords Pad, Pluck Arp, Lead Hook, Riser.

1. In FL Studio: **File → Import → MIDI file**, pick e.g. `lab.mid`, and accept the channel
   mapping. Assign each imported channel to the matching instrument.
2. Set the song length to the cue's bars (table above) so the loop point is exact.
3. **File → Export → OGG** (or MP3). For looping cues, disable the tail so the file ends
   exactly on the bar.
4. Save it here as `lab.ogg` and add `"audio": "lab.ogg"` to that cue in `manifest.json`.

The game switches to the rendered file on its own. A missing or undecodable file falls back to
the synth, so a half-finished render set is safe to ship. Rendered cues play as one layer, so the
dynamic mix applies only to synth-played cues.
