import { BrowserWindow } from "electron/main";
import path from "node:path";
import windowConfig from "@main/windows/config/windowConfig";

export interface MainWindowHooks {
  onClose?: () => void;
}

export class MainWindow {
  private window: BrowserWindow | null = null;

  constructor(private hooks: MainWindowHooks = {}) {}

  create(): BrowserWindow {
    this.window = new BrowserWindow({
      ...windowConfig.main,
      webPreferences: {
        preload: path.join(__dirname, "..", "preload.js"),
        devTools: process.env.NODE_ENV === "development",
      },
    });

    this.window.setTitle("DM Note - Settings");

    if (process.env.NODE_ENV === "development") {
      this.window.webContents.openDevTools({ mode: "detach" });
    }

    this.window.on("close", () => {
      this.hooks.onClose?.();
    });

    this.disableContextMenu();
    this.loadContent();

    return this.window;
  }

  get instance(): BrowserWindow | null {
    return this.window;
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
      this.window.loadURL("http://localhost:3000/main/index.html");
    } else {
      this.window.loadFile(
        path.join(__dirname, "..", "..", "..", "renderer", "main", "index.html")
      );
    }
  }
}
