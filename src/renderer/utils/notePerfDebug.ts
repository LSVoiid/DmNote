type NotePerfMode = "normal" | "pause";

export type NotePerfDebugConfig = {
  mode: NotePerfMode;
  skipRender: boolean;
  skipDraw: boolean;
  skipUpload: boolean;
  hideCanvas: boolean;
  forceDpr: number; // 0 = auto (devicePixelRatio)
  sampleFps: boolean;
};

type NotePerfDebugApi = {
  config: NotePerfDebugConfig;
  stats: { fps: number; lastSampleMs: number };
  set: (patch: Partial<NotePerfDebugConfig>) => NotePerfDebugConfig;
  reset: () => NotePerfDebugConfig;
};

const DEFAULT_CONFIG: NotePerfDebugConfig = Object.freeze({
  mode: "normal",
  skipRender: false,
  skipDraw: false,
  skipUpload: false,
  hideCanvas: false,
  forceDpr: 0,
  sampleFps: false,
});

function ensureGlobalApi(): NotePerfDebugApi {
  const w = window as any;
  if (w.__dmn_notePerfDebug) return w.__dmn_notePerfDebug as NotePerfDebugApi;

  const config: NotePerfDebugConfig = { ...DEFAULT_CONFIG };
  const stats = { fps: 0, lastSampleMs: 0 };

  const api: NotePerfDebugApi = {
    config,
    stats,
    set(patch) {
      Object.assign(config, patch);
      return config;
    },
    reset() {
      Object.assign(config, DEFAULT_CONFIG);
      return config;
    },
  };

  w.__dmn_notePerfDebug = api;
  return api;
}

export function getNotePerfDebugConfig(): NotePerfDebugConfig {
  return ensureGlobalApi().config;
}

export function getNotePerfDebugApi(): NotePerfDebugApi {
  return ensureGlobalApi();
}
