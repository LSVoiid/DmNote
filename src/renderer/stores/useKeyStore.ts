import { create } from "zustand";
import type { CustomTab, KeyMappings, KeyPositions } from "@src/types/keys";

interface KeyStoreState {
  selectedKeyType: string;
  customTabs: CustomTab[];
  keyMappings: KeyMappings;
  positions: KeyPositions;
  isBootstrapped: boolean;
  setSelectedKeyType: (mode: string) => void;
  setCustomTabs: (tabs: CustomTab[]) => void;
  setKeyMappings: (mappings: KeyMappings) => void;
  setPositions: (positions: KeyPositions) => void;
  setBootstrapped: (value: boolean) => void;
}

export const useKeyStore = create<KeyStoreState>((set, get) => ({
  selectedKeyType: "4key",
  customTabs: [],
  keyMappings: {} as KeyMappings,
  positions: {} as KeyPositions,
  isBootstrapped: false,
  setSelectedKeyType: (mode) => {
    set({ selectedKeyType: mode });
    if (get().isBootstrapped && typeof window !== "undefined") {
      window.api.keys.setMode(mode).catch((error) => {
        console.error("Failed to set key mode", error);
      });
    }
  },
  setCustomTabs: (tabs) => set({ customTabs: tabs }),
  setKeyMappings: (mappings) => set({ keyMappings: mappings }),
  setPositions: (positions) => set({ positions }),
  setBootstrapped: (value) => set({ isBootstrapped: value }),
}));
