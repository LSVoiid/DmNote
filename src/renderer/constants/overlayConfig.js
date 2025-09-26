// 노트 효과 기본 설정
export const DEFAULT_NOTE_SETTINGS = {
  borderRadius: 2,
  speed: 180,
  trackHeight: 150,
  reverse: false,
  fadePosition: "auto",
  delayedNoteEnabled: false,
  shortNoteThresholdMs: 120,
  shortNoteMinLengthPx: 10,
};

// 기존 상수(하위 호환성 유지)
export const TRACK_HEIGHT = DEFAULT_NOTE_SETTINGS.trackHeight;
