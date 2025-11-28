import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { useTranslation } from "@contexts/I18nContext";
import DraggableKey from "@components/Key";
import { getKeyInfoByGlobalKey } from "@utils/KeyMaps";
import KeySettingModal from "./Modal/content/KeySetting";
import CounterSettingModal from "./Modal/content/CounterSetting";
import TabCssModal from "./Modal/content/TabCssModal";
import ListPopup from "./Modal/ListPopup";
import { useKeyStore } from "@stores/useKeyStore";
import { usePluginMenuStore } from "@stores/usePluginMenuStore";
import { usePluginDisplayElementStore } from "@stores/usePluginDisplayElementStore";
import { PluginElementsRenderer } from "@components/PluginElementsRenderer";
import { translatePluginMessage } from "@utils/pluginI18n";
import { useGridZoomPan } from "@hooks/useGridZoomPan";
import GridMinimap from "./GridMinimap";
import ZoomIndicator from "./ZoomIndicator";
import SmartGuidesOverlay from "./SmartGuidesOverlay";
import GridBackground from "./GridBackground";
import MarqueeSelectionOverlay from "./MarqueeSelectionOverlay";
import {
  useGridSelectionStore,
  isElementInMarquee,
  getMarqueeRect,
} from "@stores/useGridSelectionStore";
import { useHistoryStore } from "@stores/useHistoryStore";
import { useUIStore } from "@stores/useUIStore";

const GRID_SNAP = 5;
const snapToGrid = (value) => {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value / GRID_SNAP) * GRID_SNAP;
};
const snapCursorToGrid = (x, y) => ({
  x: snapToGrid(x),
  y: snapToGrid(y),
});

