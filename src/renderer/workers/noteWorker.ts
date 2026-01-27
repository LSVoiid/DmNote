import init, { NoteSystemWasm } from "../wasm/note_wasm/note_wasm.js";
import {
  createNoteSharedViews,
  NOTE_SYSTEM_MAX_NOTES,
  type NoteSharedViews,
} from "../utils/noteSharedBuffer";

type NoteEventType = "add" | "finalize" | "cleanup" | "clear";

type WorkerInboundMessage =
  | { type: "init"; buffer: SharedArrayBuffer }
  | { type: "setEnabled"; enabled: boolean }
  | { type: "updateSettings"; settings: unknown }
  | { type: "updateTrackLayouts"; layouts: unknown }
  | { type: "key"; key: string; state: string; now: number }
  | { type: "shutdown" };

type WorkerOutboundMessage =
  | { type: "ready" }
  | {
      type: "event";
      event: { type: NoteEventType; activeCount: number; version: number };
    }
  | { type: "error"; error: string };

const post = (msg: WorkerOutboundMessage) =>
  (self as unknown as Worker).postMessage(msg);

const toEventType = (code: number): NoteEventType | null => {
  switch (code) {
    case 1:
      return "add";
    case 2:
      return "finalize";
    case 3:
      return "cleanup";
    case 4:
      return "clear";
    default:
      return null;
  }
};

let shared: NoteSharedViews | null = null;
let noteSystem: NoteSystemWasm | null = null;
let wasmExports: any | null = null;

let wasmInitPromise: Promise<void> | null = null;
let pending: WorkerInboundMessage[] = [];
let readySent = false;

let tickTimer: number | null = null;

