import { BrowserWindow, screen } from "electron/main";
import path from "node:path";
import Store from "electron-store";
import windowConfig from "@main/windows/config/windowConfig";

const WINDOW_POSITION_KEY = "overlayWindowPosition";
const WINDOW_BOUNDS_KEY = "overlayWindowBounds";

type Bounds = { x: number; y: number; width: number; height: number };
export interface OverlayWindowHooks {
  onVisibilityChanged?: (visible: boolean) => void;
  shouldPreventClose?: () => boolean;
  getAlwaysOnTop?: () => boolean;
  getOverlayLocked?: () => boolean;
}

export class OverlayWindow {
  private window: BrowserWindow | null = null;
  private store = new Store();

  constructor(private hooks: OverlayWindowHooks = {}) {}

  create(): BrowserWindow {
    this.window = new BrowserWindow({
      ...windowConfig.overlay,
      webPreferences: {
        ...(windowConfig.overlay.webPreferences ?? {}),
        preload: path.join(__dirname, "..", "preload.js"),
        nodeIntegration: false,
        contextIsolation: true,
        devTools: process.env.NODE_ENV === "development",
      },
    });
    this.window.setTitle("DM Note - Overlay");
    this.restorePosition();
    this.disableContextMenu();
    this.loadContent();

    this.window.webContents.setFrameRate(0);

    if (process.env.NODE_ENV !== "development") {
      this.window.webContents.on("before-input-event", (event, input) => {
        if (input.control && input.shift && input.key.toLowerCase() === "i") {
          event.preventDefault();
        }
      });
    }

    this.window.on("close", (event) => {
      if (this.hooks.shouldPreventClose?.()) {
        event.preventDefault();
        this.window?.hide();
        this.hooks.onVisibilityChanged?.(false);
      }
    });

    this.window.on("blur", () => {
      if (!this.window || this.window.isDestroyed()) return;
      const alwaysOnTop = this.hooks.getAlwaysOnTop?.() ?? true;
      this.window.setAlwaysOnTop(alwaysOnTop, "screen-saver", 1);
    });

    this.window.on("moved", () => this.persistBounds());
    this.window.on("resized", () => this.persistBounds());

    const alwaysOnTop = this.hooks.getAlwaysOnTop?.() ?? true;
    this.window.setAlwaysOnTop(alwaysOnTop, "screen-saver", 1);

    const overlayLocked = this.hooks.getOverlayLocked?.() ?? false;
    this.window.setIgnoreMouseEvents(overlayLocked, { forward: true });

    return this.window;
  }

  get instance(): BrowserWindow | null {
    return this.window;
  }

  showInactive() {
    if (!this.window) return;
    this.window.showInactive();
    this.hooks.onVisibilityChanged?.(true);
  }

  hide() {
    if (!this.window) return;
    this.window.hide();
    this.hooks.onVisibilityChanged?.(false);
  }

  updateAlwaysOnTop(value: boolean) {
    if (!this.window) return;
    this.window.setAlwaysOnTop(value, "screen-saver", 1);
  }

  updateOverlayLock(value: boolean) {
    if (!this.window) return;
    this.window.setIgnoreMouseEvents(value, { forward: true });
  }

  setBounds(bounds: Bounds) {
    if (!this.window) return;
    const wasResizable = this.window.isResizable();
    if (!wasResizable) this.window.setResizable(true);
    this.window.setBounds(bounds);
    if (!wasResizable) this.window.setResizable(false);
    this.persistBounds();
  }

  getBounds(): Bounds | null {
    if (!this.window) return null;
    const b = this.window.getBounds();
    return { x: b.x, y: b.y, width: b.width, height: b.height };
  }

  private restorePosition() {
    if (!this.window) return;
    const savedBounds = this.store.get(WINDOW_BOUNDS_KEY) as Bounds | undefined;
    const savedPosition = this.store.get(WINDOW_POSITION_KEY) as
      | { x: number; y: number }
      | undefined;
    if (savedBounds && this.isFiniteBounds(savedBounds)) {
      try {
        this.window.setBounds(savedBounds);
        return;
      } catch {
        // ignore
      }
    }
    if (savedPosition && this.isFinitePosition(savedPosition)) {
      this.window.setPosition(savedPosition.x, savedPosition.y);
    } else {
      this.setDefaultPosition();
    }
  }

  private setDefaultPosition() {
    if (!this.window) return;
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    this.window.setPosition(width - 860, height - 320);
  }

  private disableContextMenu() {
    if (!this.window) return;
    const WM_INITMENU = 0x0116;
    this.window.hookWindowMessage(WM_INITMENU, () => {
      this.window?.setEnabled(false);
      this.window?.setEnabled(true);
    });
  }

  private loadContent() {
    if (!this.window) return;
    const isDev = process.env.NODE_ENV === "development";
    if (isDev) {
      this.window.loadURL("http://localhost:3000/overlay/index.html");
    } else {
      this.window.loadFile(
        path.join(
          __dirname,
          "..",
          "..",
          "..",
          "renderer",
          "overlay",
          "index.html"
        )
      );
    }
  }

  private persistBounds() {
    if (!this.window) return;
    const bounds = this.window.getBounds();
    this.store.set(WINDOW_BOUNDS_KEY, bounds);
    this.store.set(WINDOW_POSITION_KEY, { x: bounds.x, y: bounds.y });
  }

  private isFiniteBounds(bounds: Bounds): boolean {
    return [bounds.x, bounds.y, bounds.width, bounds.height].every((value) =>
      Number.isFinite(value)
    );
  }

  private isFinitePosition(pos: { x: number; y: number }): boolean {
    return Number.isFinite(pos.x) && Number.isFinite(pos.y);
  }
}