export default function Grid({
  showConfirm,
  showAlert,
  selectedKey,
  setSelectedKey,
  keyMappings,
  positions,
  onPositionChange,
  onKeyUpdate,
  onCounterUpdate,
  onCounterPreview,
  onKeyDelete,
  onAddKeyAt,
  onKeyDuplicate,
  onMoveToFront,
  onMoveToBack,
  color,
  activeTool,
  shouldSkipModalAnimation,
  onModalAnimationConsumed,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}) {
  const selectedKeyType = useKeyStore((state) => state.selectedKeyType);
  const { t, i18n } = useTranslation();
  const locale = i18n.language;

  // 그리드 컨테이너 및 콘텐츠 ref
  const gridContainerRef = useRef(null);
  const gridContentRef = useRef(null);

  // 줌/팬 훅
  const {
    zoom,
    panX,
    panY,
    clientToGridCoords,
    gridToClientCoords,
    zoomIn,
    zoomOut,
    resetZoom,
    minZoom,
    maxZoom,
  } = useGridZoomPan({
    mode: selectedKeyType,
    containerRef: gridContainerRef,
    contentRef: gridContentRef,
  });

  // 플러그인 메뉴 아이템
  const pluginKeyMenuItems = usePluginMenuStore((state) => state.keyMenuItems);
  const pluginGridMenuItems = usePluginMenuStore(
    (state) => state.gridMenuItems
  );
  const pluginDefinitions = usePluginDisplayElementStore(
    (state) => state.definitions
  );

  const pluginMessagesById = useMemo(() => {
    const map = new Map();
    pluginDefinitions.forEach((def) => {
      if (!map.has(def.pluginId)) {
        map.set(def.pluginId, def.messages);
      }
    });
    return map;
  }, [pluginDefinitions]);

  const resolvePluginLabel = useCallback(
    (pluginId, rawLabel) =>
      translatePluginMessage({
        messages: pluginMessagesById.get(pluginId),
        locale,
        key: rawLabel,
        fallback: rawLabel,
      }),
    [pluginMessagesById, locale]
  );

  // 선택 상태 관리
  const selectedElements = useGridSelectionStore(
    (state) => state.selectedElements
  );
  const selectElement = useGridSelectionStore((state) => state.selectElement);
  const toggleSelection = useGridSelectionStore(
    (state) => state.toggleSelection
  );
  const clearSelection = useGridSelectionStore((state) => state.clearSelection);
  const setSelectedElements = useGridSelectionStore(
    (state) => state.setSelectedElements
  );
  const isMarqueeSelecting = useGridSelectionStore(
    (state) => state.isMarqueeSelecting
  );
  const startMarqueeSelection = useGridSelectionStore(
    (state) => state.startMarqueeSelection
  );
  const updateMarqueeSelection = useGridSelectionStore(
    (state) => state.updateMarqueeSelection
  );
  const endMarqueeSelection = useGridSelectionStore(
    (state) => state.endMarqueeSelection
  );
  const marqueeStart = useGridSelectionStore((state) => state.marqueeStart);
  const marqueeEnd = useGridSelectionStore((state) => state.marqueeEnd);

  // 플러그인 요소 가져오기
  const pluginElements = usePluginDisplayElementStore(
    (state) => state.elements
  );
  const updatePluginElement = usePluginDisplayElementStore(
    (state) => state.updateElement
  );

  // 키 컨텍스트 메뉴
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [contextIndex, setContextIndex] = useState(null);
  const contextRef = useRef(null);
  const [contextPosition, setContextPosition] = useState(null);
  const keyRefs = useRef([]);
  const gridRef = useRef(null);
  const [duplicateState, setDuplicateState] = useState(null);
  const [duplicateCursor, setDuplicateCursor] = useState(null);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  // 클라이언트 좌표를 그리드 좌표로 변환 (줌/팬 반영)
  const computeSnappedCursorFromClient = useCallback(
    (clientX, clientY) => {
      const gridCoords = clientToGridCoords(clientX, clientY);
      if (!gridCoords) return null;
      return snapCursorToGrid(gridCoords.x, gridCoords.y);
    },
    [clientToGridCoords]
  );

  const [counterTargetIndex, setCounterTargetIndex] = useState(null);
  const [counterOriginalSettings, setCounterOriginalSettings] = useState(null);
  const [counterApplied, setCounterApplied] = useState(false);

  // 탭 CSS 모달 상태
  const [isTabCssModalOpen, setIsTabCssModalOpen] = useState(false);

  // 그리드 호버 상태 (미니맵 표시용)
  const [isGridHovered, setIsGridHovered] = useState(false);

  // 기타 설정 팝업 열림 상태 (미니맵 표시 제어용)
  const isExtrasPopupOpen = useUIStore((state) => state.isExtrasPopupOpen);

  // 선택된 요소들의 위치를 오버레이에 동기화하는 함수
  const syncSelectedElementsToOverlay = useCallback(() => {
    // 키 위치 동기화
    const currentPositions = useKeyStore.getState().positions;
    window.api.keys.updatePositions(currentPositions).catch((error) => {
      console.error("Failed to sync key positions to overlay", error);
    });
    // 플러그인 요소는 setElements에서 자동으로 syncToOverlayThrottled 호출됨
  }, []);

  // 선택된 요소들 일괄 이동 함수 (배치 업데이트)
  const moveSelectedElements = useCallback(
    (deltaX, deltaY, saveHistory = false, syncToOverlay = true) => {
      if (selectedElements.length === 0) return;

      // 현재 상태 직접 가져오기 (클로저 문제 방지)
      const currentPositions = useKeyStore.getState().positions;
      const currentPluginElements =
        usePluginDisplayElementStore.getState().elements;

      // 히스토리 저장 (옵션)
      if (saveHistory) {
        const { keyMappings: km } = useKeyStore.getState();
        useHistoryStore
          .getState()
          .pushState(km, currentPositions, currentPluginElements);
      }

      // 키 위치 배치 업데이트
      const keyUpdates = selectedElements.filter(
        (el) => el.type === "key" && el.index !== undefined
      );
      if (keyUpdates.length > 0) {
        const newPositions = { ...currentPositions };
        const tabPositions = [...(newPositions[selectedKeyType] || [])];

        keyUpdates.forEach((el) => {
          const currentPos = tabPositions[el.index];
          if (currentPos) {
            tabPositions[el.index] = {
              ...currentPos,
              dx: currentPos.dx + deltaX,
              dy: currentPos.dy + deltaY,
            };
          }
        });

        newPositions[selectedKeyType] = tabPositions;
        useKeyStore.getState().setPositions(newPositions);

        // syncToOverlay가 true일 때만 API 호출 (드래그 중에는 false)
        if (syncToOverlay) {
          window.api.keys.updatePositions(newPositions).catch((error) => {
            console.error("Failed to sync key positions to overlay", error);
          });
        }
      }

      // 플러그인 요소 배치 업데이트
      const pluginUpdates = selectedElements.filter(
        (el) => el.type === "plugin"
      );
      if (pluginUpdates.length > 0) {
        const newElements = currentPluginElements.map((pluginEl) => {
          const isSelected = pluginUpdates.some(
            (sel) => sel.id === pluginEl.fullId
          );
          if (isSelected) {
            return {
              ...pluginEl,
              position: {
                x: pluginEl.position.x + deltaX,
                y: pluginEl.position.y + deltaY,
              },
            };
          }
          return pluginEl;
        });
        // setElements는 내부적으로 syncToOverlayThrottled 호출 (드래그 중에도 throttle 덕분에 문제 없음)
        usePluginDisplayElementStore.getState().setElements(newElements);
      }
    },
    [selectedElements, selectedKeyType]
  );

  // 선택된 요소들 삭제 함수 (배치 삭제)
  const deleteSelectedElements = useCallback(async () => {
    if (selectedElements.length === 0) return;

    const keysToDelete = selectedElements
      .filter((el) => el.type === "key" && el.index !== undefined)
      .map((el) => el.index);

    const pluginsToDelete = selectedElements
      .filter((el) => el.type === "plugin")
      .map((el) => el.id);

    // 히스토리 저장
    if (keysToDelete.length > 0 || pluginsToDelete.length > 0) {
      const { keyMappings: km, positions: pos } = useKeyStore.getState();
      const currentPluginElements =
        usePluginDisplayElementStore.getState().elements;
      useHistoryStore.getState().pushState(km, pos, currentPluginElements);
    }

    // 먼저 선택 해제 (삭제된 인덱스 참조 방지)
    clearSelection();

    // 키 배치 삭제 (atomic update로 한 번의 리렌더링만 발생)
    if (keysToDelete.length > 0) {
      const { keyMappings: km, positions: pos } = useKeyStore.getState();
      const mapping = km[selectedKeyType] || [];
      const posArray = pos[selectedKeyType] || [];

      // 삭제할 인덱스를 Set으로 변환 (O(1) 조회)
      const deleteSet = new Set(keysToDelete);

      const updatedMappings = {
        ...km,
        [selectedKeyType]: mapping.filter((_, index) => !deleteSet.has(index)),
      };

      const updatedPositions = {
        ...pos,
        [selectedKeyType]: posArray.filter((_, index) => !deleteSet.has(index)),
      };

      // 로컬 업데이트 플래그 설정 (백엔드 이벤트 무시)
      useKeyStore.getState().setLocalUpdateInProgress(true);

      // Atomic update: mappings와 positions를 동시에 업데이트하여 중간 상태 방지
      useKeyStore
        .getState()
        .setKeyMappingsAndPositions(updatedMappings, updatedPositions);

      // API 동기화 (순차 실행으로 일관성 보장)
      try {
        await window.api.keys.update(updatedMappings);
        await window.api.keys.updatePositions(updatedPositions);
      } catch (error) {
        console.error("Failed to delete keys", error);
      } finally {
        // 플래그 해제
        useKeyStore.getState().setLocalUpdateInProgress(false);
      }
    }

    // 플러그인 요소 배치 삭제
    if (pluginsToDelete.length > 0) {
      const currentElements = usePluginDisplayElementStore.getState().elements;
      const deleteSet = new Set(pluginsToDelete);
      const newElements = currentElements.filter(
        (el) => !deleteSet.has(el.fullId)
      );
      usePluginDisplayElementStore.getState().setElements(newElements);
    }
  }, [selectedElements, selectedKeyType, clearSelection]);

  // 키보드 방향키로 선택 요소 이동 핸들러
  const lastArrowKeyTime = useRef(0);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // 입력 요소에서는 무시
      const target = e.target;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // 선택된 요소가 없으면 무시
      if (selectedElements.length === 0) return;

      // 방향키 처리
      const arrowKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
      if (arrowKeys.includes(e.key)) {
        e.preventDefault();

        let deltaX = 0;
        let deltaY = 0;

        switch (e.key) {
          case "ArrowUp":
            deltaY = -1;
            break;
          case "ArrowDown":
            deltaY = 1;
            break;
          case "ArrowLeft":
            deltaX = -1;
            break;
          case "ArrowRight":
            deltaX = 1;
            break;
        }

        // 500ms 내 연속 입력이면 히스토리 저장 안함
        const now = Date.now();
        const saveHistory = now - lastArrowKeyTime.current > 500;
        lastArrowKeyTime.current = now;

        moveSelectedElements(deltaX, deltaY, saveHistory);
        return;
      }

      // Delete 키로 선택 요소 삭제
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelectedElements();
        return;
      }

      // Escape 키로 선택 해제
      if (e.key === "Escape") {
        clearSelection();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedElements,
    moveSelectedElements,
    deleteSelectedElements,
    clearSelection,
  ]);

  // 탭 변경 시 선택 해제
  useEffect(() => {
    clearSelection();
  }, [selectedKeyType, clearSelection]);

  // 키 메뉴 아이템 생성 (기본 + 플러그인)
  const getKeyMenuItems = () => {
    const baseItems = [
      { id: "delete", label: t("contextMenu.deleteKey") },
      { id: "duplicate", label: t("contextMenu.duplicateKey") },
      { id: "counter", label: t("contextMenu.counterSetting") },
      { id: "counterReset", label: t("contextMenu.counterReset") },
      { id: "bringToFront", label: t("contextMenu.bringToFront") },
      { id: "sendToBack", label: t("contextMenu.sendToBack") },
    ];

    // 플러그인 메뉴 필터링 (조건부 표시)
    const context =
      contextIndex !== null
        ? {
            keyCode: keyMappings[selectedKeyType]?.[contextIndex] || "",
            index: contextIndex,
            position: positions[selectedKeyType]?.[contextIndex] || {},
            mode: selectedKeyType,
          }
        : null;

    const filterPluginItems = (items) => {
      if (!context) return [];
      return items
        .filter((item) => {
          // visible 체크
          if (item.visible === false) return false;
          if (typeof item.visible === "function" && !item.visible(context))
            return false;
          return true;
        })
        .map((item) => ({
          id: item.fullId,
          label: resolvePluginLabel(item.pluginId, item.label),
          disabled:
            typeof item.disabled === "function"
              ? item.disabled(context)
              : item.disabled || false,
          isPlugin: true,
        }));
    };

    const topPluginItems = filterPluginItems(
      pluginKeyMenuItems.filter((i) => i.position === "top")
    );
    const bottomPluginItems = filterPluginItems(
      pluginKeyMenuItems.filter((i) => i.position !== "top")
    );

    return [...topPluginItems, ...baseItems, ...bottomPluginItems];
  };

  // 그리드 메뉴 아이템 생성 (기본 + 플러그인)
  const getGridMenuItems = () => {
    const topBaseItems = [{ id: "add", label: t("tooltip.addKey") }];
    const bottomBaseItems = [
      { id: "tabCss", label: t("contextMenu.tabCssSetting") },
    ];

    // 플러그인 메뉴 필터링
    const context = gridAddLocalPos
      ? {
          position: gridAddLocalPos,
          mode: selectedKeyType,
        }
      : null;

    const filterPluginItems = (items) => {
      if (!context) return [];
      return items
        .filter((item) => {
          if (item.visible === false) return false;
          if (typeof item.visible === "function" && !item.visible(context))
            return false;
          return true;
        })
        .map((item) => ({
          id: item.fullId,
          label: resolvePluginLabel(item.pluginId, item.label),
          disabled:
            typeof item.disabled === "function"
              ? item.disabled(context)
              : item.disabled || false,
          isPlugin: true,
        }));
    };

    const topPluginItems = filterPluginItems(
      pluginGridMenuItems.filter((i) => i.position === "top")
    );
    const bottomPluginItems = filterPluginItems(
      pluginGridMenuItems.filter((i) => i.position !== "top")
    );

    return [
      ...topPluginItems,
      ...topBaseItems,
      ...bottomPluginItems,
      ...bottomBaseItems,
    ];
  };

  // 그리드 컨텍스트 메뉴
  const [isGridContextOpen, setIsGridContextOpen] = useState(false);
  const [gridContextClientPos, setGridContextClientPos] = useState(null);
  const [gridAddLocalPos, setGridAddLocalPos] = useState(null);

  // Undo/Redo 단축키 핸들러
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 입력 요소에서는 단축키 무시
      const target = e.target;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Ctrl+Z: Undo
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (canUndo && typeof onUndo === "function") {
          onUndo();
        }
      }
      // Ctrl+Shift+Z: Redo
      else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (canRedo && typeof onRedo === "function") {
          onRedo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canUndo, canRedo, onUndo, onRedo]);

  // 전역 마우스 위치 추적
  useEffect(() => {
    const handleMouseMove = (e) => {
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    if (
      shouldSkipModalAnimation &&
      selectedKey &&
      typeof onModalAnimationConsumed === "function"
    ) {
      onModalAnimationConsumed();
    }
  }, [shouldSkipModalAnimation, selectedKey, onModalAnimationConsumed]);

  const renderKeys = () => {
    if (!positions[selectedKeyType]) return null;

    return positions[selectedKeyType].map((position, index) => (
      <DraggableKey
        key={index}
        index={index}
        position={position}
        keyName={keyMappings[selectedKeyType]?.[index] || ""}
        onPositionChange={onPositionChange}
        onClick={() => {
          if (isContextOpen) {
            setIsContextOpen(false);
            setContextPosition(null);
          }
          setSelectedKey({ key: keyMappings[selectedKeyType][index], index });
        }}
        onCtrlClick={() => {
          toggleSelection({ type: "key", id: `key-${index}`, index });
        }}
        isSelected={selectedElements.some(
          (el) => el.type === "key" && el.index === index
        )}
        selectedElements={selectedElements}
        onMultiDrag={(deltaX, deltaY) =>
          moveSelectedElements(deltaX, deltaY, false, false)
        }
        onMultiDragEnd={syncSelectedElementsToOverlay}
        onMultiDragStart={() => {
          // 드래그 시작 시 히스토리 저장
          const currentPositions = useKeyStore.getState().positions;
          const currentPluginElements =
            usePluginDisplayElementStore.getState().elements;
          const { keyMappings: km } = useKeyStore.getState();
          useHistoryStore
            .getState()
            .pushState(km, currentPositions, currentPluginElements);
        }}
        activeTool={activeTool}
        onEraserClick={() => {
          const globalKey = keyMappings[selectedKeyType]?.[index] || "";
          const displayName =
            getKeyInfoByGlobalKey(globalKey)?.displayName || globalKey;
          showConfirm(
            t("confirm.removeKey", { name: displayName }),
            () => onKeyDelete(index),
            t("confirm.remove")
          );
        }}
        onContextMenu={(e) => {
          if (duplicateState) {
            setDuplicateState(null);
            setDuplicateCursor(null);
          }
          setContextIndex(index);
          contextRef.current = keyRefs.current[index] || null;
          setContextPosition({ x: e.clientX, y: e.clientY });
          setIsContextOpen(true);
        }}
        setReferenceRef={(node) => {
          keyRefs.current[index] = node;
        }}
        zoom={zoom}
        panX={panX}
        panY={panY}
      />
    ));
  };

  const renderDuplicateGhost = () => {
    if (!duplicateState || !duplicateCursor) return null;
    const {
      position: {
        width = 60,
        height = 60,
        inactiveImage,
        activeImage,
        className,
      },
      keyName,
    } = duplicateState;
    const backgroundColor = inactiveImage
      ? "transparent"
      : "rgba(46, 46, 47, 0.9)";
    const borderStyle = inactiveImage
      ? "none"
      : "3px solid rgba(113, 113, 113, 0.9)";
    const displayName =
      getKeyInfoByGlobalKey(keyName)?.displayName || keyName || "";

    // 키의 중심이 마우스에 위치하도록 오프셋 계산
    const offsetX = duplicateCursor.x - width / 2;
    const offsetY = duplicateCursor.y - height / 2;

    return (
      <div
        className={`absolute pointer-events-none select-none ${
          className || ""
        }`}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          transform: `translate3d(${offsetX}px, ${offsetY}px, 0)`,
          backgroundColor,
          borderRadius: inactiveImage ? "0" : "10px",
          border: borderStyle,
          overflow: inactiveImage ? "visible" : "hidden",
          opacity: 0.5,
          zIndex: 1000,
        }}
      >
        {inactiveImage || activeImage ? (
          <img
            src={inactiveImage || activeImage || ""}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              pointerEvents: "none",
              userSelect: "none",
            }}
            draggable={false}
          />
        ) : (
          <div
            className="flex items-center justify-center h-full font-bold"
            style={{
              color: "var(--key-text-color, #717171)",
              willChange: "auto",
              contain: "layout style paint",
            }}
          >
            {displayName}
          </div>
        )}
      </div>
    );
  };

  // 마퀴 선택 중 마우스 이동 핸들러
  const handleMarqueeMouseMove = useCallback(
    (e) => {
      if (!isMarqueeSelecting) return;

      const gridCoords = clientToGridCoords(e.clientX, e.clientY);
      if (gridCoords) {
        updateMarqueeSelection(gridCoords.x, gridCoords.y);
      }
    },
    [isMarqueeSelecting, clientToGridCoords, updateMarqueeSelection]
  );

  // 마퀴 선택 완료 시 요소 선택 처리
  const handleMarqueeMouseUp = useCallback(() => {
    if (!isMarqueeSelecting) return;

    const rect = getMarqueeRect(marqueeStart, marqueeEnd);
    if (rect && rect.width > 5 && rect.height > 5) {
      const newSelectedElements = [];

      // 키 요소 체크
      const keyPositions = positions[selectedKeyType] || [];
      keyPositions.forEach((pos, index) => {
        const elementBounds = {
          x: pos.dx,
          y: pos.dy,
          width: pos.width || 60,
          height: pos.height || 60,
        };
        if (isElementInMarquee(elementBounds, rect)) {
          newSelectedElements.push({
            type: "key",
            id: `key-${index}`,
            index,
          });
        }
      });

      // 플러그인 요소 체크 (현재 탭에 속하는 것만)
      pluginElements.forEach((el) => {
        const belongsToCurrentTab = !el.tabId || el.tabId === selectedKeyType;
        if (belongsToCurrentTab && el.measuredSize) {
          const elementBounds = {
            x: el.position.x,
            y: el.position.y,
            width: el.measuredSize.width,
            height: el.measuredSize.height,
          };
          if (isElementInMarquee(elementBounds, rect)) {
            newSelectedElements.push({
              type: "plugin",
              id: el.fullId,
            });
          }
        }
      });

      setSelectedElements(newSelectedElements);
    }

    endMarqueeSelection();
  }, [
    isMarqueeSelecting,
    marqueeStart,
    marqueeEnd,
    positions,
    selectedKeyType,
    pluginElements,
    setSelectedElements,
    endMarqueeSelection,
  ]);

  // 마퀴 선택 이벤트 등록
  useEffect(() => {
    if (isMarqueeSelecting) {
      document.addEventListener("mousemove", handleMarqueeMouseMove);
      document.addEventListener("mouseup", handleMarqueeMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMarqueeMouseMove);
        document.removeEventListener("mouseup", handleMarqueeMouseUp);
      };
    }
  }, [isMarqueeSelecting, handleMarqueeMouseMove, handleMarqueeMouseUp]);

  // 그리드 좌클릭 핸들러 (Ctrl+드래그로 마퀴 선택 시작)
  const handleGridMouseDown = useCallback(
    (e) => {
      // 좌클릭만 처리
      if (e.button !== 0) return;

      // 복제 상태일 때는 무시
      if (duplicateState) return;

      // Ctrl+드래그로 마퀴 선택 시작
      if (e.ctrlKey) {
        const gridCoords = clientToGridCoords(e.clientX, e.clientY);
        if (gridCoords) {
          startMarqueeSelection(gridCoords.x, gridCoords.y);
        }
        return;
      }

      // 일반 클릭 시 선택 해제
      clearSelection();
    },
    [duplicateState, clientToGridCoords, clearSelection, startMarqueeSelection]
  );

  return (
    <div
      ref={(node) => {
        gridRef.current = node;
        gridContainerRef.current = node;
      }}
      className="relative w-full h-full bg-[#3A3943] rounded-[0px] overflow-hidden"
      style={{ backgroundColor: color === "transparent" ? "#3A3943" : color }}
      onContextMenu={(e) => {
        if (duplicateState) {
          setDuplicateState(null);
          setDuplicateCursor(null);
        }
        e.preventDefault();
        e.stopPropagation();
        // 줌/팬 반영된 그리드 좌표 계산
        const gridCoords = clientToGridCoords(e.clientX, e.clientY);
        if (!gridCoords) return;
        setGridAddLocalPos({
          dx: Math.round(gridCoords.x),
          dy: Math.round(gridCoords.y),
        });
        setGridContextClientPos({ x: e.clientX, y: e.clientY });
        setIsGridContextOpen(true);
      }}
      onMouseDown={handleGridMouseDown}
      onMouseMove={(e) => {
        if (duplicateState) {
          const snapped = computeSnappedCursorFromClient(e.clientX, e.clientY);
          if (snapped) {
            setDuplicateCursor(snapped);
          }
        }
      }}
      onMouseEnter={() => setIsGridHovered(true)}
      onMouseLeave={() => {
        setIsGridHovered(false);
        if (duplicateState) setDuplicateCursor(null);
      }}
      onMouseDownCapture={(e) => {
        if (!duplicateState || e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        const snapped = computeSnappedCursorFromClient(e.clientX, e.clientY);
        if (snapped && typeof onKeyDuplicate === "function") {
          // 마우스 위치에서 키의 중심이 배치되도록 조정
          const width = duplicateState.position.width || 60;
          const height = duplicateState.position.height || 60;
          onKeyDuplicate(
            duplicateState.sourceIndex,
            snapped.x - width / 2,
            snapped.y - height / 2
          );
        }
        setDuplicateState(null);
        setDuplicateCursor(null);
      }}
    >
      {/* 정확한 그리드 배경 */}
      <GridBackground
        gridSize={GRID_SNAP}
        zoom={zoom}
        panX={panX}
        panY={panY}
        color={color === "transparent" ? "#3A3943" : color}
      />
      {/* 줌/팬이 적용되는 콘텐츠 영역 */}
      <div
        ref={gridContentRef}
        className="absolute"
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: "0 0",
          willChange: "transform",
        }}
      >
        {renderKeys()}
        {renderDuplicateGhost()}
        <PluginElementsRenderer
          windowType="main"
          zoom={zoom}
          panX={panX}
          panY={panY}
          onMultiDrag={(deltaX, deltaY) =>
            moveSelectedElements(deltaX, deltaY, false, false)
          }
          onMultiDragEnd={syncSelectedElementsToOverlay}
          onMultiDragStart={() => {
            // 드래그 시작 시 히스토리 저장
            const currentPositions = useKeyStore.getState().positions;
            const currentPluginElements =
              usePluginDisplayElementStore.getState().elements;
            const { keyMappings: km } = useKeyStore.getState();
            useHistoryStore
              .getState()
              .pushState(km, currentPositions, currentPluginElements);
          }}
        />
      </div>
      {/* 스마트 가이드 오버레이 */}
      <SmartGuidesOverlay zoom={zoom} panX={panX} panY={panY} />
      {/* 마퀴 선택 오버레이 */}
      <MarqueeSelectionOverlay zoom={zoom} panX={panX} panY={panY} />
      {/* 선택된 요소 표시 */}
      {selectedElements.map((el) => {
        let bounds = null;
        if (el.type === "key" && el.index !== undefined) {
          const pos = positions[selectedKeyType]?.[el.index];
          if (pos) {
            bounds = {
              x: pos.dx,
              y: pos.dy,
              width: pos.width || 60,
              height: pos.height || 60,
            };
          }
        } else if (el.type === "plugin") {
          const pluginEl = pluginElements.find((p) => p.fullId === el.id);
          if (pluginEl && pluginEl.measuredSize) {
            bounds = {
              x: pluginEl.position.x,
              y: pluginEl.position.y,
              width: pluginEl.measuredSize.width,
              height: pluginEl.measuredSize.height,
            };
          }
        }
        if (!bounds) return null;
        return (
          <div
            key={el.id}
            style={{
              position: "absolute",
              left: bounds.x * zoom + panX - 2,
              top: bounds.y * zoom + panY - 2,
              width: bounds.width * zoom + 4,
              height: bounds.height * zoom + 4,
              border: "2px solid rgba(59, 130, 246, 0.8)",
              borderRadius: "4px",
              pointerEvents: "none",
              zIndex: 9997,
              boxShadow: "0 0 8px rgba(59, 130, 246, 0.3)",
            }}
          />
        );
      })}
      {/* 우클릭 리스트 팝업 */}
      <div className="relative">
        <ListPopup
          open={isContextOpen}
          referenceRef={contextRef}
          position={contextPosition || undefined}
          onClose={() => {
            setIsContextOpen(false);
            setContextPosition(null);
          }}
          items={getKeyMenuItems()}
          onSelect={(id) => {
            if (contextIndex == null) return;

            // 플러그인 메뉴 처리
            const pluginItem = pluginKeyMenuItems.find(
              (item) => item.fullId === id
            );
            if (pluginItem) {
              const context = {
                keyCode: keyMappings[selectedKeyType]?.[contextIndex] || "",
                index: contextIndex,
                position: positions[selectedKeyType]?.[contextIndex] || {},
                mode: selectedKeyType,
              };

              try {
                const result = pluginItem.onClick(context);
                if (result && typeof result.then === "function") {
                  result.catch((error) => {
                    console.error(
                      `[Plugin Menu] Error in '${pluginItem.label}':`,
                      error
                    );
                  });
                }
              } catch (error) {
                console.error(
                  `[Plugin Menu] Error in '${pluginItem.label}':`,
                  error
                );
              }

              setIsContextOpen(false);
              setContextPosition(null);
              return;
            }

            // 기본 메뉴 처리
            if (id === "delete") {
              const globalKey =
                keyMappings[selectedKeyType]?.[contextIndex] || "";
              const displayName =
                getKeyInfoByGlobalKey(globalKey)?.displayName || globalKey;
              showConfirm(
                t("confirm.removeKey", { name: displayName }),
                () => onKeyDelete(contextIndex),
                t("confirm.remove")
              );
            } else if (id === "duplicate") {
              const keyCode =
                keyMappings[selectedKeyType]?.[contextIndex] || "";
              const position =
                positions[selectedKeyType]?.[contextIndex] || null;
              if (position) {
                const clonedNoteColor =
                  position.noteColor &&
                  typeof position.noteColor === "object" &&
                  position.noteColor !== null
                    ? { ...position.noteColor }
                    : position.noteColor;
                const clonedCounter = position.counter
                  ? {
                      ...position.counter,
                      fill: { ...position.counter.fill },
                      stroke: { ...position.counter.stroke },
                    }
                  : null;
                let initialCursor = null;
                // 현재 실제 마우스 위치를 사용 (메뉴를 클릭한 시점의 위치)
                const currentMousePos = lastMousePosRef.current;
                const snapped = computeSnappedCursorFromClient(
                  currentMousePos.x,
                  currentMousePos.y
                );
                setDuplicateState({
                  sourceIndex: contextIndex,
                  keyName: keyCode,
                  position: {
                    ...position,
                    noteColor: clonedNoteColor,
                    counter: clonedCounter,
                  },
                });
                setDuplicateCursor(initialCursor);
              }
            } else if (id === "counter") {
              // 스냅샷 저장 (모달 초기 상태 & 취소 시 복원용)
              const original =
                positions[selectedKeyType]?.[contextIndex]?.counter;
              setCounterOriginalSettings(original || null);
              setCounterApplied(false);
              setCounterTargetIndex(contextIndex);
            } else if (id === "counterReset") {
              const globalKey =
                keyMappings[selectedKeyType]?.[contextIndex] || "";
              const displayName =
                getKeyInfoByGlobalKey(globalKey)?.displayName || globalKey;
              showConfirm(
                t("confirm.resetKeyCounter", { name: displayName }),
                async () => {
                  try {
                    await window.api.keys.resetSingleCounter(
                      selectedKeyType,
                      globalKey
                    );
                  } catch (error) {
                    console.error("Failed to reset key counter", error);
                  }
                },
                t("confirm.reset")
              );
            } else if (id === "bringToFront") {
              if (typeof onMoveToFront === "function") {
                onMoveToFront(contextIndex);
              }
            } else if (id === "sendToBack") {
              if (typeof onMoveToBack === "function") {
                onMoveToBack(contextIndex);
              }
            }
            setIsContextOpen(false);
            setContextPosition(null);
          }}
        />
      </div>
      {/* 그리드 컨텍스트 메뉴 */}
      <div className="relative">
        <ListPopup
          open={isGridContextOpen}
          position={gridContextClientPos || undefined}
          onClose={() => {
            setIsGridContextOpen(false);
            setGridContextClientPos(null);
            setGridAddLocalPos(null);
          }}
          items={getGridMenuItems()}
          onSelect={(id) => {
            // 플러그인 메뉴 처리
            const pluginItem = pluginGridMenuItems.find(
              (item) => item.fullId === id
            );
            if (pluginItem && gridAddLocalPos) {
              const context = {
                position: gridAddLocalPos,
                mode: selectedKeyType,
              };

              try {
                // 플러그인 컨텍스트 설정
                const previousPluginId = window.__dmn_current_plugin_id;
                window.__dmn_current_plugin_id = pluginItem.pluginId;

                const result = pluginItem.onClick(context);
                if (result && typeof result.then === "function") {
                  result
                    .catch((error) => {
                      console.error(
                        `[Plugin Menu] Error in '${pluginItem.label}':`,
                        error
                      );
                    })
                    .finally(() => {
                      // 비동기 작업 완료 후 컨텍스트 복원
                      window.__dmn_current_plugin_id = previousPluginId;
                    });
                } else {
                  // 동기 작업이면 즉시 복원
                  window.__dmn_current_plugin_id = previousPluginId;
                }
              } catch (error) {
                console.error(
                  `[Plugin Menu] Error in '${pluginItem.label}':`,
                  error
                );
                // 에러 발생 시에도 컨텍스트 복원
                window.__dmn_current_plugin_id = previousPluginId;
              }

              setIsGridContextOpen(false);
              setGridContextClientPos(null);
              setGridAddLocalPos(null);
              return;
            }

            // 기본 메뉴 처리
            if (
              id === "add" &&
              gridAddLocalPos &&
              typeof onAddKeyAt === "function"
            ) {
              onAddKeyAt(gridAddLocalPos.dx, gridAddLocalPos.dy);
            } else if (id === "tabCss") {
              setIsTabCssModalOpen(true);
            }
            setIsGridContextOpen(false);
            setGridContextClientPos(null);
            setGridAddLocalPos(null);
          }}
        />
      </div>
      {selectedKey && (
        <KeySettingModal
          keyData={{
            key: selectedKey.key,
            activeImage:
              positions[selectedKeyType][selectedKey.index].activeImage,
            inactiveImage:
              positions[selectedKeyType][selectedKey.index].inactiveImage,
            activeTransparent:
              positions[selectedKeyType][selectedKey.index].activeTransparent ||
              false,
            idleTransparent:
              positions[selectedKeyType][selectedKey.index].idleTransparent ||
              false,
            width: positions[selectedKeyType][selectedKey.index].width,
            height: positions[selectedKeyType][selectedKey.index].height,
            noteColor:
              positions[selectedKeyType][selectedKey.index].noteColor ||
              "#FFFFFF",
            noteOpacity:
              positions[selectedKeyType][selectedKey.index].noteOpacity || 80,
            className:
              positions[selectedKeyType][selectedKey.index].className || "",
          }}
          onClose={() => setSelectedKey(null)}
          onSave={onKeyUpdate}
          skipAnimation={shouldSkipModalAnimation}
        />
      )}
      {/* 카운터 세팅 모달 */}
      {counterTargetIndex != null && (
        <CounterSettingModal
          onClose={() => {
            // 적용하지 않고 닫히는 경우, 원본으로 되돌리기 (미리보기 롤백)
            if (!counterApplied && typeof onCounterPreview === "function") {
              const original =
                counterOriginalSettings ??
                positions[selectedKeyType]?.[counterTargetIndex]?.counter;
              if (original) {
                onCounterPreview(counterTargetIndex, original);
              }
            }
            setCounterTargetIndex(null);
          }}
          onSave={(settings) => {
            if (typeof onCounterUpdate === "function") {
              onCounterUpdate(counterTargetIndex, settings);
            }
            // 저장되었음을 표시 (닫힐 때 롤백 방지)
            setCounterApplied(true);
            setCounterTargetIndex(null);
          }}
          onPreview={(settings) => {
            if (typeof onCounterPreview === "function") {
              onCounterPreview(counterTargetIndex, settings);
            }
          }}
          keyName={(() => {
            const keyCode =
              keyMappings[selectedKeyType]?.[counterTargetIndex] || "";
            return getKeyInfoByGlobalKey(keyCode)?.displayName || keyCode || "";
          })()}
          // 모달은 항상 최초 스냅샷으로 시작 (미리보기로 바뀐 값에 영향을 받지 않도록)
          initialSettings={counterOriginalSettings}
        />
      )}
      {/* 미니맵 */}
      <GridMinimap
        positions={positions[selectedKeyType] || []}
        zoom={zoom}
        panX={panX}
        panY={panY}
        containerRef={gridContainerRef}
        mode={selectedKeyType}
        visible={isGridHovered && !isExtrasPopupOpen}
      />
      {/* 줌 레벨 표시 */}
      <ZoomIndicator zoom={zoom} />
      {/* 탭 CSS 설정 모달 */}
      <TabCssModal
        isOpen={isTabCssModalOpen}
        onClose={() => setIsTabCssModalOpen(false)}
        showAlert={showAlert}
      />
    </div>
  );
}
