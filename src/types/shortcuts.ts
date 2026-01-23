export type ShortcutBinding = {
  key: string; // KeyboardEvent.code (e.g., "KeyO", "Tab", "Digit1")
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
};

export type ShortcutsState = {
  toggleOverlay: ShortcutBinding;
  toggleOverlayLock: ShortcutBinding;
  toggleAlwaysOnTop: ShortcutBinding;
  switchKeyMode: ShortcutBinding;
  toggleSettingsPanel: ShortcutBinding;
  zoomIn: ShortcutBinding;
  zoomOut: ShortcutBinding;
  resetZoom: ShortcutBinding;
};

export const DEFAULT_SHORTCUTS: ShortcutsState = {
  toggleOverlay: {
    key: "KeyO",
    ctrl: true,
    shift: true,
    alt: false,
    meta: false,
  },
  toggleOverlayLock: { key: "" },
  toggleAlwaysOnTop: { key: "" },
  switchKeyMode: {
    key: "Tab",
    ctrl: false,
    shift: false,
    alt: false,
    meta: false,
  },
  toggleSettingsPanel: {
    key: "KeyB",
    ctrl: true,
    shift: false,
    alt: false,
    meta: false,
  },
  zoomIn: {
    key: "Equal",
    ctrl: true,
    shift: false,
    alt: false,
    meta: false,
  },
  zoomOut: {
    key: "Minus",
    ctrl: true,
    shift: false,
    alt: false,
    meta: false,
  },
  resetZoom: {
    key: "Digit0",
    ctrl: true,
    shift: false,
    alt: false,
    meta: false,
  },
};
