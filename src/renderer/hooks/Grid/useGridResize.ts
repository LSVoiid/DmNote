import { useCallback, useRef } from "react";
import { useKeyStore } from "@stores/useKeyStore";
import { usePluginDisplayElementStore } from "@stores/usePluginDisplayElementStore";
import { useHistoryStore } from "@stores/useHistoryStore";
import { useSmartGuidesStore } from "@stores/useSmartGuidesStore";
import { calculateBounds, calculateSnapPoints } from "@utils/smartGuides";
import type { SelectedElement } from "@stores/useGridSelectionStore";
import type { KeyPositions } from "@src/types/keys";
import type { ElementBounds } from "@utils/smartGuides";

interface ResizeHandle {
  id: string;
  dx: number;
  dy: number;
}

interface UseGridResizeOptions {
  selectedElements: SelectedElement[];
  selectedKeyType: string;
  onResizeEnd?: () => void;
  getOtherElements?: (excludeId: string) => ElementBounds[];
}

/**
 * 그리드에서 키 요소 리사이즈를 처리하는 훅
 * (플러그인 요소 리사이즈는 현재 지원하지 않음)
 */
export function useGridResize({
  selectedElements,
  selectedKeyType,
  onResizeEnd,
  getOtherElements,
}: UseGridResizeOptions) {
  const resizeStartRef = useRef(false);

  // 리사이즈 시작 시 히스토리 저장
  const handleResizeStart = useCallback((handle?: ResizeHandle) => {
    if (resizeStartRef.current) return;
    resizeStartRef.current = true;

    // 기존 스마트 가이드 클리어
    useSmartGuidesStore.getState().clearGuides();

    const currentPositions = useKeyStore.getState().positions;
    const currentPluginElements =
      usePluginDisplayElementStore.getState().elements;
    const { keyMappings } = useKeyStore.getState();
    useHistoryStore
      .getState()
      .pushState(keyMappings, currentPositions, currentPluginElements);
  }, []);

  // 키 리사이즈 처리 (스마트 가이드 포함)
  const handleKeyResize = useCallback(
    (
      index: number,
      newBounds: {
        x: number;
        y: number;
        width: number;
        height: number;
        handle?: ResizeHandle;
      }
    ) => {
      const positions = useKeyStore.getState().positions;
      const setPositions = useKeyStore.getState().setPositions;
      const smartGuidesStore = useSmartGuidesStore.getState();
      const elementId = `key-${index}`;

      let finalX = newBounds.x;
      let finalY = newBounds.y;
      let finalWidth = newBounds.width;
      let finalHeight = newBounds.height;

      // 스마트 가이드 계산 (getOtherElements가 제공된 경우)
      if (getOtherElements) {
        const otherElements = getOtherElements(elementId);

        // 리사이즈 중인 요소의 bounds 계산
        const draggedBounds = calculateBounds(
          newBounds.x,
          newBounds.y,
          newBounds.width,
          newBounds.height,
          elementId
        );

        const snapResult = calculateSnapPoints(draggedBounds, otherElements);
        const handle = newBounds.handle;

        if (handle) {
          // X축 스냅
          if (snapResult.didSnapX) {
            if (handle.dx === -1) {
              // 왼쪽 핸들: 왼쪽 가장자리 스냅
              const widthDiff = finalX - snapResult.snappedX;
              finalX = snapResult.snappedX;
              finalWidth = finalWidth + widthDiff;
            } else if (handle.dx === 1) {
              // 오른쪽 핸들: 오른쪽 가장자리 스냅
              const snappedRight = snapResult.snappedX + draggedBounds.width;
              finalWidth = snappedRight - finalX;
            } else if (handle.dx === 0) {
              // 수직 핸들 (상/하): 중앙 정렬 스냅
              finalX = snapResult.snappedX;
            }
          }

          // Y축 스냅
          if (snapResult.didSnapY) {
            if (handle.dy === -1) {
              // 위쪽 핸들: 위쪽 가장자리 스냅
              const heightDiff = finalY - snapResult.snappedY;
              finalY = snapResult.snappedY;
              finalHeight = finalHeight + heightDiff;
            } else if (handle.dy === 1) {
              // 아래쪽 핸들: 아래쪽 가장자리 스냅
              const snappedBottom = snapResult.snappedY + draggedBounds.height;
              finalHeight = snappedBottom - finalY;
            } else if (handle.dy === 0) {
              // 수평 핸들 (좌/우): 중앙 정렬 스냅
              finalY = snapResult.snappedY;
            }
          }

          // 스냅 후 bounds로 가이드라인 업데이트
          if (snapResult.didSnapX || snapResult.didSnapY) {
            const snappedBounds = calculateBounds(
              finalX,
              finalY,
              finalWidth,
              finalHeight,
              elementId
            );
            smartGuidesStore.setDraggedBounds(snappedBounds);
            smartGuidesStore.setActiveGuides(snapResult.guides);
          } else {
            smartGuidesStore.clearGuides();
          }
        }
      }

      const current = positions[selectedKeyType] || [];
      const nextPositions: KeyPositions = {
        ...positions,
        [selectedKeyType]: current.map((pos, i) =>
          i === index
            ? {
                ...pos,
                dx: finalX,
                dy: finalY,
                width: finalWidth,
                height: finalHeight,
              }
            : pos
        ),
      };
      setPositions(nextPositions);
    },
    [selectedKeyType, getOtherElements]
  );

  // 통합 리사이즈 핸들러 (키 요소만 지원)
  const handleResize = useCallback(
    (newBounds: {
      x: number;
      y: number;
      width: number;
      height: number;
      handle?: ResizeHandle;
    }) => {
      if (selectedElements.length !== 1) return;

      const element = selectedElements[0];
      // 키 요소만 리사이즈 지원
      if (element.type === "key" && element.index !== undefined) {
        handleKeyResize(element.index, newBounds);
      }
      // 플러그인 요소 리사이즈는 현재 지원하지 않음
    },
    [selectedElements, handleKeyResize]
  );

  // 리사이즈 종료 처리
  const handleResizeComplete = useCallback(() => {
    resizeStartRef.current = false;

    // 스마트 가이드 클리어
    useSmartGuidesStore.getState().clearGuides();

    // 백엔드에 저장
    if (selectedElements.length === 1) {
      const element = selectedElements[0];
      if (element.type === "key") {
        const positions = useKeyStore.getState().positions;
        window.api.keys.updatePositions(positions).catch((error) => {
          console.error("Failed to update key positions after resize", error);
        });
      }
    }

    onResizeEnd?.();
  }, [selectedElements, onResizeEnd]);

  return {
    handleResizeStart,
    handleResize,
    handleResizeComplete,
  };
}
