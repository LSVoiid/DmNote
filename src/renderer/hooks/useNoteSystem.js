import { useCallback, useEffect, useRef } from "react";
import { Channel } from "@tauri-apps/api/core";
import { DEFAULT_NOTE_SETTINGS } from "@constants/overlayConfig";
import { createNoteBuffer, MAX_NOTES } from "@stores/noteBuffer";

const NOTE_MESSAGE_MAGIC = 0x444d4e54; // "DMNT"

const mapMessageTypeToEventType = (msgType) => {
  switch (msgType) {
    case 1:
      return "add";
    case 2:
      return "finalize";
    case 3:
      return "cleanup";
    case 4:
      return "clear";
    case 0:
    default:
      return "clear";
  }
};

const applyNoteBufferMessage = (payload, noteBuffer) => {
  if (!noteBuffer) return null;
  const buffer =
    payload instanceof ArrayBuffer ? payload : payload?.buffer ?? null;
  if (!buffer) return null;

  const view = new DataView(buffer);
  if (view.byteLength < 24) return null;
  const magic = view.getUint32(0, true);
  if (magic !== NOTE_MESSAGE_MAGIC) return null;

  const msgType = view.getUint8(4);
  const version = view.getUint32(8, true);
  const activeCount = Math.min(view.getUint32(12, true), MAX_NOTES);

  const floatData = new Float32Array(buffer, 24);
  const requiredFloats = activeCount * 24;
  if (floatData.length < requiredFloats) return null;

  let offset = 0;
  const take = (len) => {
    const slice = floatData.subarray(offset, offset + len);
    offset += len;
    return slice;
  };

  noteBuffer.noteInfo.set(take(activeCount * 3), 0);
  noteBuffer.noteSize.set(take(activeCount * 2), 0);
  noteBuffer.noteColorTop.set(take(activeCount * 4), 0);
  noteBuffer.noteColorBottom.set(take(activeCount * 4), 0);
  noteBuffer.noteRadius.set(take(activeCount), 0);
  noteBuffer.noteGlow.set(take(activeCount * 3), 0);
  noteBuffer.noteGlowColorTop.set(take(activeCount * 3), 0);
  noteBuffer.noteGlowColorBottom.set(take(activeCount * 3), 0);
  noteBuffer.trackIndex.set(take(activeCount), 0);

  noteBuffer.activeCount = activeCount;
  noteBuffer.version = version;

  return {
    type: mapMessageTypeToEventType(msgType),
    activeCount,
    version,
  };
};

export function useNoteSystem({ noteEffect, noteSettings, laboratoryEnabled }) {
  const notesRef = useRef({});
  const subscribers = useRef(new Set());
  const noteBufferRef = useRef(createNoteBuffer());
  const channelRef = useRef(null);

  const notifySubscribers = useCallback((event) => {
    if (!event || subscribers.current.size === 0) return;
    subscribers.current.forEach((callback) => callback(event));
  }, []);

  const subscribe = useCallback((callback) => {
    subscribers.current.add(callback);
    return () => subscribers.current.delete(callback);
  }, []);

  useEffect(() => {
    const channel = new Channel((payload) => {
      const event = applyNoteBufferMessage(payload, noteBufferRef.current);
      if (event) notifySubscribers(event);
    });

    channelRef.current = channel;

    window.api?.note
      ?.init(channel, performance.now())
      .catch((error) =>
        console.error("[useNoteSystem] init_note_system failed", error)
      );

    return () => {
      channelRef.current = null;
    };
  }, [notifySubscribers]);

  useEffect(() => {
    if (!window.api?.note) return;
    window.api.note
      .setEffectEnabled(!!noteEffect)
      .catch((error) =>
        console.error("[useNoteSystem] set_note_effect_enabled failed", error)
      );

    if (!noteEffect && noteBufferRef.current.activeCount > 0) {
      noteBufferRef.current.clear();
      notifySubscribers({
        type: "clear",
        activeCount: 0,
        version: noteBufferRef.current.version,
      });
    }
  }, [noteEffect, notifySubscribers]);

  useEffect(() => {
    if (!window.api?.note) return;
    window.api.note
      .updateSettings(noteSettings || DEFAULT_NOTE_SETTINGS)
      .catch((error) =>
        console.error("[useNoteSystem] update_note_settings failed", error)
      );
  }, [noteSettings]);

  const updateTrackLayouts = useCallback((layouts) => {
    if (!window.api?.note) return;
    window.api.note
      .updateTrackLayouts(layouts || [])
      .catch((error) =>
        console.error("[useNoteSystem] update_track_layouts failed", error)
      );
  }, []);

  const noOpHandler = useCallback(() => {}, []);

  return {
    notesRef,
    subscribe,
    handleKeyDown: noOpHandler,
    handleKeyUp: noOpHandler,
    noteBuffer: noteBufferRef.current,
    updateTrackLayouts,
  };
}
