import { create } from "zustand";
import type { PluginSettingsDefinition } from "@src/types/api";
import { LAYER_PANEL_TABS, type LayerPanelTabType } from "@components/main/Grid/PropertiesPanel/types";

export type PluginSettingsPanelPayload = {
  pluginId: string;
  definition: PluginSettingsDefinition;
  settings: Record<string, any>;
  originalSettings: Record<string, any>;
  onChange: (nextSettings: Record<string, any>) => void;
  onConfirm: (
    nextSettings: Record<string, any>,
    originalSettings: Record<string, any>
  ) => void | Promise<void>;
  onCancel: (originalSettings: Record<string, any>) => void;
  resolve: (confirmed: boolean) => void;
};

interface PropertiesPanelState {
  pluginSettingsPanel: PluginSettingsPanelPayload | null;
  openPluginSettingsPanel: (payload: PluginSettingsPanelPayload) => void;
  closePluginSettingsPanel: () => void;
  
  // 캔버스 패널 (레이어 패널) 탭 상태
  canvasPanelActiveTab: LayerPanelTabType;
  setCanvasPanelActiveTab: (tab: LayerPanelTabType) => void;
}

export const usePropertiesPanelStore = create<PropertiesPanelState>(
  (set, get) => ({
    pluginSettingsPanel: null,
    openPluginSettingsPanel: (payload) => {
      const existing = get().pluginSettingsPanel;
      if (existing) {
        try {
          existing.onCancel(existing.originalSettings);
        } catch (error) {
          console.error("[Plugin Settings] Failed to cancel settings:", error);
        } finally {
          existing.resolve(false);
        }
      }
      set({ pluginSettingsPanel: payload });
    },
    closePluginSettingsPanel: () => set({ pluginSettingsPanel: null }),
    
    // 캔버스 패널 탭 상태
    canvasPanelActiveTab: LAYER_PANEL_TABS.LAYER,
    setCanvasPanelActiveTab: (tab) => set({ canvasPanelActiveTab: tab }),
  })
);
