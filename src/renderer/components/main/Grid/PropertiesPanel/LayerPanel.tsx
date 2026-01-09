import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "@contexts/I18nContext";
import { useGridSelectionStore } from "@stores/useGridSelectionStore";
import { useKeyStore } from "@stores/useKeyStore";
import { usePluginDisplayElementStore } from "@stores/usePluginDisplayElementStore";
import { useHistoryStore } from "@stores/useHistoryStore";
import { getKeyInfoByGlobalKey } from "@utils/KeyMaps";
import { useLenis } from "@hooks/useLenis";
import { SidebarToggleIcon, ModeToggleIcon } from "./PropertyInputs";
import ListPopup, { type ListItem } from "@components/main/Modal/ListPopup";

// ============================================================================
// 레이어 아이템 타입
// ============================================================================

interface LayerItem {
  type: "key" | "plugin";
  id: string;
  index?: number; // key인 경우
  name: string;
  zIndex: number;
}

// ============================================================================
// 레이어 패널 Props
// ============================================================================

interface LayerPanelProps {
  onClose: () => void;
  onSwitchToProperty?: () => void;
  hasSelection?: boolean;
  onSelectionFromPanel?: () => void;
}

// ============================================================================
// 키 아이콘 컴포넌트 (키캡 + 문자)
// ============================================================================

const KeyIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect
      x="2"
      y="2"
      width="10"
      height="10"
      rx="2.5"
      stroke="currentColor"
      strokeWidth="1.2"
    />
    <circle
      cx="7"
      cy="7"
      r="2"
      fill="currentColor"
    />
  </svg>
);

// ============================================================================
// 플러그인 아이콘 컴포넌트 (퍼즐 조각)
// ============================================================================

const PluginIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect
      x="7"
      y="0.05"
      width="9.8"
      height="9.8"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.2"
      transform="rotate(45 7 0.05)"
    />
    <circle
      cx="7"
      cy="7"
      r="2"
      fill="currentColor"
    />
  </svg>
);

// ============================================================================
// 레이어 패널 컴포넌트
// ============================================================================

