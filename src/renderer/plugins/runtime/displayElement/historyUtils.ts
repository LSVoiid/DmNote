/**
 * 디스플레이 요소 히스토리 유틸리티
 * Undo/Redo 관련 상태 및 히스토리 저장 기능을 관리합니다.
 */

import { useKeyStore } from "@stores/useKeyStore";
import { usePluginDisplayElementStore } from "@stores/usePluginDisplayElementStore";
import { useHistoryStore } from "@stores/useHistoryStore";

// 히스토리 저장 플래그 (undo/redo 중에는 저장하지 않음)
let isUndoRedoInProgress = false;

// 초기 로드 플래그 (플러그인 초기 로드 중에는 히스토리 저장하지 않음)
let isInitialLoading = false;

/**
 * 현재 상태를 히스토리에 저장합니다.
 */
export const saveToHistory = (): void => {
  if (isUndoRedoInProgress) return;
  if (isInitialLoading) return;
  if ((window as any).__dmn_window_type !== "main") return;

  const { keyMappings, positions } = useKeyStore.getState();
  const pluginElements = usePluginDisplayElementStore.getState().elements;
  useHistoryStore.getState().pushState(keyMappings, positions, pluginElements);
};

/**
 * Undo/Redo 진행 상태를 설정합니다.
 */
export const setUndoRedoInProgress = (inProgress: boolean): void => {
  isUndoRedoInProgress = inProgress;
};

/**
 * 초기 로드 상태를 설정합니다.
 */
export const setInitialLoading = (loading: boolean): void => {
  isInitialLoading = loading;
};

/**
 * 현재 Undo/Redo 진행 상태를 반환합니다.
 */
export const getUndoRedoInProgress = (): boolean => {
  return isUndoRedoInProgress;
};

/**
 * 현재 초기 로드 상태를 반환합니다.
 */
export const getInitialLoading = (): boolean => {
  return isInitialLoading;
};
