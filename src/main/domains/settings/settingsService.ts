import type { AppStore } from "@main/store/appStore";
import {
  normalizeSettingsPatch,
  type SettingsDiff,
  type SettingsPatch,
  type SettingsPatchInput,
  type SettingsState,
} from "@src/types/settings";
import type { OverlayWindow } from "@main/windows/overlayWindow";
import type { BrowserWindow } from "electron";

export interface SettingsServiceOptions {
  store: AppStore;
  getMainWindow: () => BrowserWindow | undefined;
  overlayController: OverlayWindow;
}

export type SettingsEffect = (
  value: unknown,
  context: SettingsServiceContext
) => void;

export interface SettingsServiceContext {
  store: AppStore;
  getMainWindow: () => BrowserWindow | undefined;
  overlayController: OverlayWindow;
}

const effectMap: Record<keyof SettingsState, SettingsEffect | undefined> = {
  hardwareAcceleration: () => {},
  alwaysOnTop: (value, ctx) => {
    const win = ctx.getMainWindow();
    if (win && !win.isDestroyed()) {
      win.setAlwaysOnTop(Boolean(value));
    }
    ctx.overlayController.updateAlwaysOnTop(Boolean(value));
  },
  overlayLocked: (value, ctx) => {
    ctx.overlayController.updateOverlayLock(Boolean(value));
  },
  noteEffect: () => {},
  noteSettings: () => {},
  angleMode: () => {},
  language: () => {},
  laboratoryEnabled: () => {},
  backgroundColor: () => {},
  useCustomCSS: () => {},
  customCSS: () => {},
  overlayResizeAnchor: () => {},
};

type Listener = (diff: SettingsDiff) => void;

export class SettingsService {
  private readonly ctx: SettingsServiceContext;
  private readonly listeners = new Set<Listener>();

  constructor(options: SettingsServiceOptions) {
    this.ctx = {
      store: options.store,
      getMainWindow: options.getMainWindow,
      overlayController: options.overlayController,
    };
  }

  getSnapshot(): SettingsState {
    return this.buildState(this.ctx.store.getState());
  }

  applyPatch(patch: SettingsPatchInput): SettingsDiff {
    const current = this.getSnapshot();
    const normalizedPatch = normalizeSettingsPatch(patch, current);
    const next: SettingsState = {
      ...current,
      ...normalizedPatch,
    };

    this.ctx.store.setState({
      hardwareAcceleration: next.hardwareAcceleration,
      alwaysOnTop: next.alwaysOnTop,
      overlayLocked: next.overlayLocked,
      noteEffect: next.noteEffect,
      noteSettings: next.noteSettings,
      angleMode: next.angleMode,
      language: next.language,
      laboratoryEnabled: next.laboratoryEnabled,
      backgroundColor: next.backgroundColor,
      useCustomCSS: next.useCustomCSS,
      customCSS: next.customCSS,
      overlayResizeAnchor: next.overlayResizeAnchor,
    });

    this.runEffects(normalizedPatch);

    const diff: SettingsDiff = {
      changed: normalizedPatch,
      full: next,
    };

    this.emit(diff);

    return diff;
  }

  private buildState(raw: ReturnType<AppStore["getState"]>): SettingsState {
    return {
      hardwareAcceleration: raw.hardwareAcceleration,
      alwaysOnTop: raw.alwaysOnTop,
      overlayLocked: raw.overlayLocked,
      noteEffect: raw.noteEffect,
      noteSettings: raw.noteSettings,
      angleMode: raw.angleMode,
      language: raw.language,
      laboratoryEnabled: raw.laboratoryEnabled,
      backgroundColor: raw.backgroundColor,
      useCustomCSS: raw.useCustomCSS,
      customCSS: raw.customCSS,
      overlayResizeAnchor: raw.overlayResizeAnchor,
    };
  }

  private normalizePatch(patch: SettingsPatchInput, current: SettingsState) {
    return normalizeSettingsPatch(patch, current);
  }

  private runEffects(patch: SettingsPatch) {
    for (const key of Object.keys(patch) as (keyof SettingsState)[]) {
      const effect = effectMap[key];
      if (!effect) continue;
      try {
        effect(patch[key], this.ctx);
      } catch (error) {
        console.error(`[settings] effect failed for ${key}:`, error);
      }
    }
  }

  onChange(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(diff: SettingsDiff) {
    for (const listener of this.listeners) {
      try {
        listener(diff);
      } catch (error) {
        console.error("[settings] listener failed", error);
      }
    }
  }
}