const LayerPanel: React.FC<LayerPanelProps> = ({ onClose, onSwitchToProperty, hasSelection = false, onSelectionFromPanel }) => {
  const { t } = useTranslation();
  const selectedKeyType = useKeyStore((state) => state.selectedKeyType);
  const positions = useKeyStore((state) => state.positions);
  const keyMappings = useKeyStore((state) => state.keyMappings);
  const pluginElements = usePluginDisplayElementStore((state) => state.elements);
  
  const selectedElements = useGridSelectionStore((state) => state.selectedElements);
  const clearSelection = useGridSelectionStore((state) => state.clearSelection);
  const toggleSelection = useGridSelectionStore((state) => state.toggleSelection);

  // 드래그 상태
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const didDragRef = useRef(false);
  
  // Shift 선택을 위한 마지막 클릭 인덱스
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);

  // 컨텍스트 메뉴 상태
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuItem, setContextMenuItem] = useState<LayerItem | null>(null);
  
  // 드래그 상태를 ref로도 저장 (이벤트 핸들러에서 최신 값 참조용)
  const dragStateRef = useRef<{
    startIndex: number;
    itemHeight: number;
    currentOverIndex: number | null;
  } | null>(null);
  
  // 스크롤 상태
  const scrollElementRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);

  // Lenis 스크롤 적용
  const calculateThumb = useCallback((el: HTMLDivElement) => {
    const { scrollTop, scrollHeight, clientHeight } = el;
    const canScroll = scrollHeight > clientHeight + 1;
    if (!canScroll) return { top: 0, height: 0, visible: false };

    const minThumbHeight = 16;
    const height = Math.max(
      minThumbHeight,
      (clientHeight / scrollHeight) * clientHeight,
    );
    const maxTop = clientHeight - height;
    const top =
      maxTop <= 0 ? 0 : (scrollTop / (scrollHeight - clientHeight)) * maxTop;

    return { top, height, visible: true };
  }, []);

  const updateThumbDOM = useCallback(() => {
    if (!thumbRef.current || !scrollElementRef.current) return;
    const thumb = calculateThumb(scrollElementRef.current);
    thumbRef.current.style.top = `${thumb.top}px`;
    thumbRef.current.style.height = `${thumb.height}px`;
    thumbRef.current.style.display = thumb.visible ? "block" : "none";
  }, [calculateThumb]);

  const { scrollContainerRef: lenisRef } = useLenis({
    onScroll: updateThumbDOM,
  });

  const setScrollRef = useCallback((node: HTMLDivElement | null) => {
    scrollElementRef.current = node;
    lenisRef(node);
  }, [lenisRef]);

  // 초기 thumb 업데이트
  useEffect(() => {
    updateThumbDOM();
  }, [updateThumbDOM]);

  // 레이어 아이템 목록 생성 (z-index 순서로 정렬)
  const layerItems = useMemo(() => {
    const items: LayerItem[] = [];

    // 키 아이템 추가
    const currentPositions = positions[selectedKeyType] || [];
    const currentKeyMappings = keyMappings[selectedKeyType] || [];
    
    currentPositions.forEach((pos, index) => {
      const keyCode = currentKeyMappings[index] || "";
      const keyInfo = keyCode ? getKeyInfoByGlobalKey(keyCode) : null;
      items.push({
        type: "key",
        id: `key-${index}`,
        index,
        name: keyInfo?.displayName || keyCode || `Key ${index + 1}`,
        zIndex: pos.zIndex ?? index,
      });
    });

    // 플러그인 아이템 추가
    pluginElements.forEach((el) => {
      items.push({
        type: "plugin",
        id: el.fullId,
        name: el.definitionId || "Plugin",
        zIndex: el.zIndex ?? 0,
      });
    });

    // z-index 내림차순 정렬 (높은 것이 위에)
    items.sort((a, b) => b.zIndex - a.zIndex);

    return items;
  }, [positions, selectedKeyType, keyMappings, pluginElements]);

  // layerItems를 ref로도 저장 (이벤트 핸들러에서 최신 값 참조용)
  const layerItemsRef = useRef(layerItems);
  layerItemsRef.current = layerItems;

  // 선택된 요소들 설정
  const setSelectedElements = useGridSelectionStore((state) => state.setSelectedElements);

  // 더블클릭 핸들러 - 속성 패널로 전환
  const handleItemDoubleClick = useCallback(
    (item: LayerItem, index: number, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (didDragRef.current || isDraggingRef.current) return;

      // 레이어 패널에서 선택했음을 알림
      onSelectionFromPanel?.();

      // 해당 아이템 선택
      clearSelection();
      if (item.type === "key" && item.index !== undefined) {
        toggleSelection({ type: "key", id: item.id, index: item.index });
      } else if (item.type === "plugin") {
        toggleSelection({ type: "plugin", id: item.id });
      }

      // 속성 패널로 전환
      onSwitchToProperty?.();

      // 마지막 클릭 인덱스 업데이트
      setLastClickedIndex(index);
    },
    [clearSelection, toggleSelection, onSelectionFromPanel, onSwitchToProperty]
  );

  // 아이템 클릭 핸들러 (드래그 중이 아닐 때만 선택)
  const handleItemClick = useCallback(
    (item: LayerItem, index: number, e: React.MouseEvent) => {
      // 드래그 직후 클릭 무시
      if (didDragRef.current) {
        didDragRef.current = false;
        return;
      }
      if (isDraggingRef.current) return;

      // 더블클릭은 바로 전환 처리
      if (e.detail > 1) {
        handleItemDoubleClick(item, index, e);
        return;
      }

      // 레이어 패널에서 선택했음을 알림 (모드 전환 방지)
      onSelectionFromPanel?.();

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isPrimaryModifierPressed = isMac ? e.metaKey : e.ctrlKey;
      const isShiftPressed = e.shiftKey;

      // Shift+클릭: 범위 선택
      if (isShiftPressed && lastClickedIndex !== null) {
        const startIdx = Math.min(lastClickedIndex, index);
        const endIdx = Math.max(lastClickedIndex, index);
        const currentItems = layerItemsRef.current;
        
        // 범위 내의 모든 아이템 선택
        const rangeElements: typeof selectedElements = [];
        for (let i = startIdx; i <= endIdx; i++) {
          const rangeItem = currentItems[i];
          if (rangeItem.type === "key" && rangeItem.index !== undefined) {
            rangeElements.push({ type: "key", id: rangeItem.id, index: rangeItem.index });
          } else if (rangeItem.type === "plugin") {
            rangeElements.push({ type: "plugin", id: rangeItem.id });
          }
        }
        
        if (isPrimaryModifierPressed) {
          // Ctrl+Shift+클릭: 기존 선택에 범위 추가
          const existingIds = new Set(selectedElements.map(el => el.id));
          const newElements = rangeElements.filter(el => !existingIds.has(el.id));
          setSelectedElements([...selectedElements, ...newElements]);
        } else {
          // Shift+클릭: 범위만 선택
          setSelectedElements(rangeElements);
        }
        // Shift 선택 시에는 lastClickedIndex를 유지
        return;
      }

      // Ctrl+클릭 또는 일반 클릭
      const isAlreadySelected = selectedElements.some((el) => el.id === item.id);

      if (item.type === "key" && item.index !== undefined) {
        if (isPrimaryModifierPressed) {
          // Ctrl+클릭: 다중 선택/해제 토글
          toggleSelection({ type: "key", id: item.id, index: item.index });
        } else {
          // 일반 클릭: 이미 선택된 경우 해제, 아니면 단일 선택
          if (isAlreadySelected) {
            onSelectionFromPanel?.(); // 패널 닫힘 방지
            clearSelection();
          } else {
            clearSelection();
            toggleSelection({ type: "key", id: item.id, index: item.index });
          }
        }
      } else if (item.type === "plugin") {
        if (isPrimaryModifierPressed) {
          toggleSelection({ type: "plugin", id: item.id });
        } else {
          if (isAlreadySelected) {
            onSelectionFromPanel?.(); // 패널 닫힘 방지
            clearSelection();
          } else {
            clearSelection();
            toggleSelection({ type: "plugin", id: item.id });
          }
        }
      }

      // 마지막 클릭 인덱스 업데이트 (Shift 선택의 기준점)
      setLastClickedIndex(index);
    },
    [clearSelection, handleItemDoubleClick, lastClickedIndex, onSelectionFromPanel, selectedElements, setSelectedElements, toggleSelection]
  );

  // 아이템이 선택되었는지 확인
  const isItemSelected = useCallback(
    (item: LayerItem) => {
      return selectedElements.some((el) => el.id === item.id);
    },
    [selectedElements]
  );

  // 컨텍스트 메뉴 아이템
  const contextMenuItems = useMemo<ListItem[]>(() => {
    return [
      { id: "delete", label: t("propertiesPanel.delete") || "Delete" },
    ];
  }, [t]);

  // 우클릭 핸들러
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, item: LayerItem, index: number) => {
      e.preventDefault();
      e.stopPropagation();

      // 우클릭한 아이템이 선택되어 있지 않으면 해당 아이템만 선택
      if (!isItemSelected(item)) {
        clearSelection();
        if (item.type === "key" && item.index !== undefined) {
          toggleSelection({ type: "key", id: item.id, index: item.index });
        } else if (item.type === "plugin") {
          toggleSelection({ type: "plugin", id: item.id });
        }
        setLastClickedIndex(index);
      }

      setContextMenuItem(item);
      setContextMenuPosition({ x: e.clientX, y: e.clientY });
      setContextMenuOpen(true);
    },
    [isItemSelected, clearSelection, toggleSelection]
  );

  // 컨텍스트 메뉴 선택 핸들러
  const handleContextMenuSelect = useCallback(
    async (itemId: string) => {
      if (itemId === "delete") {
        // 선택된 요소들 삭제
        if (selectedElements.length === 0) return;

        const keysToDelete = selectedElements
          .filter((el) => el.type === "key" && el.index !== undefined)
          .map((el) => el.index as number);

        const pluginsToDelete = selectedElements
          .filter((el) => el.type === "plugin")
          .map((el) => el.id);

        // 히스토리 저장
        if (keysToDelete.length > 0 || pluginsToDelete.length > 0) {
          const { keyMappings: km, positions: pos } = useKeyStore.getState();
          const currentPluginElements = usePluginDisplayElementStore.getState().elements;
          useHistoryStore.getState().pushState(km, pos, currentPluginElements);
        }

        // 선택 해제
        clearSelection();

        // 키 배치 삭제
        if (keysToDelete.length > 0) {
          const { keyMappings: km, positions: pos } = useKeyStore.getState();
          const mapping = km[selectedKeyType] || [];
          const posArray = pos[selectedKeyType] || [];

          const deleteSet = new Set(keysToDelete);

          const updatedMappings = {
            ...km,
            [selectedKeyType]: mapping.filter((_, index) => !deleteSet.has(index)),
          };

          const updatedPositions = {
            ...pos,
            [selectedKeyType]: posArray.filter((_, index) => !deleteSet.has(index)),
          };

          useKeyStore.getState().setLocalUpdateInProgress(true);

          useKeyStore
            .getState()
            .setKeyMappingsAndPositions(updatedMappings, updatedPositions);

          try {
            await window.api.keys.update(updatedMappings);
            await window.api.keys.updatePositions(updatedPositions);
          } catch (error) {
            console.error("Failed to delete keys", error);
          } finally {
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
      }

      setContextMenuOpen(false);
    },
    [selectedElements, selectedKeyType, clearSelection]
  );

  // 드롭 처리
  const performDrop = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;

      const items = [...layerItemsRef.current];
      
      if (fromIndex === -1 || fromIndex === toIndex) return;

      // 히스토리 저장
      const currentPositions = useKeyStore.getState().positions;
      const currentPluginElements = usePluginDisplayElementStore.getState().elements;
      const { keyMappings: km } = useKeyStore.getState();
      useHistoryStore.getState().pushState(km, currentPositions, currentPluginElements);

      // 아이템 재정렬
      const [removed] = items.splice(fromIndex, 1);
      items.splice(toIndex, 0, removed);

      // 새 z-index 계산 및 적용
      const maxZIndex = items.length - 1;
      
      // 키 positions 복사 및 업데이트
      const updatedPositions = { ...useKeyStore.getState().positions };
      const currentModePositions = [...(updatedPositions[selectedKeyType] || [])];
      
      items.forEach((item, idx) => {
        const newZIndex = maxZIndex - idx; // 맨 위가 가장 높은 z-index

        if (item.type === "key" && item.index !== undefined) {
          // 키 z-index 업데이트
          if (currentModePositions[item.index]) {
            currentModePositions[item.index] = {
              ...currentModePositions[item.index],
              zIndex: newZIndex,
            };
          }
        } else if (item.type === "plugin") {
          // 플러그인 z-index 업데이트
          usePluginDisplayElementStore.getState().updateElement(item.id, {
            zIndex: newZIndex,
          });
        }
      });
      
      // 키 positions 일괄 업데이트
      updatedPositions[selectedKeyType] = currentModePositions;
      useKeyStore.getState().setPositions(updatedPositions);
    },
    [selectedKeyType]
  );

  // 드래그 시작 (마우스 다운)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, item: LayerItem, index: number) => {
      if (e.button !== 0) return;
      
      const target = e.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      
      dragStateRef.current = {
        startIndex: index,
        itemHeight: rect.height,
        currentOverIndex: null,
      };
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      isDraggingRef.current = false;
      
      // 마우스 이동 이벤트 핸들러
      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!dragStateRef.current || !scrollElementRef.current || !dragStartRef.current) return;

        const dx = moveEvent.clientX - dragStartRef.current.x;
        const dy = moveEvent.clientY - dragStartRef.current.y;

        if (!isDraggingRef.current) {
          if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
          isDraggingRef.current = true;
          didDragRef.current = true;
          setDraggedItemId(item.id);
          setIsDragging(true);
        }

        moveEvent.preventDefault();
        
        const scrollRect = scrollElementRef.current.getBoundingClientRect();
        const relativeY = moveEvent.clientY - scrollRect.top + scrollElementRef.current.scrollTop;
        const newIndex = Math.max(0, Math.min(
          layerItemsRef.current.length,
          Math.floor(relativeY / dragStateRef.current.itemHeight)
        ));
        
        dragStateRef.current.currentOverIndex = newIndex;
        setDragOverIndex(newIndex);
      };
      
      // 마우스 업 이벤트 핸들러
      const handleMouseUp = () => {
        if (dragStateRef.current && isDraggingRef.current) {
          const fromIndex = dragStateRef.current.startIndex;
          const toIndex = dragStateRef.current.currentOverIndex;
          
          if (toIndex !== null && fromIndex !== toIndex) {
            // 드롭 위치 계산: toIndex가 fromIndex보다 크면 -1
            const actualToIndex = toIndex > fromIndex ? toIndex - 1 : toIndex;
            if (fromIndex !== actualToIndex) {
              performDrop(fromIndex, actualToIndex);
            }
          }
        }
        
        dragStateRef.current = null;
        dragStartRef.current = null;
        isDraggingRef.current = false;
        setDraggedItemId(null);
        setDragOverIndex(null);
        setIsDragging(false);
        
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
      
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [performDrop]
  );

  return (
    <div className="absolute right-0 top-0 bottom-0 w-[220px] bg-[#1F1F24] border-l border-[#3A3943] flex flex-col z-30 shadow-lg">
      {/* 헤더 */}
      <div className="flex-shrink-0 border-b border-[#3A3943]">
        <div className="flex items-center justify-between p-[12px]">
          <span className="text-[#DBDEE8] text-style-2">
            {t("propertiesPanel.canvas") || "Canvas"}
          </span>
          <div className="flex items-center gap-[4px]">
            {/* 모드 토글 버튼 - hasSelection에 따라 활성/비활성 */}
            <button
              disabled={!hasSelection}
              onClick={hasSelection ? onSwitchToProperty : undefined}
              className={`w-[24px] h-[24px] flex items-center justify-center rounded-[4px] transition-colors ${
                hasSelection ? "hover:bg-[#2A2A30] cursor-pointer" : "cursor-not-allowed opacity-70"
              }`}
              title={t("propertiesPanel.switchToProperty") || "Switch to Property"}
            >
              <ModeToggleIcon mode="property" disabled={!hasSelection} />
            </button>
            {/* 패널 닫기 버튼 */}
            <button
              onClick={onClose}
              className="w-[24px] h-[24px] flex items-center justify-center hover:bg-[#2A2A30] rounded-[4px] transition-colors"
              title={t("propertiesPanel.closePanel") || "Close Panel"}
            >
              <SidebarToggleIcon isOpen={true} />
            </button>
          </div>
        </div>
      </div>

      {/* 레이어 섹션 헤더 */}
      <div className="flex-shrink-0 px-[12px] py-[8px] border-b border-[#3A3943]">
        <span className="text-[#8B8D95] text-style-4">
          {t("propertiesPanel.layers") || "Layers"} ({layerItems.length})
        </span>
      </div>

      {/* 레이어 리스트 - 속성 패널 스타일 스크롤 */}
      <div className="flex-1 properties-panel-overlay-scroll">
        <div
          ref={setScrollRef}
          className="properties-panel-overlay-viewport"
        >
          {layerItems.length === 0 ? (
            <div className="flex items-center justify-center h-full p-[16px]">
              <p className="text-[#6B6D75] text-style-4 text-center">
                {t("propertiesPanel.noLayers") || "No layers"}
              </p>
            </div>
          ) : (
            <div className="py-[4px] relative">
              {layerItems.map((item, index) => (
                <div
                  key={item.id}
                  onMouseDown={(e) => handleMouseDown(e, item, index)}
                  onClick={(e) => handleItemClick(item, index, e)}
                  onDoubleClick={(e) => handleItemDoubleClick(item, index, e)}
                  onContextMenu={(e) => handleContextMenu(e, item, index)}
                  className={`
                    relative flex items-center gap-[8px] px-[12px] py-[8px]
                    select-none cursor-grab
                    ${isItemSelected(item) 
                      ? "bg-[#3B82F6]/20 text-[#DBDEE8]" 
                      : isDragging 
                        ? "text-[#8B8D95]" 
                        : "hover:bg-[#2A2A30] text-[#8B8D95]"
                    }
                  `}
                >
                  {/* 드롭 인디케이터 (피그마 스타일 선) - 위쪽 */}
                  {dragOverIndex === index && draggedItemId !== item.id && (
                    <div className="absolute left-0 right-0 top-0 h-[2px] bg-[#3B82F6] z-10" />
                  )}

                  {/* 아이콘 */}
                  <div className="flex-shrink-0">
                    {item.type === "key" ? <KeyIcon /> : <PluginIcon />}
                  </div>

                  {/* 이름 */}
                  <span className="flex-1 text-[12px] truncate">
                    {item.name}
                  </span>


                </div>
              ))}
              
              {/* 마지막 아이템 뒤 드롭 인디케이터 */}
              {dragOverIndex === layerItems.length && (
                <div className="absolute left-0 right-0 bottom-0 h-[2px] bg-[#3B82F6] z-10" />
              )}
            </div>
          )}
          
          {/* 커스텀 스크롤바 */}
          <div className="properties-panel-overlay-bar">
            <div
              ref={thumbRef}
              className="properties-panel-overlay-thumb"
              style={{ display: 'none' }}
            />
          </div>
        </div>
      </div>

      {/* 컨텍스트 메뉴 */}
      {contextMenuOpen && createPortal(
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
    </div>
  );
};

export default LayerPanel;
