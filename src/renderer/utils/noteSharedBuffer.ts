export const NOTE_SYSTEM_MAX_NOTES = 2048 as const;

const FLOATS_PER_NOTE = 24 as const;
const HEADER_INTS = 8 as const;

export const NOTE_SYSTEM_HEADER_INTS = HEADER_INTS;
export const NOTE_SYSTEM_HEADER_BYTES = HEADER_INTS * 4;

const NOTE_INFO_FLOATS = NOTE_SYSTEM_MAX_NOTES * 3;
const NOTE_SIZE_FLOATS = NOTE_SYSTEM_MAX_NOTES * 2;
const NOTE_COLOR_FLOATS = NOTE_SYSTEM_MAX_NOTES * 4;
const NOTE_RADIUS_FLOATS = NOTE_SYSTEM_MAX_NOTES;
const NOTE_GLOW_FLOATS = NOTE_SYSTEM_MAX_NOTES * 3;
const TRACK_INDEX_FLOATS = NOTE_SYSTEM_MAX_NOTES;

export const NOTE_SYSTEM_FLOATS = NOTE_SYSTEM_MAX_NOTES * FLOATS_PER_NOTE;
export const NOTE_SYSTEM_BYTES = NOTE_SYSTEM_HEADER_BYTES + NOTE_SYSTEM_FLOATS * 4;

export type NoteSharedViews = {
  header: Int32Array;
  noteInfo: Float32Array;
  noteSize: Float32Array;
  noteColorTop: Float32Array;
  noteColorBottom: Float32Array;
  noteRadius: Float32Array;
  noteGlow: Float32Array;
  noteGlowColorTop: Float32Array;
  noteGlowColorBottom: Float32Array;
  trackIndex: Float32Array;
};

export function allocateNoteSharedBuffer(): SharedArrayBuffer {
  return new SharedArrayBuffer(NOTE_SYSTEM_BYTES);
}

export function createNoteSharedViews(buffer: SharedArrayBuffer): NoteSharedViews {
  const header = new Int32Array(buffer, 0, NOTE_SYSTEM_HEADER_INTS);
  const floats = new Float32Array(
    buffer,
    NOTE_SYSTEM_HEADER_BYTES,
    NOTE_SYSTEM_FLOATS
  );

  let offset = 0;
  const take = (len: number) => {
    const slice = floats.subarray(offset, offset + len);
    offset += len;
    return slice;
  };

  const noteInfo = take(NOTE_INFO_FLOATS);
  const noteSize = take(NOTE_SIZE_FLOATS);
  const noteColorTop = take(NOTE_COLOR_FLOATS);
  const noteColorBottom = take(NOTE_COLOR_FLOATS);
  const noteRadius = take(NOTE_RADIUS_FLOATS);
  const noteGlow = take(NOTE_GLOW_FLOATS);
  const noteGlowColorTop = take(NOTE_GLOW_FLOATS);
  const noteGlowColorBottom = take(NOTE_GLOW_FLOATS);
  const trackIndex = take(TRACK_INDEX_FLOATS);

  return {
    header,
    noteInfo,
    noteSize,
    noteColorTop,
    noteColorBottom,
    noteRadius,
    noteGlow,
    noteGlowColorTop,
    noteGlowColorBottom,
    trackIndex,
  };
}

