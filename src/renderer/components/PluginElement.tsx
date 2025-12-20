import React, {
  useRef,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import {
  PluginDisplayElementInternal,
  ElementResizeAnchor,
} from "@src/types/api";
import { useDraggable } from "@hooks/Grid";
import { useHistoryStore } from "@stores/useHistoryStore";
import { useKeyStore as useKeyStoreForHistory } from "@stores/useKeyStore";
import { useSmartGuidesElements } from "@hooks/Grid";
import { useSmartGuidesStore } from "@stores/useSmartGuidesStore";
import { useSettingsStore } from "@stores/useSettingsStore";
import { GRID_SNAP } from "@hooks/Grid/constants";
import {
  calculateBounds,
  calculateSnapPoints,
  calculateGroupBounds,
} from "@utils/smartGuides";
import {
  useGridSelectionStore,
  SelectedElement,
} from "@stores/useGridSelectionStore";
import { usePluginDisplayElementStore } from "@stores/usePluginDisplayElementStore";
import { useKeyStore } from "@stores/useKeyStore";
import { useTranslation } from "@contexts/I18nContext";
import ListPopup, { ListItem } from "./main/Modal/ListPopup";
import { html, styleMap, css } from "@utils/templateEngine";
import { translatePluginMessage } from "@utils/pluginI18n";
import {
  registerExposedActions,
  clearExposedActions,
} from "@utils/displayElementActions";
import { setupPluginDropdownInteractions } from "@utils/pluginDropdownManager";

/**
 * 리사이즈 앵커에 따라 크기 변경 시 위치 보정값 계산
 */
function calculateAnchorOffset(
  anchor: ElementResizeAnchor,
  prevSize: { width: number; height: number },
  newSize: { width: number; height: number }
): { dx: number; dy: number } {
  const dw = newSize.width - prevSize.width;
  const dh = newSize.height - prevSize.height;

  let dx = 0;
  let dy = 0;

  // X축 보정 (center, right 계열)
  if (anchor.includes("center") && !anchor.startsWith("center")) {
    // top-center, bottom-center
    dx = -dw / 2;
  } else if (anchor === "center") {
    dx = -dw / 2;
  } else if (anchor.includes("right")) {
    dx = -dw;
  } else if (anchor === "center-left") {
    dx = 0;
  } else if (anchor === "center-right") {
    dx = -dw;
  }

  // Y축 보정 (center, bottom 계열)
  if (anchor.startsWith("center")) {
    // center-left, center, center-right
    dy = -dh / 2;
  } else if (anchor.startsWith("bottom")) {
    dy = -dh;
  }

  return { dx, dy };
}

interface PluginElementProps {
  element: PluginDisplayElementInternal;
  windowType: "main" | "overlay";
  positionOffset?: { x: number; y: number };
  zoom?: number;
  panX?: number;
  panY?: number;
  arrayIndex?: number;
  keyCount?: number;
  isSelected?: boolean;
  selectedElements?: SelectedElement[];
  onMultiDrag?: (deltaX: number, deltaY: number) => void;
  onMultiDragStart?: () => void;
  onMultiDragEnd?: () => void;
}

export const PluginElement: React.FC<PluginElementProps> = ({
  element,
  windowType,
  positionOffset = { x: 0, y: 0 },
  zoom = 1,
  panX = 0,
  panY = 0,
  arrayIndex = 0,
  keyCount = 0,
  isSelected = false,
  selectedElements = [],
  onMultiDrag,
  onMultiDragStart,
  onMultiDragEnd,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);
  const updateElement = usePluginDisplayElementStore(
    (state) => state.updateElement
  );
  const updateElementBatched = usePluginDisplayElementStore(
    (state) => state.updateElementBatched
  );
  const definitions = usePluginDisplayElementStore(
    (state) => state.definitions
  );
  const definition = element.definitionId
    ? definitions.get(element.definitionId)
    : undefined;
  const { i18n, t } = useTranslation();
  const locale = i18n.language;
  const localeRef = useRef(locale);

  // 이전 크기를 추적하여 리사이즈 앵커 기반 위치 보정에 사용
  // 초기값으로 element.measuredSize를 사용하여 리로드 후에도 올바르게 동작
  const prevMeasuredSizeRef = useRef<{ width: number; height: number } | null>(
    element.measuredSize ? { ...element.measuredSize } : null
  );

  // 이전 앵커를 추적하여 앵커 변경 시 prevMeasuredSizeRef 리셋
  const prevAnchorRef = useRef<string | undefined>(
    element.resizeAnchor || definition?.resizeAnchor || "top-left"
  );

  // 이전 줌 값을 추적하여 줌 변경 시 위치 보정을 스킵
  const prevZoomRef = useRef<number>(zoom);

  // 앵커가 변경되면 prevMeasuredSizeRef를 현재 크기로 리셋
  // 이렇게 하면 앵커 변경 직후의 크기 변화에서 불필요한 위치 보정이 발생하지 않음
  useEffect(() => {
    const currentAnchor =
      element.resizeAnchor || definition?.resizeAnchor || "top-left";
    if (prevAnchorRef.current !== currentAnchor) {
      // 앵커가 변경됨 - 현재 측정된 크기로 리셋
      if (element.measuredSize) {
        prevMeasuredSizeRef.current = { ...element.measuredSize };
      }
      prevAnchorRef.current = currentAnchor;
    }
  }, [element.resizeAnchor, definition?.resizeAnchor, element.measuredSize]);

  // element.measuredSize가 외부에서 변경될 때(리사이즈 등) userPreservedSizeRef 업데이트
  // 단, needsRemeasure 상태가 아닐 때만 (설정 변경으로 인한 재측정 중에는 스킵)
  useEffect(() => {
    if (
      windowType === "main" &&
      definition?.resizable &&
      element.measuredSize &&
      !needsRemeasureRef.current
    ) {
      userPreservedSizeRef.current = { ...element.measuredSize };
    }
  }, [windowType, definition?.resizable, element.measuredSize]);

  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);

  const pluginTranslate = useCallback(
    (
      key: string,
      params?: Record<string, string | number>,
      fallback?: string
    ) =>
      translatePluginMessage({
        messages: definition?.messages,
        locale,
        key,
        params,
        fallback,
      }),
    [definition?.messages, locale]
  );

  const pluginTranslateStable = useCallback(
    (
      key: string,
      params?: Record<string, string | number>,
      fallback?: string
    ) =>
      translatePluginMessage({
        messages: definition?.messages,
        locale: localeRef.current,
        key,
        params,
        fallback,
      }),
    [definition?.messages]
  );

  const positions = useKeyStore((state) => state.positions);
  const selectedKeyType = useKeyStore((state) => state.selectedKeyType);
  const exposedActionsRef = useRef<Record<string, (...args: any[]) => any>>({});

  // Settings 변경 감지용 ref와 콜백 리스트
  const prevSettingsRef = useRef<Record<string, any> | null>(null);
  const settingsChangeListenersRef = useRef<
    Set<
      (
        newSettings: Record<string, any>,
        oldSettings: Record<string, any>
      ) => void
    >
  >(new Set());

  // Settings 변경 감지 (overlay에서만 - 리스너 콜백용)
  useEffect(() => {
    if (windowType !== "overlay") return;

    const currentSettings = element.settings || {};
    const prevSettings = prevSettingsRef.current;

    // 최초 마운트 시에는 이전 설정 저장만
    if (prevSettings === null) {
      prevSettingsRef.current = { ...currentSettings };
      return;
    }

    // 설정이 실제로 변경되었는지 확인
    const hasChanged =
      JSON.stringify(currentSettings) !== JSON.stringify(prevSettings);

    if (hasChanged) {
      // 모든 리스너에게 변경 알림
      settingsChangeListenersRef.current.forEach((listener) => {
        try {
          listener(currentSettings, prevSettings);
        } catch (error) {
          console.error(
            "[PluginElement] onSettingsChange listener error:",
            error
          );
        }
      });

      // 이전 설정 업데이트
      prevSettingsRef.current = { ...currentSettings };
    }
  }, [windowType, element.settings]);

  // Settings 변경 시 measuredSize 리셋 (main 윈도우, resizable 요소만)
  // 설정 변경으로 UI가 변할 수 있으므로 새로 측정하도록 함
  const prevSettingsForResizeRef = useRef<Record<string, any> | null>(null);
  // 설정 변경으로 재측정이 필요한 상태인지 플래그
  const needsRemeasureRef = useRef(false);
  // 사용자가 설정한(또는 초기 측정된) preserveAxis 축의 크기
  // 이 값은 리사이즈나 초기 측정 시에만 업데이트되고, 설정 변경 시에는 유지됨
  const userPreservedSizeRef = useRef<{
    width: number;
    height: number;
  } | null>(null);
  // 설정별 크기 히스토리 (설정 JSON -> 크기 매핑)
  const settingsSizeHistoryRef = useRef<
    Map<string, { width: number; height: number }>
  >(new Map());

  useEffect(() => {
    if (windowType !== "main") return;
    if (!definition?.resizable) return;

    const currentSettings = element.settings || {};
    const prevSettings = prevSettingsForResizeRef.current;

    // 최초 마운트 시에는 이전 설정 저장만
    if (prevSettings === null) {
      prevSettingsForResizeRef.current = { ...currentSettings };
      // 초기 설정에 대한 크기 저장
      if (element.measuredSize) {
        const settingsKey = JSON.stringify(currentSettings);
        settingsSizeHistoryRef.current.set(settingsKey, {
          ...element.measuredSize,
        });
      }
      return;
    }

    // 설정이 실제로 변경되었는지 확인 (JSON 문자열 비교)
    const currentStr = JSON.stringify(currentSettings);
    const prevStr = JSON.stringify(prevSettings);
    const hasChanged = currentStr !== prevStr;

    if (hasChanged) {
      // 이전 설정에 대한 현재 크기 저장 (나중에 복원용)
      if (element.measuredSize) {
        settingsSizeHistoryRef.current.set(prevStr, {
          ...element.measuredSize,
        });
      }

      // 현재 설정에 대해 저장된 크기가 있으면 복원, 없으면 재측정
      const savedSize = settingsSizeHistoryRef.current.get(currentStr);
      if (savedSize) {
        // 저장된 크기로 즉시 복원 (width, height도 함께 업데이트)
        const currentSize = element.measuredSize;
        const resizeAnchor: ElementResizeAnchor =
          element.resizeAnchor || definition?.resizeAnchor || "top-left";

        // 앵커 기반 위치 보정 계산
        let newPosition = element.position;
        if (currentSize && resizeAnchor !== "top-left") {
          const { dx, dy } = calculateAnchorOffset(
            resizeAnchor,
            currentSize,
            savedSize
          );
          if (dx !== 0 || dy !== 0) {
            newPosition = {
              x: element.position.x + dx,
              y: element.position.y + dy,
            };
          }
        }

        updateElement(element.fullId, {
          measuredSize: savedSize,
          width: savedSize.width,
          height: savedSize.height,
          position: newPosition,
        });
        prevMeasuredSizeRef.current = savedSize;
      } else {
        // 재측정 필요 플래그 설정
        needsRemeasureRef.current = true;
      }

      // 이전 설정 업데이트
      prevSettingsForResizeRef.current = { ...currentSettings };
    }
  }, [
    windowType,
    definition?.resizable,
    element.settings,
    element.fullId,
    element.measuredSize,
    updateElement,
  ]);

  // 컨텍스트 메뉴 상태
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({
    x: 0,
    y: 0,
  });

  // 앵커 기반 위치 계산
  const calculatedPosition = useMemo(() => {
    let baseX = element.position.x;
    let baseY = element.position.y;

    // 앵커가 있으면 키 위치 기반으로 계산
    if (element.anchor?.keyCode && positions && selectedKeyType) {
      const keyMappings = useKeyStore.getState().keyMappings;
      const modeKeys = keyMappings[selectedKeyType] || [];
      const keyIndex = modeKeys.findIndex(
        (key) => key === element.anchor?.keyCode
      );

      if (keyIndex >= 0 && positions[selectedKeyType]?.[keyIndex]) {
        const keyPosition = positions[selectedKeyType][keyIndex];
        const offsetX = element.anchor.offset?.x ?? 0;
        const offsetY = element.anchor.offset?.y ?? 0;

        baseX = keyPosition.dx + offsetX;
        baseY = keyPosition.dy + offsetY;
      }
    }

    // 오버레이에서는 positionOffset 적용
    return {
      x: baseX + positionOffset.x,
      y: baseY + positionOffset.y,
    };
  }, [
    element.anchor,
    element.position,
    positions,
    selectedKeyType,
    positionOffset,
  ]);

  // 히스토리 저장 함수 (드래그 시작 시 호출)
  const saveToHistory = useCallback(() => {
    if (windowType !== "main") return;

    const { keyMappings, positions } = useKeyStoreForHistory.getState();
    const pluginElements = usePluginDisplayElementStore.getState().elements;
    useHistoryStore
      .getState()
      .pushState(keyMappings, positions, pluginElements);
  }, [windowType]);

  // 스마트 가이드를 위한 다른 요소들의 bounds 가져오기
  const { getOtherElements } = useSmartGuidesElements();

  // 선택 드래그 상태
  const multiDragRef = useRef<{
    isDragging: boolean;
    startX: number;
    startY: number;
    lastSnappedDeltaX: number;
    lastSnappedDeltaY: number;
  }>({
    isDragging: false,
    startX: 0,
    startY: 0,
    lastSnappedDeltaX: 0,
    lastSnappedDeltaY: 0,
  });

  // 선택된 상태면 선택 모드 활성화
  const isSelectionMode = isSelected;

  // 드래그 지원 (main 윈도우에서만)
  const draggable = useDraggable({
    gridSize: GRID_SNAP,
    initialX: calculatedPosition.x,
    initialY: calculatedPosition.y,
    onDragStart: saveToHistory, // 드래그 시작 시 히스토리 저장
    onPositionChange: (newX, newY) => {
      // 선택 모드가 아닐 때만 개별 이동
      if (windowType === "main" && element.draggable && !isSelectionMode) {
        updateElement(element.fullId, {
          position: { x: newX, y: newY },
          anchor: undefined, // 드래그하면 앵커 제거
        });

        // onPositionChange 핸들러 호출 (자동 래핑되어 있음)
        if (
          element.onPositionChange &&
          typeof element.onPositionChange === "string"
        ) {
          const handler = (window as any)[element.onPositionChange];
          if (typeof handler === "function") {
            handler({ x: newX, y: newY });
          }
        }
      }
    },
    zoom,
    panX,
    panY,
    // 스마트 가이드 옵션
    elementId: element.fullId,
    elementWidth: element.measuredSize?.width || 100,
    elementHeight: element.measuredSize?.height || 100,
    getOtherElements: windowType === "main" ? getOtherElements : null,
    // 선택 모드에서는 개별 드래그 비활성화
    disabled: isSelectionMode,
  });

  // 선택 요소 드래그 핸들러 (스마트 가이드 포함)
  const handleSelectionDragMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isSelectionMode || e.button !== 0) return;

      e.preventDefault();
      e.stopPropagation();

      // 드래그 시작 전 기존 스마트 가이드 클리어 (이전 드래그가 정상 종료되지 않은 경우 대비)
      useSmartGuidesStore.getState().clearGuides();

      // 드래그 시작 시 히스토리 저장
      onMultiDragStart?.();

      // 현재 요소의 시작 위치 저장 (스냅 계산용)
      const startX = element.position.x;
      const startY = element.position.y;
      const currentWidth =
        element.measuredSize?.width ?? element.estimatedSize?.width ?? 200;
      const currentHeight =
        element.measuredSize?.height ?? element.estimatedSize?.height ?? 150;
      const elementId = element.fullId;

      multiDragRef.current = {
        isDragging: true,
        startX: e.clientX,
        startY: e.clientY,
        lastSnappedDeltaX: 0,
        lastSnappedDeltaY: 0,
      };

      let rafId: number | null = null;
      // 드래그 종료 플래그 (rAF 콜백에서 체크)
      let dragEnded = false;
      const smartGuidesStore = useSmartGuidesStore.getState();

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!multiDragRef.current.isDragging || dragEnded) return;

        if (rafId) return;
        rafId = requestAnimationFrame(() => {
          rafId = null;

          // 드래그가 종료되었으면 rAF 콜백에서도 무시
          if (dragEnded) return;

          const currentZoom = zoom;
          // raw delta (스냅 전)
          const rawDeltaX =
            (moveEvent.clientX - multiDragRef.current.startX) / currentZoom;
          const rawDeltaY =
            (moveEvent.clientY - multiDragRef.current.startY) / currentZoom;

          // 이동 후 예상 위치
          const newX = startX + rawDeltaX;
          const newY = startY + rawDeltaY;

          // 스마트 가이드 계산 (현재 요소 기준으로 다른 비선택 요소들과 스냅)
          const otherElements = getOtherElements(elementId);

          // gridSettings에서 정렬/간격 가이드 활성화 여부 확인
          const gridSettings = useSettingsStore.getState().gridSettings;
          const alignmentGuidesEnabled =
            gridSettings?.alignmentGuides !== false;
          const spacingGuidesEnabled = gridSettings?.spacingGuides !== false;

          // 선택된 다른 요소들도 제외 (자기 자신만 기준)
          const nonSelectedElements = otherElements.filter(
            (el) =>
              !selectedElements.some(
                (sel) =>
                  sel.id === el.id ||
                  (sel.type === "key" && el.id === `key-${sel.index}`)
              )
          );

          const draggedBounds = calculateBounds(
            newX,
            newY,
            currentWidth,
            currentHeight,
            elementId
          );

          // 다중 선택 시 그룹 전체의 bounds 계산 (캔버스 중앙 스냅용)
          let groupBounds = null;
          if (selectedElements.length > 1) {
            // 선택된 요소들의 현재 bounds 수집
            const selectedBoundsArray = selectedElements
              .map((sel) => {
                // 현재 드래그 중인 요소인 경우 새 위치 사용
                if (sel.id === elementId) {
                  return draggedBounds;
                }
                // 다른 선택된 요소들은 otherElements에서 찾아서 이동량 적용
                const found = otherElements.find(
                  (el) =>
                    el.id === sel.id ||
                    (sel.type === "key" && el.id === `key-${sel.index}`)
                );
                if (found) {
                  return calculateBounds(
                    found.left + rawDeltaX,
                    found.top + rawDeltaY,
                    found.width,
                    found.height,
                    found.id
                  );
                }
                return null;
              })
              .filter((b): b is NonNullable<typeof b> => b !== null);
            groupBounds = calculateGroupBounds(selectedBoundsArray);
          }

          // 다중 선택 시 그룹 바운딩 박스를 스냅 기준으로 사용
          const snapTargetBounds =
            selectedElements.length > 1 && groupBounds
              ? groupBounds
              : draggedBounds;

          const snapResult = alignmentGuidesEnabled
            ? calculateSnapPoints(
                snapTargetBounds,
                nonSelectedElements,
                undefined,
                {
                  groupBounds,
                  disableSpacing: !spacingGuidesEnabled,
                }
              )
            : null;

          let finalX = newX;
          let finalY = newY;

          // 스마트 가이드 스냅 적용
          if (snapResult?.didSnapX) {
            // 다중 선택 시: 그룹 바운딩 박스의 스냅 이동량을 개별 요소에 적용
            if (selectedElements.length > 1 && groupBounds) {
              const groupSnapDeltaX = snapResult.snappedX - groupBounds.left;
              finalX = newX + groupSnapDeltaX;
            } else {
              finalX = snapResult.snappedX;
            }
          } else {
            // 그리드 스냅
            finalX = Math.round(newX / GRID_SNAP) * GRID_SNAP;
          }

          if (snapResult?.didSnapY) {
            // 다중 선택 시: 그룹 바운딩 박스의 스냅 이동량을 개별 요소에 적용
            if (selectedElements.length > 1 && groupBounds) {
              const groupSnapDeltaY = snapResult.snappedY - groupBounds.top;
              finalY = newY + groupSnapDeltaY;
            } else {
              finalY = snapResult.snappedY;
            }
          } else {
            // 그리드 스냅
            finalY = Math.round(newY / GRID_SNAP) * GRID_SNAP;
          }

          // 스냅된 delta 계산
          const snappedDeltaX = Math.round(finalX - startX);
          const snappedDeltaY = Math.round(finalY - startY);

          // 가이드라인 업데이트
          if (snapResult && (snapResult.didSnapX || snapResult.didSnapY)) {
            // 다중 선택 시 그룹 바운딩 박스를 표시
            const displayBounds =
              selectedElements.length > 1 && groupBounds
                ? calculateBounds(
                    groupBounds.left +
                      (snapResult.didSnapX
                        ? snapResult.snappedX - groupBounds.left
                        : 0),
                    groupBounds.top +
                      (snapResult.didSnapY
                        ? snapResult.snappedY - groupBounds.top
                        : 0),
                    groupBounds.width,
                    groupBounds.height,
                    "group"
                  )
                : calculateBounds(
                    finalX,
                    finalY,
                    currentWidth,
                    currentHeight,
                    elementId
                  );
            smartGuidesStore.setDraggedBounds(displayBounds);
            smartGuidesStore.setActiveGuides(snapResult.guides);

            // 간격 가이드도 업데이트
            if (
              spacingGuidesEnabled &&
              snapResult.spacingGuides &&
              snapResult.spacingGuides.length > 0
            ) {
              smartGuidesStore.setSpacingGuides(snapResult.spacingGuides);
            } else {
              smartGuidesStore.setSpacingGuides([]);
            }
          } else {
            smartGuidesStore.clearGuides();
          }

          // 이전 delta와의 차이만큼 이동
          const moveDeltaX =
            snappedDeltaX - multiDragRef.current.lastSnappedDeltaX;
          const moveDeltaY =
            snappedDeltaY - multiDragRef.current.lastSnappedDeltaY;

          if (moveDeltaX !== 0 || moveDeltaY !== 0) {
            multiDragRef.current.lastSnappedDeltaX = snappedDeltaX;
            multiDragRef.current.lastSnappedDeltaY = snappedDeltaY;
            onMultiDrag?.(moveDeltaX, moveDeltaY);
          }
        });
      };

      const handleMouseUp = () => {
        // 드래그 종료 플래그 설정 (rAF 콜백 무시)
        dragEnded = true;
        // 진행 중인 rAF 취소
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        multiDragRef.current.isDragging = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        // window blur 시에도 cleanup 되도록 이벤트 제거
        window.removeEventListener("blur", handleMouseUp);
        // 스마트 가이드 클리어
        useSmartGuidesStore.getState().clearGuides();
        // 드래그 종료 시 오버레이 동기화
        onMultiDragEnd?.();
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      // window blur 시에도 드래그 종료 처리 (창이 포커스를 잃었을 때)
      window.addEventListener("blur", handleMouseUp);
    },
    [
      isSelectionMode,
      zoom,
      onMultiDrag,
      onMultiDragStart,
      onMultiDragEnd,
      element.position.x,
      element.position.y,
      element.measuredSize,
      element.estimatedSize,
      element.fullId,
      getOtherElements,
      selectedElements,
    ]
  );

  const { ref: draggableRef, dx: renderX, dy: renderY } = draggable;

  // Shadow DOM 설정 (scoped 옵션)
  useEffect(() => {
    if (element.scoped && containerRef.current && !shadowRoot) {
      try {
        // 이미 shadowRoot가 있는지 확인
        if (containerRef.current.shadowRoot) {
          setShadowRoot(containerRef.current.shadowRoot);
        } else {
          const root = containerRef.current.attachShadow({
            mode: "open",
          });
          setShadowRoot(root);
        }
      } catch (err) {
        console.warn(
          `[PluginElement] Shadow DOM already attached for ${element.fullId}`
        );
      }
    }
  }, [element.scoped, element.fullId, shadowRoot]);

  // 템플릿 렌더링 결과 계산
  const renderedContent = useMemo(() => {
    if (definition && definition.template) {
      const state = element.state || {};
      const settings = element.settings || {};

      const renderState =
        windowType === "main" && definition.previewState
          ? { ...state, ...definition.previewState }
          : state;

      try {
        return definition.template(renderState, settings, {
          html: html as any,
          styleMap,
          css,
          locale,
          t: pluginTranslate,
        });
      } catch (error) {
        console.error(`[PluginElement] Template render error:`, error);
        return null;
      }
    }
    return null;
  }, [
    definition,
    element.state,
    element.settings,
    windowType,
    locale,
    pluginTranslate,
  ]);

  // 이벤트 위임 (메인 윈도우에서만)
  useEffect(() => {
    const target = element.scoped ? shadowRoot : containerRef.current;
    if (!target) return;

    // 메인 윈도우에서만 실제 크기 측정 후 store 업데이트
    // resizable인 경우: 이미 measuredSize가 있고 재측정이 필요하지 않으면 스킵
    const isResizableWithSize =
      definition?.resizable &&
      element.measuredSize &&
      !needsRemeasureRef.current;

    if (windowType === "main" && containerRef.current && !isResizableWithSize) {
      requestAnimationFrame(() => {
        if (containerRef.current) {
          // 재측정이 필요한 경우, 일시적으로 크기 제약을 풀어 자연스러운 콘텐츠 크기 측정
          const needsRemeasure =
            needsRemeasureRef.current && definition?.resizable;
          const preserveAxis = definition?.preserveAxis || "both";

          let originalWidth = "";
          let originalHeight = "";

          if (needsRemeasure) {
            originalWidth = containerRef.current.style.width;
            originalHeight = containerRef.current.style.height;

            // preserveAxis에 따라 해제할 축 결정
            if (preserveAxis !== "width" && preserveAxis !== "both") {
              containerRef.current.style.width = "auto";
            }
            if (preserveAxis !== "height" && preserveAxis !== "both") {
              containerRef.current.style.height = "auto";
            }
          }

          const rect = containerRef.current.getBoundingClientRect();
          const measuredWidth = Math.ceil(rect.width / zoom);
          const measuredHeight = Math.ceil(rect.height / zoom);

          // 스타일 복원
          if (needsRemeasure) {
            containerRef.current.style.width = originalWidth;
            containerRef.current.style.height = originalHeight;
          }

          // 설정 변경으로 인한 재측정인 경우, preserveAxis에 해당하는 축은 유지
          let finalWidth = measuredWidth;
          let finalHeight = measuredHeight;
          const userPreservedSize = userPreservedSizeRef.current;

          if (definition?.resizable && needsRemeasureRef.current) {
            // preserveAxis에 따라 각 축 유지 여부 결정
            const shouldPreserveWidth =
              preserveAxis === "width" || preserveAxis === "both";
            const shouldPreserveHeight =
              preserveAxis === "height" || preserveAxis === "both";

            // 가로: 유지 설정이고 저장된 값이 있으면 그 값 사용
            if (shouldPreserveWidth && userPreservedSize) {
              finalWidth = userPreservedSize.width;
            }
            // 세로: 유지 설정이고 저장된 값이 있으면 그 값 사용
            if (shouldPreserveHeight && userPreservedSize) {
              finalHeight = userPreservedSize.height;
            }
            needsRemeasureRef.current = false;
          }

          // 초기 측정 시 또는 콘텐츠가 커진 경우 userPreservedSizeRef 업데이트
          if (!userPreservedSize) {
            userPreservedSizeRef.current = {
              width: finalWidth,
              height: finalHeight,
            };
          }

          const newSize = { width: finalWidth, height: finalHeight };

          // 줌이 변경되었는지 확인
          const zoomChanged = prevZoomRef.current !== zoom;
          prevZoomRef.current = zoom;

          // 현재 크기와 이전 크기 비교
          const prevSize = prevMeasuredSizeRef.current;
          const sizeChanged =
            !element.measuredSize ||
            element.measuredSize.width !== finalWidth ||
            element.measuredSize.height !== finalHeight;

          if (sizeChanged) {
            // 리사이즈 앵커 결정 (우선순위: element > definition > default)
            const resizeAnchor: ElementResizeAnchor =
              element.resizeAnchor || definition?.resizeAnchor || "top-left";

            // 줌 변경으로 인한 크기 측정 차이는 위치 보정하지 않음
            // 실제 콘텐츠 변화에 의한 크기 변경만 위치 보정
            const shouldAdjustPosition =
              prevSize && resizeAnchor !== "top-left" && !zoomChanged;

            if (shouldAdjustPosition) {
              const { dx, dy } = calculateAnchorOffset(
                resizeAnchor,
                prevSize,
                newSize
              );

              if (dx !== 0 || dy !== 0) {
                // 위치와 크기를 함께 업데이트
                updateElement(element.fullId, {
                  position: {
                    x: element.position.x + dx,
                    y: element.position.y + dy,
                  },
                  measuredSize: newSize,
                });
              } else {
                updateElement(element.fullId, {
                  measuredSize: newSize,
                });
              }
            } else {
              // 첫 측정이거나 top-left 앵커이거나 줌 변경인 경우 크기만 업데이트
              updateElement(element.fullId, {
                measuredSize: newSize,
              });
            }

            // 이전 크기 저장
            prevMeasuredSizeRef.current = newSize;
          }
        }
      });
    }

    // data-plugin-handler 이벤트 위임 (메인 윈도우에서만)
    if (windowType === "main") {
      // Input blur 핸들러: min/max 자동 정규화
      const handleInputBlur = (e: Event) => {
        const targetEl = e.target as HTMLInputElement;
        if (
          targetEl.tagName === "INPUT" &&
          targetEl.type === "number" &&
          targetEl.hasAttribute("data-plugin-input-blur")
        ) {
          const minStr = targetEl.getAttribute("data-plugin-input-min");
          const maxStr = targetEl.getAttribute("data-plugin-input-max");
          const currentValue = targetEl.value;

          // 빈 값이거나 숫자가 아닌 경우
          if (currentValue === "" || isNaN(parseFloat(currentValue))) {
            // min이 있으면 min으로, 없으면 0으로
            const defaultValue = minStr ? parseFloat(minStr) : 0;
            targetEl.value = String(defaultValue);
            // change 이벤트 발생
            targetEl.dispatchEvent(new Event("change", { bubbles: true }));
            return;
          }

          const numValue = parseFloat(currentValue);
          let clampedValue = numValue;

          // min/max 범위로 제한
          if (minStr && numValue < parseFloat(minStr)) {
            clampedValue = parseFloat(minStr);
          }
          if (maxStr && numValue > parseFloat(maxStr)) {
            clampedValue = parseFloat(maxStr);
          }

          // 값이 변경되었으면 업데이트
          if (clampedValue !== numValue) {
            targetEl.value = String(clampedValue);
            // change 이벤트 발생
            targetEl.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }
      };

      // 체크박스 토글 기능
      const handleCheckboxToggle = (e: Event) => {
        const targetEl = e.target as HTMLElement;
        const checkbox = targetEl.closest("[data-checkbox-toggle]");
        if (checkbox) {
          const input = checkbox.querySelector(
            "input[type=checkbox]"
          ) as HTMLInputElement;
          const knob = checkbox.querySelector("div") as HTMLElement;

          if (input) {
            input.checked = !input.checked;

            // 스타일 토글
            if (input.checked) {
              checkbox.classList.remove("bg-[#3B4049]");
              checkbox.classList.add("bg-[#493C1D]");
              knob.classList.remove("left-[2px]", "bg-[#989BA6]");
              knob.classList.add("left-[13px]", "bg-[#FFB400]");
            } else {
              checkbox.classList.remove("bg-[#493C1D]");
              checkbox.classList.add("bg-[#3B4049]");
              knob.classList.remove("left-[13px]", "bg-[#FFB400]");
              knob.classList.add("left-[2px]", "bg-[#989BA6]");
            }

            // change 이벤트 발생
            input.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }
      };

      const handleEvent = (e: Event) => {
        const targetEl = e.target as HTMLElement;
        const handlerAttr =
          e.type === "click"
            ? "data-plugin-handler"
            : e.type === "input"
            ? "data-plugin-handler-input"
            : e.type === "change"
            ? "data-plugin-handler-change"
            : null;

        if (!handlerAttr) return;

        // 클릭/변경된 요소 또는 부모에서 핸들러 찾기
        let currentElement: HTMLElement | null = targetEl;
        let handlerName: string | null = null;

        while (currentElement && currentElement !== target) {
          handlerName = currentElement.getAttribute(handlerAttr);
          if (handlerName) break;
          currentElement = currentElement.parentElement;
        }

        if (!handlerName) return;

        // 핸들러 실행 (자동 래핑되어 있음)
        const handler = (window as any)[handlerName];
        if (typeof handler === "function") {
          handler(e);
        }
      };

      const detachDropdowns = setupPluginDropdownInteractions(target);

      target.addEventListener("click", handleCheckboxToggle);
      target.addEventListener("click", handleEvent);
      target.addEventListener("change", handleEvent);
      target.addEventListener("input", handleEvent);
      target.addEventListener("blur", handleInputBlur, true); // capture phase

      // cleanup
      return () => {
        target.removeEventListener("click", handleCheckboxToggle);
        target.removeEventListener("click", handleEvent);
        target.removeEventListener("change", handleEvent);
        target.removeEventListener("input", handleEvent);
        target.removeEventListener("blur", handleInputBlur, true);
        detachDropdowns();
      };
    }

    return undefined;
  }, [
    element.scoped,
    element.fullId,
    element.position,
    element.resizeAnchor,
    updateElement,
    windowType,
    shadowRoot,
    renderedContent, // 컨텐츠 변경 시 크기 재측정
    zoom,
    definition?.resizeAnchor,
  ]);

  // Overlay Logic (onMount)
  useEffect(() => {
    if (windowType !== "overlay") return;

    if (!definition) {
      // definition이 아직 로드되지 않았을 수 있음.
      // definitions가 업데이트되면 리렌더링되므로 그때 다시 시도됨.
      return;
    }

    if (!definition.onMount) return;

    // reset previously exposed actions for this element
    exposedActionsRef.current = {};
    clearExposedActions(element.fullId);

    const cleanups: (() => void)[] = [];

    const context = {
      setState: (updates: Record<string, any>) => {
        // rAF 기반 배치 업데이트 사용 (성능 최적화)
        const currentElement = usePluginDisplayElementStore
          .getState()
          .elements.find((el) => el.fullId === element.fullId);
        if (currentElement) {
          updateElementBatched(element.fullId, {
            state: { ...currentElement.state, ...updates },
          });
        }
      },
      getSettings: () => {
        const currentElement = usePluginDisplayElementStore
          .getState()
          .elements.find((el) => el.fullId === element.fullId);
        return currentElement?.settings || {};
      },
      setAnchor: (anchor: ElementResizeAnchor) => {
        // 오버레이 로컬 스토어 업데이트
        updateElement(element.fullId, { resizeAnchor: anchor });
        // 메인 윈도우로 동기화 (브릿지 통해)
        if (window.api?.bridge) {
          window.api.bridge.sendTo(
            "main",
            "plugin:displayElement:updateAnchor",
            {
              fullId: element.fullId,
              resizeAnchor: anchor,
            }
          );
        }
      },
      getAnchor: (): ElementResizeAnchor => {
        const currentElement = usePluginDisplayElementStore
          .getState()
          .elements.find((el) => el.fullId === element.fullId);
        return (
          currentElement?.resizeAnchor || definition?.resizeAnchor || "top-left"
        );
      },
      onHook: (event: string, callback: (...args: any[]) => void) => {
        // console.log(`[PluginElement] onHook registered for ${event}`);
        if (event === "key") {
          // 백엔드 재구독 대신 키 이벤트 버스 사용
          import("@utils/keyEventBus").then(({ keyEventBus }) => {
            const unsub = keyEventBus.subscribe((payload) => {
              // console.log(`[PluginElement] Key event received via hook`, payload);
              callback(payload);
            });
            cleanups.push(unsub);
          });
        } else if (event === "rawKey") {
          // Raw key 이벤트 버스 사용 (구독 기반 - 구독자가 있을 때만 백엔드가 emit)
          import("@utils/rawKeyEventBus").then(({ rawKeyEventBus }) => {
            rawKeyEventBus
              .subscribe((payload) => {
                callback(payload);
              })
              .then((unsub) => {
                cleanups.push(unsub);
              })
              .catch((error) => {
                console.error(
                  `[PluginElement] Failed to subscribe to rawKey:`,
                  error
                );
              });
          });
        }
      },
      expose: (actions: Record<string, (...args: any[]) => any>) => {
        if (!actions || typeof actions !== "object") return;
        const validEntries = Object.entries(actions).filter(
          ([, fn]) => typeof fn === "function"
        );
        if (validEntries.length === 0) return;

        exposedActionsRef.current = {
          ...exposedActionsRef.current,
          ...Object.fromEntries(validEntries),
        };
        registerExposedActions(element.fullId, exposedActionsRef.current);
      },
      locale: localeRef.current,
      t: pluginTranslateStable,
      onLocaleChange: (listener: (locale: string) => void) => {
        if (window.api?.i18n?.onLocaleChange) {
          return window.api.i18n.onLocaleChange(listener);
        }
        console.warn(
          "[PluginElement] i18n API is not available in this context"
        );
        return () => undefined;
      },
      onSettingsChange: (
        listener: (
          newSettings: Record<string, any>,
          oldSettings: Record<string, any>
        ) => void
      ) => {
        settingsChangeListenersRef.current.add(listener);
        cleanups.push(() => {
          settingsChangeListenersRef.current.delete(listener);
        });
      },
    };

    console.log(`[PluginElement] Mounting ${element.fullId}`);

    const mountCleanup = definition.onMount(context);
    if (typeof mountCleanup === "function") {
      cleanups.push(mountCleanup);
    }

    return () => {
      clearExposedActions(element.fullId);
      exposedActionsRef.current = {};
      cleanups.forEach((fn) => fn());
    };
  }, [
    windowType,
    definition?.id,
    element.fullId,
    pluginTranslateStable,
    updateElementBatched,
  ]);

  const elementStyle: React.CSSProperties = useMemo(() => {
    const baseStyle: React.CSSProperties = {
      position: "absolute",
      left: 0,
      top: 0,
      transform: `translate3d(${renderX}px, ${renderY}px, 0)`,
      // 명시적인 zIndex가 있으면 사용, 없으면 키 개수 + 배열 인덱스로 계산
      // 키들 뒤에 순서대로 배치되어 통합 z-order 동작
      zIndex: element.zIndex ?? keyCount + arrayIndex,
      cursor:
        element.draggable && windowType === "main"
          ? "move"
          : element.onClick && windowType === "main"
          ? "pointer"
          : "default",
      willChange: "transform",
      pointerEvents: windowType === "main" ? "auto" : "none",
    };

    // resizable 플러그인 요소의 경우 명시적 크기 적용
    // 내부 콘텐츠가 width/height: 100%로 이 크기를 따라감
    if (definition?.resizable && element.measuredSize) {
      baseStyle.width = element.measuredSize.width;
      baseStyle.height = element.measuredSize.height;
      baseStyle.overflow = "hidden";
    }

    return { ...baseStyle, ...element.style };
  }, [
    renderX,
    renderY,
    element.zIndex,
    element.draggable,
    element.onClick,
    element.style,
    element.measuredSize,
    definition?.resizable,
    windowType,
    arrayIndex,
    keyCount,
  ]);

  const attachRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        containerRef.current = node;
        // 선택 모드가 아닐 때만 드래그 ref 연결
        if (element.draggable && windowType === "main" && !isSelectionMode) {
          draggableRef(node);
        }
      }
    },
    [element.draggable, windowType, draggableRef, isSelectionMode]
  );

  // 컨텍스트 메뉴 핸들러
  const handleContextMenu = (e: React.MouseEvent) => {
    // contextMenu 옵션이 있고, 메인 윈도우에서만
    if (!element.contextMenu || windowType !== "main") return;

    const {
      enableDelete = true,
      deleteLabel = "🗑️ 삭제",
      customItems = [],
    } = element.contextMenu;

    // 메뉴 항목이 하나도 없으면 표시 안 함
    if (!enableDelete && customItems.length === 0) return;

    // 선택된 상태에서는 컨텍스트 메뉴 무시
    if (isSelectionMode) return;

    e.preventDefault();
    e.stopPropagation();

    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuOpen(true);
  };

  // onClick 핸들러
  const handleClick = (e: React.MouseEvent) => {
    // 우클릭은 컨텍스트 메뉴용이므로 제외
    if (e.button !== 0) return;

    // Ctrl+클릭으로 선택 토글 (메인 윈도우에서만) - 선택 모드에서도 동작해야 함 (선택 해제용)
    if (e.ctrlKey && windowType === "main") {
      e.stopPropagation();
      useGridSelectionStore.getState().toggleSelection({
        type: "plugin",
        id: element.fullId,
      });
      return;
    }

    // 선택된 상태에서는 일반 클릭 이벤트 무시
    if (isSelectionMode) {
      e.stopPropagation();
      return;
    }

    // onClick 핸들러가 있고, 메인 윈도우에서만
    if (!element.onClick || windowType !== "main") return;

    // onClick 핸들러 실행 (자동 래핑되어 있음)
    if (typeof element.onClick === "string") {
      const handler = (window as any)[element.onClick];
      if (typeof handler === "function") {
        handler(e);
      }
    }
  };

  // 컨텍스트 메뉴 항목 생성
  const contextMenuItems = useMemo<ListItem[]>(() => {
    if (!element.contextMenu) return [];

    const {
      enableDelete = true,
      deleteLabel = "삭제",
      customItems = [],
    } = element.contextMenu;
    const items: ListItem[] = [];

    if (enableDelete) {
      items.push({
        id: "delete",
        label: pluginTranslate(deleteLabel, undefined, deleteLabel),
      });
    }

    // 커스텀 항목 추가
    customItems.forEach((item, index) => {
      items.push({
        id: `custom-${index}`,
        label: pluginTranslate(item.label, undefined, item.label),
      });
    });

    // z-order 항목 추가
    items.push(
      { id: "bringToFront", label: t("contextMenu.bringToFront") },
      // { id: "bringForward", label: t("contextMenu.bringForward") },
      // { id: "sendBackward", label: t("contextMenu.sendBackward") },
      { id: "sendToBack", label: t("contextMenu.sendToBack") }
    );

    return items;
  }, [element.contextMenu, pluginTranslate, t]);

  const createActionsProxy = useCallback(
    (elementId: string) =>
      new Proxy(
        {},
        {
          get: (_target, prop: string | symbol) => {
            if (typeof prop !== "string") return undefined;
            return (...args: any[]) => {
              try {
                window.api?.bridge?.sendTo(
                  "overlay",
                  "plugin:displayElement:invokeAction",
                  {
                    elementId,
                    action: prop,
                    args,
                  }
                );
              } catch (error) {
                console.error(
                  "[PluginElement] Failed to invoke exposed action",
                  error
                );
              }
            };
          },
        }
      ),
    []
  );

  // 컨텍스트 메뉴 항목 선택
  const handleContextMenuSelect = (itemId: string) => {
    if (itemId === "delete") {
      // onDelete 핸들러 호출 (자동 래핑되어 있음)
      if (element.onDelete && typeof element.onDelete === "string") {
        const handler = (window as any)[element.onDelete];
        if (typeof handler === "function") {
          handler();
        }
      }

      if (window.api?.ui?.displayElement) {
        window.api.ui.displayElement.remove(element.fullId);
      } else {
        usePluginDisplayElementStore.getState().removeElement(element.fullId);
      }
    } else if (itemId === "bringToFront") {
      usePluginDisplayElementStore.getState().bringToFront(element.fullId);
    } else if (itemId === "bringForward") {
      usePluginDisplayElementStore.getState().bringForward(element.fullId);
    } else if (itemId === "sendBackward") {
      usePluginDisplayElementStore.getState().sendBackward(element.fullId);
    } else if (itemId === "sendToBack") {
      usePluginDisplayElementStore.getState().sendToBack(element.fullId);
    } else if (itemId.startsWith("custom-")) {
      const index = parseInt(itemId.replace("custom-", ""), 10);
      const customItem = element.contextMenu?.customItems?.[index];
      if (customItem) {
        // 커스텀 메뉴 실행 (자동 래핑되어 있음)
        customItem.onClick({
          element,
          actions: createActionsProxy(element.fullId),
        });
      }
    }
  };

  // 렌더링 로직
  const renderContent = (): React.ReactNode => {
    if (renderedContent) {
      // 템플릿 결과가 문자열인 경우 (레거시)
      if (typeof renderedContent === "string") {
        return <div dangerouslySetInnerHTML={{ __html: renderedContent }} />;
      }
      // React Element인 경우
      return renderedContent as React.ReactNode;
    }

    // 템플릿이 없고 html 속성만 있는 경우 (레거시)
    if (element.html) {
      return <div dangerouslySetInnerHTML={{ __html: element.html }} />;
    }

    return null;
  };

  return (
    <>
      <div
        ref={attachRef}
        id={element.id}
        className={element.className}
        style={elementStyle}
        data-plugin-element={element.fullId}
        data-plugin-id={element.pluginId}
        onClick={handleClick}
        onMouseDown={isSelectionMode ? handleSelectionDragMouseDown : undefined}
        onContextMenu={handleContextMenu}
      >
        {element.scoped && shadowRoot
          ? createPortal(renderContent(), shadowRoot as any)
          : renderContent()}
      </div>

      {/* 컨텍스트 메뉴 - 줌 영향을 받지 않도록 body에 Portal로 렌더링 */}
      {windowType === "main" &&
        element.contextMenu &&
        contextMenuOpen &&
        createPortal(
          <ListPopup
            open={contextMenuOpen}
            position={contextMenuPosition}
            onClose={() => setContextMenuOpen(false)}
            items={contextMenuItems}
            onSelect={handleContextMenuSelect}
            className="!z-[10000]"
          />,
          document.body
        )}
    </>
  );
};
