import { BrowserWindow } from "electron";
import {
  GlobalKeyboardListener,
  KeyboardUtils,
  type GlobalKeyboardListener as GlobalKeyboardListenerType,
} from "node-global-key-listener-extended";
import { KeyMappings } from "@src/types/keys";

const NUMPAD_SCAN_CODE_MAPPING: Record<number, string> = {
  82: "NUMPAD 0",
  79: "NUMPAD 1",
  80: "NUMPAD 2",
  81: "NUMPAD 3",
  75: "NUMPAD 4",
  76: "NUMPAD 5",
  77: "NUMPAD 6",
  71: "NUMPAD 7",
  72: "NUMPAD 8",
  73: "NUMPAD 9",
  28: "NUMPAD RETURN",
  83: "NUMPAD DELETE",
};

type KeyListenerEvent = {
  name?: string;
  vKey: number;
  state: string;
  scanCode: number;
};

export class KeyboardService {
  private listener: GlobalKeyboardListenerType;
  private overlayWindow: BrowserWindow | null = null;
  private keys: KeyMappings = {};
  private currentMode = "4key";
  private validKeySet = new Set<string>();

  constructor(initialMappings: KeyMappings) {
    this.listener = new GlobalKeyboardListener();
    this.updateKeyMapping(initialMappings);
  }

  setOverlayWindow(window: BrowserWindow | null) {
    this.overlayWindow = window;
  }

  startListening() {
    this.listener.addListener(this.handleKeyPress);
  }

  stopListening() {
    this.listener.kill();
  }

  setKeyMode(mode: string): boolean {
    if (this.keys[mode]) {
      this.currentMode = mode;
      this.rebuildValidKeySet();
      return true;
    }
    return false;
  }

  getCurrentMode(): string {
    return this.currentMode;
  }

  getKeyMappings(): KeyMappings {
    return this.keys;
  }

  updateKeyMapping(next: KeyMappings) {
    this.keys = next;
    this.rebuildValidKeySet();
  }

  private rebuildValidKeySet() {
    const currentKeys = this.keys[this.currentMode] || [];
    this.validKeySet = new Set(currentKeys);
  }

  private handleKeyPress = (event: KeyListenerEvent) => {
    let key = event.name || event.vKey.toString();
    const { state, scanCode } = event;
    const location = KeyboardUtils.getKeyLocation(event as any);

    if (location === "numpad" && NUMPAD_SCAN_CODE_MAPPING[scanCode]) {
      key = NUMPAD_SCAN_CODE_MAPPING[scanCode];
    }

    if (!this.validKeySet.has(key)) {
      return;
    }

    this.sendKeyState(key, state);
  };

  private sendKeyState(key: string, state: string) {
    const window = this.overlayWindow;
    if (!window || window.isDestroyed()) return;
    try {
      window.webContents.send("keys:state", {
        key,
        state,
        mode: this.currentMode,
      });
    } catch (error) {
      console.error("Failed to dispatch keyState:", error);
    }
  }
}
