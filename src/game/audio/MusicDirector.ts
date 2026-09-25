import type { MidiSong } from './MidiFile';
import { VOICE_LAYER, playVoice, voiceFor, type TrackVoice } from './MidiSynth';

export type MusicCue = 'menu' | 'lab' | 'greenhouse' | 'reactor' | 'boss' | 'victory' | 'defeat';
export const SECTOR_CUES: readonly MusicCue[] = ['lab', 'greenhouse', 'reactor'];

export interface CueManifestEntry {
  midi: string;
  bpm: number;
  bars: number;
  loop: boolean;
  /** A rendered file (e.g. exported from FL Studio). When present it replaces the synth. */
  audio?: string;
}
export type MusicManifest = Partial<Record<MusicCue, CueManifestEntry>>;

interface Event { time: number; duration: number; pitch: number; velocity: number; voice: TrackVoice }

interface LoadedCue {
  events: Event[];
  length: number;
  loop: boolean;
  rendered?: AudioBuffer;
  audioUrl?: string;
  loading?: boolean;
}

/** Scheduling horizon. Short enough that a pause stops the music almost at once. */
const LOOKAHEAD_S = 0.22;
/** A gap longer than this (a pause, a backgrounded tab) never fast-forwards the song. */
const MAX_STEP_S = 0.25;

/** Flattens a song into one time-sorted event list; loop length comes from the manifest bars. */
export function prepareCue(song: MidiSong, entry?: Pick<CueManifestEntry, 'bars' | 'bpm' | 'loop'>) {
  const events: Event[] = song.tracks
    .flatMap(track => track.notes.map(note => ({ ...note, voice: voiceFor(track.name, track.channel) })))
    .sort((a, b) => a.time - b.time);
  const length = entry ? entry.bars * 4 * (60 / entry.bpm) : song.duration;
  return { events, length, loop: entry?.loop ?? true };
}

/** Layer allowed for a music state; see VOICE_LAYER. */
export function layerFor(state: 'menu' | 'combat' | 'danger' | 'boss', intensity: number) {
  if (state === 'menu' || state === 'boss') return 2;
  const heat = Math.min(Math.max(Math.round(intensity), 0), 2);
  return state === 'danger' ? Math.min(2, 1 + heat) : heat;
}

/**
 * Plays the MIDI soundtrack through the synth voices on a lookahead scheduler driven by the
 * caller's clock (gameplay time in a run), so pausing the game pauses the music. One director
 * exists per AudioContext.
 */
export class MusicDirector {
  private readonly cues = new Map<MusicCue, LoadedCue>();
  private current?: MusicCue;
  private position = 0;
  private scheduledTo = 0;
  private cursor = 0;
  private loopIndex = 0;
  private lastClock = 0;
  private renderedSource?: AudioBufferSourceNode;
  private skipVoices = new Set<TrackVoice>();

  constructor(private readonly context: AudioContext, private readonly bus: GainNode) {}

  register(cue: MusicCue, song: MidiSong, entry?: CueManifestEntry, baseUrl = '') {
    const prepared = prepareCue(song, entry);
    this.cues.set(cue, { ...prepared, audioUrl: entry?.audio ? baseUrl + entry.audio : undefined });
  }

  has(cue: MusicCue) {
    return this.cues.has(cue);
  }

  /** Low-end devices drop the busiest decorative voices; the harmony and melody stay. */
  setLightweight(lightweight: boolean) {
    this.skipVoices = new Set(lightweight ? ['perc', 'arp'] : []);
  }

  update(clockMs: number, cue: MusicCue, layer: number) {
    const loaded = this.cues.get(cue);
    if (!loaded) return false;
    if (cue !== this.current) this.start(cue, clockMs);
    const step = Math.min(Math.max((clockMs - this.lastClock) / 1000, 0), MAX_STEP_S);
    this.lastClock = clockMs;
    this.position += step;
    if (loaded.rendered) return true;
    this.requestRendered(loaded, cue);
    this.schedule(loaded, layer);
    return true;
  }

  /** One-shot cue (victory, defeat) played on top of silence, independent of any clock. */
  playOnce(cue: MusicCue) {
    const loaded = this.cues.get(cue);
    if (!loaded) return false;
    this.stopRendered();
    this.current = undefined;
    const now = this.context.currentTime + 0.05;
    for (const event of loaded.events) playVoice(this.context, this.bus, event.voice, event.pitch, event.velocity, now + event.time, event.duration);
    return true;
  }

  private start(cue: MusicCue, clockMs: number) {
    this.stopRendered();
    this.current = cue;
    this.position = 0;
    this.scheduledTo = 0;
    this.cursor = 0;
    this.loopIndex = 0;
    this.lastClock = clockMs;
    const loaded = this.cues.get(cue);
    if (loaded?.rendered) this.playRendered(loaded);
  }

  private schedule(cue: LoadedCue, layer: number) {
    const until = this.position + LOOKAHEAD_S;
    const now = this.context.currentTime;
    const { events, length } = cue;
    if (!events.length) return;
    let guard = events.length * 2;
    while (guard-- > 0) {
      const event = events[this.cursor];
      const time = event.time + this.loopIndex * length;
      if (time >= until) break;
      if (time >= this.scheduledTo && VOICE_LAYER[event.voice] <= layer && !this.skipVoices.has(event.voice))
        playVoice(this.context, this.bus, event.voice, event.pitch, event.velocity, now + (time - this.position), event.duration);
      this.cursor++;
      if (this.cursor >= events.length) {
        if (!cue.loop) {
          this.cursor = events.length - 1;
          this.scheduledTo = Infinity;
          return;
        }
        this.cursor = 0;
        this.loopIndex++;
      }
    }
    this.scheduledTo = until;
  }

  private requestRendered(cue: LoadedCue, id: MusicCue) {
    if (!cue.audioUrl || cue.loading || cue.rendered) return;
    cue.loading = true;
    void fetch(cue.audioUrl)
      .then(response => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(String(response.status)))))
      .then(data => this.context.decodeAudioData(data))
      .then(buffer => {
        cue.rendered = buffer;
        // Switch over at once if this cue is still the one playing.
        if (this.current === id) this.playRendered(cue);
      })
      .catch(() => {
        // Missing or undecodable render: the synth keeps playing the MIDI.
        cue.audioUrl = undefined;
      });
  }

  private playRendered(cue: LoadedCue) {
    if (!cue.rendered) return;
    this.stopRendered();
    const source = this.context.createBufferSource();
    source.buffer = cue.rendered;
    source.loop = cue.loop;
    source.connect(this.bus);
    source.start();
    this.renderedSource = source;
  }

  private stopRendered() {
    try {
      this.renderedSource?.stop();
    } catch {
      // Already stopped.
    }
    this.renderedSource = undefined;
  }
}