type WasmFloatViews = {
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

let cachedWasmMemory: ArrayBuffer | null = null;
let wasmViews: WasmFloatViews | null = null;

function ensureWasmViews() {
  if (!noteSystem || !wasmExports) return;
  const mem: ArrayBuffer = wasmExports.memory.buffer;
  if (wasmViews && cachedWasmMemory === mem) return;

  cachedWasmMemory = mem;
  wasmViews = {
    noteInfo: new Float32Array(mem, noteSystem.note_info_ptr(), NOTE_SYSTEM_MAX_NOTES * 3),
    noteSize: new Float32Array(mem, noteSystem.note_size_ptr(), NOTE_SYSTEM_MAX_NOTES * 2),
    noteColorTop: new Float32Array(mem, noteSystem.note_color_top_ptr(), NOTE_SYSTEM_MAX_NOTES * 4),
    noteColorBottom: new Float32Array(
      mem,
      noteSystem.note_color_bottom_ptr(),
      NOTE_SYSTEM_MAX_NOTES * 4
    ),
    noteRadius: new Float32Array(mem, noteSystem.note_radius_ptr(), NOTE_SYSTEM_MAX_NOTES),
    noteGlow: new Float32Array(mem, noteSystem.note_glow_ptr(), NOTE_SYSTEM_MAX_NOTES * 3),
    noteGlowColorTop: new Float32Array(
      mem,
      noteSystem.note_glow_color_top_ptr(),
      NOTE_SYSTEM_MAX_NOTES * 3
    ),
    noteGlowColorBottom: new Float32Array(
      mem,
      noteSystem.note_glow_color_bottom_ptr(),
      NOTE_SYSTEM_MAX_NOTES * 3
    ),
    trackIndex: new Float32Array(mem, noteSystem.track_index_ptr(), NOTE_SYSTEM_MAX_NOTES),
  };
}

function syncSharedFromWasm(): { activeCount: number; version: number } | null {
  if (!shared || !noteSystem) return null;
  ensureWasmViews();
  if (!wasmViews) return null;

  const activeCount = Math.min(noteSystem.active_count(), NOTE_SYSTEM_MAX_NOTES);
  const version = noteSystem.version();

  shared.noteInfo.set(wasmViews.noteInfo.subarray(0, activeCount * 3), 0);
  shared.noteSize.set(wasmViews.noteSize.subarray(0, activeCount * 2), 0);
  shared.noteColorTop.set(wasmViews.noteColorTop.subarray(0, activeCount * 4), 0);
  shared.noteColorBottom.set(
    wasmViews.noteColorBottom.subarray(0, activeCount * 4),
    0
  );
  shared.noteRadius.set(wasmViews.noteRadius.subarray(0, activeCount), 0);
  shared.noteGlow.set(wasmViews.noteGlow.subarray(0, activeCount * 3), 0);
  shared.noteGlowColorTop.set(
    wasmViews.noteGlowColorTop.subarray(0, activeCount * 3),
    0
  );
  shared.noteGlowColorBottom.set(
    wasmViews.noteGlowColorBottom.subarray(0, activeCount * 3),
    0
  );
  shared.trackIndex.set(wasmViews.trackIndex.subarray(0, activeCount), 0);

  Atomics.store(shared.header, 0, version);
  Atomics.store(shared.header, 1, activeCount);
  return { activeCount, version };
}

function maybeSendReady() {
  if (readySent) return;
  if (!noteSystem || !shared) return;
  readySent = true;
  syncSharedFromWasm();
  post({ type: "ready" });
}

function emitEvent(code: number) {
  const eventType = toEventType(code);
  if (!eventType) return;
  const meta = syncSharedFromWasm();
  if (!meta) return;
  post({
    type: "event",
    event: { type: eventType, activeCount: meta.activeCount, version: meta.version },
  });
}

function ensureTickLoop() {
  if (!noteSystem) return;
  if (tickTimer != null) return;
  if (!noteSystem.has_pending_work()) return;

  tickTimer = setInterval(() => {
    if (!noteSystem) return;
    const code = noteSystem.tick(performance.now());
    if (code) {
      emitEvent(code);
    }

    if (!noteSystem.has_pending_work()) {
      if (tickTimer != null) {
        clearInterval(tickTimer);
        tickTimer = null;
      }
    }
  }, 16) as unknown as number;
}

async function ensureWasmReady() {
  if (wasmInitPromise) return wasmInitPromise;

  wasmInitPromise = (async () => {
    try {
      wasmExports = await init();
      noteSystem = new NoteSystemWasm();
      maybeSendReady();
      const queued = pending;
      pending = [];
      queued.forEach(handleMessage);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : JSON.stringify(error);
      post({ type: "error", error: message });
      throw error;
    }
  })();

  return wasmInitPromise;
}

function handleMessage(message: WorkerInboundMessage) {
  if (message.type === "init") {
    shared = createNoteSharedViews(message.buffer);
    Atomics.store(shared.header, 0, 0);
    Atomics.store(shared.header, 1, 0);
    maybeSendReady();
    return;
  }

  if (!noteSystem) {
    pending.push(message);
    void ensureWasmReady();
    return;
  }

  switch (message.type) {
    case "setEnabled": {
      const code = noteSystem.set_enabled(!!message.enabled);
      if (code) {
        emitEvent(code);
      }
      ensureTickLoop();
      break;
    }
    case "updateSettings": {
      try {
        noteSystem.update_settings(message.settings as any);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : JSON.stringify(error);
        post({ type: "error", error: message });
      }
      break;
    }
    case "updateTrackLayouts": {
      try {
        noteSystem.update_track_layouts(message.layouts as any);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : JSON.stringify(error);
        post({ type: "error", error: message });
      }
      break;
    }
    case "key": {
      const now = Number.isFinite(message.now) ? message.now : performance.now();
      const state = String(message.state).toUpperCase();
      const code =
        state === "DOWN"
          ? noteSystem.on_key_down(message.key, now)
          : noteSystem.on_key_up(message.key, now);
      if (code) {
        emitEvent(code);
      }
      ensureTickLoop();
      break;
    }
    case "shutdown": {
      if (tickTimer != null) {
        clearInterval(tickTimer);
        tickTimer = null;
      }
      pending = [];
      noteSystem = null;
      wasmExports = null;
      wasmViews = null;
      cachedWasmMemory = null;
      shared = null;
      break;
    }
    default:
      break;
  }
}

self.onmessage = (event: MessageEvent<WorkerInboundMessage>) => {
  handleMessage(event.data);
};
