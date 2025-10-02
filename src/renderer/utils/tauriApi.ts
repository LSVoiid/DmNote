import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import type {
  CssLoadResult,
  CssSetContentResult,
  CssTogglePayload,
  CustomTabDeleteResult,
  CustomTabResult,
  DMNoteAPI,
  KeysModeResponse,
  KeysResetAllResponse,
  OverlayBounds,
  OverlayAnchorPayload,
  OverlayLockPayload,
  OverlayResizePayload,
  OverlayState,
  OverlayVisibilityPayload,
  Unsubscribe,
  ModeChangePayload,
  CustomTabsChangePayload,
  KeyStatePayload,
  PresetOperationResult,
} from "@src/types/api";
import type { BootstrapPayload } from "@src/types/app";
import type { CustomCss } from "@src/types/css";
import type { CustomTab, KeyMappings, KeyPositions } from "@src/types/keys";
import type { SettingsState, SettingsPatchInput, SettingsDiff } from "@src/types/settings";

function subscribe<T>(event: string, listener: (payload: T) => void): Unsubscribe {
  const registration = listen<T>(event, ({ payload }) => listener(payload));
  return () => {
    registration.then((unlisten) => unlisten()).catch(() => undefined);
  };
}

const api: DMNoteAPI = {
  app: {
    bootstrap: () => invoke<BootstrapPayload>("app:bootstrap"),
    openExternal: (url: string) => invoke("app:open-external", { url }),
    restart: () => invoke("app:restart"),
  },
  window: {
    minimize: () => invoke("window:minimize"),
    close: () => invoke("window:close"),
  },
  settings: {
    get: () => invoke<SettingsState>("settings:get"),
    update: (patch: SettingsPatchInput) =>
      invoke<SettingsState>("settings:update", { patch }),
    onChanged: (listener: (diff: SettingsDiff) => void) =>
      subscribe<SettingsDiff>("settings:changed", listener),
  },
  keys: {
    get: () => invoke<KeyMappings>("keys:get"),
    update: (mappings: KeyMappings) =>
      invoke<KeyMappings>("keys:update", { mappings }),
    getPositions: () => invoke<KeyPositions>("positions:get"),
    updatePositions: (positions: KeyPositions) =>
      invoke<KeyPositions>("positions:update", { positions }),
    setMode: (mode: string) => invoke<KeysModeResponse>("keys:set-mode", { mode }),
    resetAll: () => invoke<KeysResetAllResponse>("keys:reset-all"),
    resetMode: (mode: string) => invoke<KeysModeResponse>("keys:reset-mode", { mode }),
    onChanged: (listener: (keys: KeyMappings) => void) =>
      subscribe<KeyMappings>("keys:changed", listener),
    onPositionsChanged: (listener: (positions: KeyPositions) => void) =>
      subscribe<KeyPositions>("positions:changed", listener),
    onModeChanged: (listener: (payload: ModeChangePayload) => void) =>
      subscribe<ModeChangePayload>("keys:mode-changed", listener),
    onKeyState: (listener: (payload: KeyStatePayload) => void) =>
      subscribe<KeyStatePayload>("keys:state", listener),
    customTabs: {
      list: () => invoke<CustomTab[]>("custom-tabs:list"),
      create: (name: string) => invoke<CustomTabResult>("custom-tabs:create", { name }),
      delete: (id: string) => invoke<CustomTabDeleteResult>("custom-tabs:delete", { id }),
      select: (id: string) => invoke<CustomTabDeleteResult>("custom-tabs:select", { id }),
      onChanged: (listener: (payload: CustomTabsChangePayload) => void) =>
        subscribe<CustomTabsChangePayload>("customTabs:changed", listener),
    },
  },
  overlay: {
    get: () => invoke<OverlayState>("overlay:get"),
    setVisible: (visible: boolean) => invoke("overlay:set-visible", { visible }),
    setLock: (locked: boolean) => invoke("overlay:set-lock", { locked }),
    setAnchor: (anchor: string) => invoke<string>("overlay:set-anchor", { anchor }),
    resize: (payload: {
      width: number;
      height: number;
      anchor?: string;
      contentTopOffset?: number;
    }) => invoke<OverlayBounds>("overlay:resize", { payload }),
    onVisibility: (listener: (payload: OverlayVisibilityPayload) => void) =>
      subscribe<OverlayVisibilityPayload>("overlay:visibility", listener),
    onLock: (listener: (payload: OverlayLockPayload) => void) =>
      subscribe<OverlayLockPayload>("overlay:lock", listener),
    onAnchor: (listener: (payload: OverlayAnchorPayload) => void) =>
      subscribe<OverlayAnchorPayload>("overlay:anchor", listener),
    onResized: (listener: (payload: OverlayResizePayload) => void) =>
      subscribe<OverlayResizePayload>("overlay:resized", listener),
  },
  css: {
    get: () => invoke<CustomCss>("css:get"),
    getUse: () => invoke<boolean>("css:get-use"),
    toggle: (enabled: boolean) => invoke<CssTogglePayload>("css:toggle", { enabled }),
    load: () => invoke<CssLoadResult>("css:load"),
    setContent: (content: string) =>
      invoke<CssSetContentResult>("css:set-content", { content }),
    reset: () => invoke("css:reset"),
    onUse: (listener: (payload: CssTogglePayload) => void) =>
      subscribe<CssTogglePayload>("css:use", listener),
    onContent: (listener: (payload: CustomCss) => void) =>
      subscribe<CustomCss>("css:content", listener),
  },
  presets: {
    save: () => invoke<PresetOperationResult>("preset:save"),
    load: () => invoke<PresetOperationResult>("preset:load"),
  },
};

if (typeof window !== "undefined" && !window.api) {
  window.api = api;
}

export default api;
