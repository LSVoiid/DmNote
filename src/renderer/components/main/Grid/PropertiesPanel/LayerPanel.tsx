import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { useTranslation } from "@contexts/I18nContext";
import { useGridSelectionStore } from "@stores/useGridSelectionStore";
import { useKeyStore } from "@stores/useKeyStore";
import { usePluginDisplayElementStore } from "@stores/usePluginDisplayElementStore";
import { useHistoryStore } from "@stores/useHistoryStore";
import { getKeyInfoByGlobalKey } from "@utils/KeyMaps";
import { SidebarToggleIcon, ModeToggleIcon } from "./PropertyInputs";

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
}

// ============================================================================
// 드래그 아이콘 컴포넌트
// ============================================================================

const DragHandleIcon: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <circle cx="4" cy="3" r="1" fill="#6B6D75" />
    <circle cx="8" cy="3" r="1" fill="#6B6D75" />
    <circle cx="4" cy="6" r="1" fill="#6B6D75" />
    <circle cx="8" cy="6" r="1" fill="#6B6D75" />
    <circle cx="4" cy="9" r="1" fill="#6B6D75" />
    <circle cx="8" cy="9" r="1" fill="#6B6D75" />
  </svg>
);

// ============================================================================
// 키 아이콘 컴포넌트
// ============================================================================

const KeyIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect
      x="2"
      y="3"
      width="10"
      height="8"
      rx="2"
      stroke="#6B6D75"
      strokeWidth="1.2"
    />
    <rect x="5" y="6" width="4" height="2" rx="0.5" fill="#6B6D75" />
  </svg>
);

// ============================================================================
// 플러그인 아이콘 컴포넌트
// ============================================================================

const PluginIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path
      d="M7 2L12 5V9L7 12L2 9V5L7 2Z"
      stroke="#6B6D75"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <circle cx="7" cy="7" r="1.5" fill="#6B6D75" />
  </svg>
);

// ============================================================================
// 레이어 패널 컴포넌트
// ============================================================================

const LayerPanel: React.FC<LayerPanelProps> = ({ onClose, onSwitchToProperty, hasSelection = false }) => {
  const { t } = useTranslation();
  const selectedKeyType = useKeyStore((state) => state.selectedKeyType);
  const positions = useKeyStore((state) => state.positions);
  const keyMappings = useKeyStore((state) => state.keyMappings);
  const pluginElements = usePluginDisplayElementStore((state) => state.elements);
  
  const selectedElements = useGridSelectionStore((state) => state.selectedElements);
  const setSelectedElements = useGridSelectionStore((state) => state.setSelectedElements);
  const clearSelection = useGridSelectionStore((state) => state.clearSelection);
  const toggleSelection = useGridSelectionStore((state) => state.toggleSelection);

  // 드래그 상태
  const [draggedItem, setDraggedItem] = useState<LayerItem | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

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

  // 아이템 클릭 핸들러
  const handleItemClick = useCallback(
    (item: LayerItem, e: React.MouseEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isPrimaryModifierPressed = isMac ? e.metaKey : e.ctrlKey;

      if (item.type === "key" && item.index !== undefined) {
        if (isPrimaryModifierPressed) {
          // Ctrl+클릭: 다중 선택
          toggleSelection({ type: "key", id: item.id, index: item.index });
        } else {
          // 일반 클릭: 단일 선택
          clearSelection();
          toggleSelection({ type: "key", id: item.id, index: item.index });
        }
      } else if (item.type === "plugin") {
        if (isPrimaryModifierPressed) {
          toggleSelection({ type: "plugin", id: item.id });
        } else {
          clearSelection();
          toggleSelection({ type: "plugin", id: item.id });
        }
      }
    },
    [clearSelection, toggleSelection]
  );

  // 아이템이 선택되었는지 확인
  const isItemSelected = useCallback(
    (item: LayerItem) => {
      return selectedElements.some((el) => el.id === item.id);
    },
    [selectedElements]
  );

  // 드래그 시작
  const handleDragStart = useCallback(
    (e: React.DragEvent, item: LayerItem) => {
      setDraggedItem(item);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", item.id);
    },
    []
  );

  // 드래그 종료
  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDragOverIndex(null);
  }, []);

  // 드래그 오버
  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverIndex(index);
    },
    []
  );

  // 드롭
  const handleDrop = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      
      if (!draggedItem) return;

      const items = [...layerItems];
      const draggedIndex = items.findIndex((item) => item.id === draggedItem.id);
      
      if (draggedIndex === -1 || draggedIndex === targetIndex) {
        setDraggedItem(null);
        setDragOverIndex(null);
        return;
      }

      // 히스토리 저장
      const currentPositions = useKeyStore.getState().positions;
      const currentPluginElements = usePluginDisplayElementStore.getState().elements;
      const { keyMappings: km } = useKeyStore.getState();
      useHistoryStore.getState().pushState(km, currentPositions, currentPluginElements);

      // 아이템 재정렬
      const [removed] = items.splice(draggedIndex, 1);
      items.splice(targetIndex, 0, removed);

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

      setDraggedItem(null);
      setDragOverIndex(null);
    },
    [draggedItem, layerItems, selectedKeyType]
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

      {/* 레이어 리스트 */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{ scrollbarGutter: "stable" }}
      >
        {layerItems.length === 0 ? (
          <div className="flex items-center justify-center h-full p-[16px]">
            <p className="text-[#6B6D75] text-style-4 text-center">
              {t("propertiesPanel.noLayers") || "No layers"}
            </p>
          </div>
        ) : (
          <div className="py-[4px]">
            {layerItems.map((item, index) => (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => handleDragStart(e, item)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onClick={(e) => handleItemClick(item, e)}
                className={`
                  flex items-center gap-[8px] px-[12px] py-[6px] cursor-pointer
                  transition-colors select-none
                  ${isItemSelected(item) ? "bg-[#3B82F6]/20" : "hover:bg-[#2A2A30]"}
                  ${draggedItem?.id === item.id ? "opacity-50" : ""}
                  ${dragOverIndex === index ? "border-t-2 border-[#3B82F6]" : ""}
                `}
              >
                {/* 드래그 핸들 */}
                <div className="cursor-grab active:cursor-grabbing">
                  <DragHandleIcon />
                </div>

                {/* 아이콘 */}
                <div className="flex-shrink-0">
                  {item.type === "key" ? <KeyIcon /> : <PluginIcon />}
                </div>

                {/* 이름 */}
                <span
                  className={`flex-1 text-[12px] truncate ${
                    isItemSelected(item) ? "text-[#DBDEE8]" : "text-[#8B8D95]"
                  }`}
                >
                  {item.name}
                </span>

                {/* 선택 표시 */}
                {isItemSelected(item) && (
                  <div className="w-[6px] h-[6px] rounded-full bg-[#3B82F6]" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LayerPanel;
