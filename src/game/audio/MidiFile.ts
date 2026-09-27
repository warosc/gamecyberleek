/** A note in seconds from the start of the song. */
export interface MidiNote {
  time: number;
  duration: number;
  pitch: number;
  /** 0..1 */
  velocity: number;
}

export interface MidiTrack {
  name: string;
  channel: number;
  notes: MidiNote[];
}

export interface MidiSong {
  bpm: number;
  /** Length of the loop in seconds, rounded up to a whole bar. */
  duration: number;
  tracks: MidiTrack[];
}

interface TempoChange { tick: number; microsPerBeat: number }

/**
 * Minimal Standard MIDI File reader (format 0 and 1): note on/off, track names and tempo.
 * Everything else — controllers, sysex, other meta events — is skipped. Enough for the
 * soundtrack the composer writes, and for files exported from FL Studio.
 */
export function parseMidi(buffer: ArrayBuffer): MidiSong {
  const view = new DataView(buffer);
  let offset = 0;
  const text = (length: number) => {
    let out = '';
    for (let index = 0; index < length; index++) out += String.fromCharCode(view.getUint8(offset + index));
    return out;
  };
  if (text(4) !== 'MThd') throw new Error('Not a MIDI file');
  const headerLength = view.getUint32(4);
  const trackCount = view.getUint16(10);
  const division = view.getUint16(12);
  if (division & 0x8000) throw new Error('SMPTE time division is not supported');
  offset = 8 + headerLength;

  const tempos: TempoChange[] = [];
  const raw: { name: string; channel: number; notes: { tick: number; end: number; pitch: number; velocity: number }[] }[] = [];

  for (let trackIndex = 0; trackIndex < trackCount && offset < view.byteLength; trackIndex++) {
    if (text(4) !== 'MTrk') throw new Error('Malformed track chunk');
    const length = view.getUint32(offset + 4);
    let cursor = offset + 8;
    const end = cursor + length;
    offset = end;
    let tick = 0;
    let status = 0;
    const track = { name: '', channel: 0, notes: [] as { tick: number; end: number; pitch: number; velocity: number }[] };
    const open = new Map<number, { tick: number; velocity: number }[]>();
    const readVar = () => {
      let value = 0;
      for (let guard = 0; guard < 4; guard++) {
        const byte = view.getUint8(cursor++);
        value = (value << 7) | (byte & 0x7f);
        if (!(byte & 0x80)) break;
      }
      return value;
    };
    const close = (pitch: number, at: number) => {
      const stack = open.get(pitch);
      const started = stack?.shift();
      if (started) track.notes.push({ tick: started.tick, end: at, pitch, velocity: started.velocity });
    };
    while (cursor < end) {
      tick += readVar();
      let byte = view.getUint8(cursor);
      if (byte & 0x80) {
        status = byte;
        cursor++;
      } else byte = status; // running status
      if (status === 0xff) {
        const type = view.getUint8(cursor++);
        const size = readVar();
        if (type === 0x03) {
          let name = '';
          for (let index = 0; index < size; index++) name += String.fromCharCode(view.getUint8(cursor + index));
          track.name = name;
        } else if (type === 0x51 && size === 3) {
          tempos.push({ tick, microsPerBeat: (view.getUint8(cursor) << 16) | (view.getUint8(cursor + 1) << 8) | view.getUint8(cursor + 2) });
        }
        cursor += size;
        continue;
      }
      if (status === 0xf0 || status === 0xf7) {
        cursor += readVar();
        continue;
      }
      const kind = status & 0xf0;
      const channel = status & 0x0f;
      const data1 = view.getUint8(cursor++);
      const data2 = kind === 0xc0 || kind === 0xd0 ? 0 : view.getUint8(cursor++);
      if (kind === 0x90 && data2 > 0) {
        track.channel = channel;
        const stack = open.get(data1) ?? [];
        stack.push({ tick, velocity: data2 / 127 });
        open.set(data1, stack);
      } else if (kind === 0x80 || (kind === 0x90 && data2 === 0)) {
        close(data1, tick);
      }
    }
    for (const [pitch] of open) while (open.get(pitch)?.length) close(pitch, tick);
    if (track.notes.length) raw.push(track);
  }

  tempos.sort((a, b) => a.tick - b.tick);
  if (!tempos.length || tempos[0].tick > 0) tempos.unshift({ tick: 0, microsPerBeat: 500000 });
  const seconds = (tick: number) => {
    let time = 0;
    for (let index = 0; index < tempos.length; index++) {
      const current = tempos[index];
      const next = tempos[index + 1];
      const until = next && next.tick < tick ? next.tick : tick;
      if (until <= current.tick) break;
      time += ((until - current.tick) / division) * (current.microsPerBeat / 1e6);
      if (!next || next.tick >= tick) break;
    }
    return time;
  };
  let lastEnd = 0;
  const tracks = raw.map(track => ({
    name: track.name,
    channel: track.channel,
    notes: track.notes
      .map(note => {
        const time = seconds(note.tick);
        const noteEnd = seconds(note.end);
        lastEnd = Math.max(lastEnd, noteEnd);
        return { time, duration: Math.max(0.01, noteEnd - time), pitch: note.pitch, velocity: note.velocity };
      })
      .sort((a, b) => a.time - b.time),
  }));
  const bpm = 60e6 / tempos[0].microsPerBeat;
  const bar = (60 / bpm) * 4;
  return { bpm, duration: Math.max(bar, Math.ceil(lastEnd / bar - 1e-6) * bar), tracks };
}
