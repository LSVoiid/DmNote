import { useCallback, useEffect, useMemo, useRef } from "react";
import { Channel } from "@tauri-apps/api/core";
import { DEFAULT_NOTE_SETTINGS } from "@constants/overlayConfig";
import { MAX_NOTES, createNoteBuffer } from "@stores/noteBuffer";
import {
  allocateNoteSharedBuffer,
  createNoteSharedViews,
} from "@utils/noteSharedBuffer";

const NOTE_MESSAGE_MAGIC = 0x444d4e54; // "DMNT"

const supportsSharedWorkerNotes = () =>
  typeof SharedArrayBuffer !== "undefined" && !!globalThis.crossOriginIsolated;

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

function useTauriNoteSystem({ noteEffect, noteSettings }) {
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

function useWorkerNoteSystem({ noteEffect, noteSettings }) {
  const notesRef = useRef({});
  const subscribers = useRef(new Set());
  const workerRef = useRef(null);
  const readyRef = useRef(false);
  const noteEffectRef = useRef(!!noteEffect);

  const shared = useMemo(() => {
    const buffer = allocateNoteSharedBuffer();
    const views = createNoteSharedViews(buffer);
    const noteBuffer = {
      noteInfo: views.noteInfo,
      noteSize: views.noteSize,
      noteColorTop: views.noteColorTop,
      noteColorBottom: views.noteColorBottom,
      noteRadius: views.noteRadius,
      noteGlow: views.noteGlow,
      noteGlowColorTop: views.noteGlowColorTop,
      noteGlowColorBottom: views.noteGlowColorBottom,
      trackIndex: views.trackIndex,
      activeCount: 0,
      version: 0,
      clear() {
        this.activeCount = 0;
        this.version += 1;
        this.noteInfo.fill(0);
        this.noteSize.fill(0);
        this.noteColorTop.fill(0);
        this.noteColorBottom.fill(0);
        this.noteRadius.fill(0);
        this.noteGlow.fill(0);
        this.noteGlowColorTop.fill(0);
        this.noteGlowColorBottom.fill(0);
        this.trackIndex.fill(0);
        Atomics.store(views.header, 0, this.version);
        Atomics.store(views.header, 1, 0);
      },
    };
    return { buffer, views, noteBuffer };
  }, []);

  const noteBufferRef = useRef(shared.noteBuffer);

  const notifySubscribers = useCallback((event) => {
    if (!event || subscribers.current.size === 0) return;
    subscribers.current.forEach((callback) => callback(event));
  }, []);

  const subscribe = useCallback((callback) => {
    subscribers.current.add(callback);
    return () => subscribers.current.delete(callback);
  }, []);

  useEffect(() => {
    noteEffectRef.current = !!noteEffect;
  }, [noteEffect]);

  useEffect(() => {
    const worker = new Worker(new URL("../workers/noteWorker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;
    readyRef.current = false;

    worker.onmessage = (event) => {
      const msg = event.data;
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "ready") {
        readyRef.current = true;
        return;
      }
      if (msg.type === "event" && msg.event) {
        const { activeCount, version } = msg.event;
        noteBufferRef.current.activeCount = activeCount;
        noteBufferRef.current.version = version;
        notifySubscribers(msg.event);
        return;
      }
      if (msg.type === "error") {
        console.error("[useNoteSystem] note worker error:", msg.error);
      }
    };

    worker.postMessage({ type: "init", buffer: shared.buffer });

    return () => {
      try {
        worker.postMessage({ type: "shutdown" });
      } catch (e) {
        // ignore
      }
      worker.terminate();
      workerRef.current = null;
      readyRef.current = false;
    };
  }, [notifySubscribers, shared.buffer]);

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;
    worker.postMessage({ type: "setEnabled", enabled: !!noteEffect });
  }, [noteEffect]);

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;
    worker.postMessage({
      type: "updateSettings",
      settings: noteSettings || DEFAULT_NOTE_SETTINGS,
    });
  }, [noteSettings]);

  const updateTrackLayouts = useCallback((layouts) => {
    const worker = workerRef.current;
    if (!worker) return;
    worker.postMessage({ type: "updateTrackLayouts", layouts: layouts || [] });
  }, []);

  useEffect(() => {
    if (!window.api?.keys?.onKeyState) return;
    const unsubscribe = window.api.keys.onKeyState((payload) => {
      if (!noteEffectRef.current) return;
      const worker = workerRef.current;
      if (!worker) return;
      worker.postMessage({
        type: "key",
        key: payload.key,
        state: payload.state,
        now: performance.now(),
      });
    });
    return () => {
      try {
        unsubscribe?.();
      } catch (e) {
        // ignore
      }
    };
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

export function useNoteSystem({ noteEffect, noteSettings, laboratoryEnabled }) {
  const useWorker = supportsSharedWorkerNotes();
  if (!useWorker) {
    return useTauriNoteSystem({ noteEffect, noteSettings, laboratoryEnabled });
  }
  return useWorkerNoteSystem({ noteEffect, noteSettings, laboratoryEnabled });
}

