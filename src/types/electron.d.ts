import type { DMNoteAPI } from "@src/types/api";

declare global {
  interface Window {
    api: DMNoteAPI;
  }
}

export {};
