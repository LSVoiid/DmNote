import { ipcRouter } from "@main/core/ipcRouter";
import { DomainContext } from "@main/domains/context";
import { appStoreDefaults } from "@main/store/schema";
import { normalizeNoteSettings } from "@src/types/noteSettings";
import { SettingsState } from "@src/types/settings";
import { BootstrapPayload } from "@src/types/app";

export function registerAppDomain(ctx: DomainContext) {
  ipcRouter.handle("app:bootstrap", async (): Promise<BootstrapPayload> => {
    const state = ctx.store.getState();
    const overlayWindow = ctx.getOverlayWindow();
    const settings: SettingsState = {
      hardwareAcceleration: state.hardwareAcceleration,
      alwaysOnTop: state.alwaysOnTop,
      overlayLocked: state.overlayLocked,
      noteEffect: state.noteEffect,
      noteSettings: normalizeNoteSettings(
        state.noteSettings ?? appStoreDefaults.noteSettings
      ),
      angleMode: state.angleMode,
      language: state.language,
      laboratoryEnabled: state.laboratoryEnabled,
      backgroundColor: state.backgroundColor,
      useCustomCSS: state.useCustomCSS,
      customCSS: state.customCSS,
      overlayResizeAnchor: state.overlayResizeAnchor,
    };

    return {
      settings,
      keys: state.keys,
      positions: state.keyPositions,
      customTabs: state.customTabs,
      selectedKeyType: state.selectedKeyType,
      currentMode: ctx.keyboard.getCurrentMode(),
      overlay: {
        visible: overlayWindow ? overlayWindow.isVisible() : false,
        locked: state.overlayLocked,
        anchor: state.overlayResizeAnchor,
      },
    };
  });
}
