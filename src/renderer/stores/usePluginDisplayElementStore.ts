import { create } from "zustand";
import {
  PluginDisplayElementInternal,
  PluginDefinitionInternal,
} from "@src/types/api";

// syncToOverlay 쓰로틀링을 위한 변수
let syncScheduled = false;
let pendingElements: PluginDisplayElementInternal[] | null = null;
const SYNC_THROTTLE_MS = 16; // ~60fps

// rAF 기반 state 배치 업데이트를 위한 변수
let rafScheduled = false;
let pendingStateUpdates: Map<
  string,
  Partial<PluginDisplayElementInternal>
> = new Map();

interface PluginDisplayElementStore {
  elements: PluginDisplayElementInternal[];
  definitions: Map<string, PluginDefinitionInternal>;
  addElement: (element: PluginDisplayElementInternal) => void;
  updateElement: (
    fullId: string,
    updates: Partial<PluginDisplayElementInternal>
  ) => void;
  updateElementBatched: (
    fullId: string,
    updates: Partial<PluginDisplayElementInternal>
  ) => void;
  removeElement: (fullId: string) => void;
  clearByPluginId: (pluginId: string) => void;
  setElements: (elements: PluginDisplayElementInternal[]) => void;
  registerDefinition: (definition: PluginDefinitionInternal) => void;
}

export const usePluginDisplayElementStore = create<PluginDisplayElementStore>(
  (set) => ({
    elements: [],
    definitions: new Map(),

    addElement: (element) =>
      set((state) => {
        const newElements = [...state.elements, element];
        // 메인 윈도우에서만 오버레이로 동기화
        if ((window as any).__dmn_window_type === "main") {
          syncToOverlayThrottled(newElements);
        }
        return { elements: newElements };
      }),

    updateElement: (fullId, updates) =>
      set((state) => {
        const newElements = state.elements.map((el) =>
          el.fullId === fullId ? { ...el, ...updates } : el
        );
        // 메인 윈도우에서만 오버레이로 동기화
        // state만 변경된 경우 동기화 스킵 (오버레이에서 자체 관리)
        if ((window as any).__dmn_window_type === "main") {
          const updateKeys = Object.keys(updates);
          const isStateOnlyUpdate =
            updateKeys.length === 1 && updateKeys[0] === "state";
          if (!isStateOnlyUpdate) {
            syncToOverlayThrottled(newElements);
          }
        }
        return { elements: newElements };
      }),

    // rAF 기반 배치 업데이트 (state 업데이트 최적화용)
    updateElementBatched: (fullId, updates) => {
      // 기존 pending 업데이트와 병합
      const existing = pendingStateUpdates.get(fullId) || {};
      pendingStateUpdates.set(fullId, { ...existing, ...updates });

      if (rafScheduled) return;

      rafScheduled = true;
      requestAnimationFrame(() => {
        rafScheduled = false;

        if (pendingStateUpdates.size === 0) return;

        const updates = new Map(pendingStateUpdates);
        pendingStateUpdates.clear();

        usePluginDisplayElementStore.setState((state) => {
          const newElements = state.elements.map((el) => {
            const pending = updates.get(el.fullId);
            if (pending) {
              return { ...el, ...pending };
            }
            return el;
          });
          return { elements: newElements };
        });
      });
    },

    removeElement: (fullId) =>
      set((state) => {
        const newElements = state.elements.filter((el) => el.fullId !== fullId);
        // 메인 윈도우에서만 오버레이로 동기화
        if ((window as any).__dmn_window_type === "main") {
          syncToOverlayThrottled(newElements);
        }
        return { elements: newElements };
      }),

    clearByPluginId: (pluginId) =>
      set((state) => {
        const newElements = state.elements.filter(
          (el) => el.pluginId !== pluginId
        );
        const newDefinitions = new Map(state.definitions);
        for (const [id, def] of newDefinitions.entries()) {
          if (def.pluginId === pluginId) {
            newDefinitions.delete(id);
          }
        }
        // 메인 윈도우에서만 오버레이로 동기화
        if ((window as any).__dmn_window_type === "main") {
          syncToOverlayThrottled(newElements);
        }
        return { elements: newElements, definitions: newDefinitions };
      }),

    setElements: (elements) =>
      set(() => ({
        elements,
      })),

    registerDefinition: (definition) =>
      set((state) => {
        const newDefinitions = new Map(state.definitions);
        newDefinitions.set(definition.id, definition);
        return { definitions: newDefinitions };
      }),
  })
);

// 메인 윈도우에서 오버레이로 동기화 (즉시 실행)
function syncToOverlay(elements: PluginDisplayElementInternal[]) {
  try {
    if (window.api?.bridge) {
      window.api.bridge.sendTo("overlay", "plugin:displayElements:sync", {
        elements,
      });
    }
  } catch (error) {
    console.error("[DisplayElement Store] Failed to sync to overlay:", error);
  }
}

// 쓰로틀링된 동기화 (빈번한 호출 방지)
function syncToOverlayThrottled(elements: PluginDisplayElementInternal[]) {
  pendingElements = elements;

  if (syncScheduled) return;

  syncScheduled = true;
  setTimeout(() => {
    syncScheduled = false;
    if (pendingElements) {
      syncToOverlay(pendingElements);
      pendingElements = null;
    }
  }, SYNC_THROTTLE_MS);
}
