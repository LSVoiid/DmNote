import type { BrowserWindow } from "electron";
import type { AppStore } from "@main/store/appStore";
import type { KeyboardService } from "@main/services/keyboardListener";
import type { OverlayWindow } from "@main/windows/overlayWindow";
import type { SettingsService } from "@main/domains/settings/settingsService";

export interface DomainContext {
  store: AppStore;
  keyboard: KeyboardService;
  settings: SettingsService;
  getMainWindow: () => BrowserWindow | undefined;
  getOverlayWindow: () => BrowserWindow | undefined;
  overlayController: OverlayWindow;
}
