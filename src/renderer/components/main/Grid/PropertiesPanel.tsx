import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import { useTranslation } from "@contexts/I18nContext";
import { useGridSelectionStore } from "@stores/useGridSelectionStore";
import { useKeyStore } from "@stores/useKeyStore";
import { useSettingsStore } from "@stores/useSettingsStore";
import { getKeyInfoByGlobalKey } from "@utils/KeyMaps";
import type { KeyPosition, KeyCounterSettings } from "@src/types/keys";
import {
  createDefaultCounterSettings,
  normalizeCounterSettings,
} from "@src/types/keys";
import ColorPicker from "@components/main/Modal/content/ColorPicker";
import ImagePicker from "@components/main/Modal/content/ImagePicker";

// 분리된 컴포넌트들 및 훅
import {
  TABS,
  TabType,
  PropertyRow,
  NumberInput,
  ColorInput,
  TextInput,
  SectionDivider,
  FontStyleToggle,
  Tabs,
  SidebarToggleIcon,
  ModeToggleIcon,
  StyleTabContent,
  NoteTabContent,
  CounterTabContent,
  BatchStyleTabContent,
  BatchNoteTabContent,
  BatchCounterTabContent,
  LayerPanel,
  useBatchHandlers,
  usePanelScroll,
} from "./PropertiesPanel/index";
import Checkbox from "@components/main/common/Checkbox";
import Dropdown from "@components/main/common/Dropdown";
import type { NoteColor } from "@src/types/keys";

// ============================================================================
// 메인 컴포넌트 Props
// ============================================================================

interface PropertiesPanelProps {
  onPositionChange: (index: number, dx: number, dy: number) => void;
  onKeyUpdate: (data: Partial<KeyPosition> & { index: number }) => void;
  onKeyBatchUpdate?: (updates: Array<{ index: number } & Partial<KeyPosition>>) => void;
  onKeyPreview?: (index: number, updates: Partial<KeyPosition>) => void;
  onKeyBatchPreview?: (updates: Array<{ index: number } & Partial<KeyPosition>>) => void;
  onKeyMappingChange?: (index: number, newKey: string) => void;
}

// ============================================================================
// 메인 컴포넌트
// ============================================================================

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  onPositionChange,
  onKeyUpdate,
  onKeyBatchUpdate,
  onKeyPreview,
  onKeyBatchPreview,
  onKeyMappingChange,
}) => {
  const { t } = useTranslation();
  const selectedElements = useGridSelectionStore(
    (state) => state.selectedElements,
  );
  const clearSelection = useGridSelectionStore((state) => state.clearSelection);
  const selectedKeyType = useKeyStore((state) => state.selectedKeyType);
  const positions = useKeyStore((state) => state.positions);
  const keyMappings = useKeyStore((state) => state.keyMappings);
  const { useCustomCSS } = useSettingsStore();

  // 선택된 키 요소 필터링
  const selectedKeyElements = selectedElements.filter(
    (el) => el.type === "key",
  );

  // 단일 키 선택인 경우의 데이터
  const singleKeyIndex =
    selectedKeyElements.length === 1 ? selectedKeyElements[0].index : null;
  const singleKeyPosition =
    singleKeyIndex !== null
      ? positions[selectedKeyType]?.[singleKeyIndex]
      : null;
  const singleKeyCode =
    singleKeyIndex !== null
      ? keyMappings[selectedKeyType]?.[singleKeyIndex]
      : null;
  const singleKeyInfo = singleKeyCode
    ? getKeyInfoByGlobalKey(singleKeyCode)
    : null;

  // 로컬 상태 (실시간 편집용)
  const [localState, setLocalState] = useState<
    Partial<KeyPosition> & { dx?: number; dy?: number }
  >({});

  // 키 리스닝 상태
  const [isListening, setIsListening] = useState(false);
  const justAssignedRef = useRef(false);

  // 이미지 픽커 상태
  const [showImagePicker, setShowImagePicker] = useState(false);
  const imageButtonRef = useRef<HTMLButtonElement>(null);

  // 다중 선택용 이미지 픽커 상태
  const [showBatchImagePicker, setShowBatchImagePicker] = useState(false);
  const batchImageButtonRef = useRef<HTMLButtonElement>(null);

  // 일괄 편집용 컬러 버튼 refs
  const batchNoteColorButtonRef = useRef<HTMLButtonElement>(null);
  const batchGlowColorButtonRef = useRef<HTMLButtonElement>(null);
  const batchCounterFillIdleButtonRef = useRef<HTMLButtonElement>(null);
  const batchCounterFillActiveButtonRef = useRef<HTMLButtonElement>(null);
  const batchCounterStrokeIdleButtonRef = useRef<HTMLButtonElement>(null);
  const batchCounterStrokeActiveButtonRef = useRef<HTMLButtonElement>(null);

  // 패널 ref (컬러픽커/이미지픽커 위치 기준)
  // useRef 대신 useState를 사용하여 ref가 설정될 때 리렌더링 유발
  const [panelElement, setPanelElement] = useState<HTMLDivElement | null>(null);

  // 패널 가시성 상태 (선택과 별개로 패널만 닫을 수 있음)
  const [isPanelVisible, setIsPanelVisible] = useState(false);

  // 패널 모드 상태 (layer: 레이어 패널, property: 속성 패널)
  const [panelMode, setPanelMode] = useState<"layer" | "property">("property");

  // 탭 상태
  const [activeTab, setActiveTab] = useState<TabType>(TABS.STYLE);

  // 스크롤 훅 사용
  const {
    batchScrollRefFor,
    batchThumbRefFor,
    singleScrollRefFor,
    singleThumbRefFor,
  } = usePanelScroll(activeTab, selectedElements.length);

  // 배치 편집용 로컬 ColorPicker 상태
  type BatchPickerTarget =
    | "noteColor"
    | "glowColor"
    | "fillIdle"
    | "fillActive"
    | "strokeIdle"
    | "strokeActive"
    | null;
  const [batchPickerFor, setBatchPickerFor] = useState<BatchPickerTarget>(null);

  // 배치 편집용 로컬 색상 상태 (드래그 중 UI 업데이트용)
  const [batchLocalColors, setBatchLocalColors] = useState<{
    noteColor: any;
    glowColor: any;
    fillIdle: string;
    fillActive: string;
    strokeIdle: string;
    strokeActive: string;
  }>({
    noteColor: "#FFA500",
    glowColor: "#FFA500",
    fillIdle: "#FFFFFF",
    fillActive: "#FFFFFF",
    strokeIdle: "#000000",
    strokeActive: "#000000",
  });

  // 선택이 변경되면 로컬 상태 초기화
  useEffect(() => {
    if (singleKeyPosition) {
      setLocalState({
        dx: singleKeyPosition.dx,
        dy: singleKeyPosition.dy,
        width: singleKeyPosition.width || 60,
        height: singleKeyPosition.height || 60,
      });
    } else {
      setLocalState({});
    }
  }, [
    singleKeyPosition?.dx,
    singleKeyPosition?.dy,
    singleKeyPosition?.width,
    singleKeyPosition?.height,
  ]);

  // 선택된 키가 변경될 때 패널 열기/닫기
  useEffect(() => {
    if (singleKeyIndex !== null) {
      setIsPanelVisible(true);
    } else if (selectedKeyElements.length === 0 && selectedElements.length === 0) {
      // 선택이 모두 해제되면 패널 닫기 (레이어 모드에서는 유지)
      if (panelMode !== "layer") {
        setIsPanelVisible(false);
      }
    }
    setShowImagePicker(false);
    setShowBatchImagePicker(false);
    setIsListening(false);
  }, [singleKeyIndex, selectedKeyElements.length, selectedElements.length, panelMode]);

  // 다중 선택 시 패널 자동 열기
  useEffect(() => {
    if (selectedKeyElements.length > 1) {
      setIsPanelVisible(true);
    }
  }, [selectedKeyElements.length]);

  // 키 리스닝 상태를 전역으로 노출 (App.tsx의 Tab 단축키 등에서 체크)
  useEffect(() => {
    (window as any).__dmn_isKeyListening = isListening;
    return () => {
      (window as any).__dmn_isKeyListening = false;
    };
  }, [isListening]);

  // 키 리스닝 중 브라우저 기본 동작 차단
  useEffect(() => {
    if (!isListening) return undefined;

    const blockKeyboardEvents = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const blockMouseEvents = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const blockContextMenu = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener("keydown", blockKeyboardEvents, true);
    window.addEventListener("keyup", blockKeyboardEvents, true);
    window.addEventListener("keypress", blockKeyboardEvents, true);
    window.addEventListener("mousedown", blockMouseEvents, true);
    window.addEventListener("contextmenu", blockContextMenu, true);

    return () => {
      window.removeEventListener("keydown", blockKeyboardEvents, true);
      window.removeEventListener("keyup", blockKeyboardEvents, true);
      window.removeEventListener("keypress", blockKeyboardEvents, true);
      window.removeEventListener("mousedown", blockMouseEvents, true);
      window.removeEventListener("contextmenu", blockContextMenu, true);
    };
  }, [isListening]);

  // 키 리스닝 effect
  useEffect(() => {
    if (!isListening) return undefined;
    if (typeof window === "undefined" || !window.api?.keys?.onRawInput) {
      return undefined;
    }

    const unsubscribe = window.api.keys.onRawInput((payload: any) => {
      if (!payload || payload.state !== "DOWN") return;
      const targetLabel =
        payload.label ||
        (Array.isArray(payload.labels) ? payload.labels[0] : null);
      if (!targetLabel) return;

      const info = getKeyInfoByGlobalKey(targetLabel);

      justAssignedRef.current = true;
      setTimeout(() => {
        justAssignedRef.current = false;
      }, 100);

      setIsListening(false);

      if (singleKeyIndex !== null && onKeyMappingChange) {
        onKeyMappingChange(singleKeyIndex, info.globalKey);
      }
    });

    return () => {
      try {
        unsubscribe?.();
      } catch (error) {
        console.error("Failed to unsubscribe raw input listener", error);
      }
    };
  }, [isListening, singleKeyIndex, onKeyMappingChange]);

  // ============================================================================
  // 핸들러
  // ============================================================================

  const handleTogglePanel = useCallback(() => {
    setIsPanelVisible((prev) => !prev);
    if (isPanelVisible) {
      setShowImagePicker(false);
      setShowBatchImagePicker(false);
    }
  }, [isPanelVisible]);

  const handleToggleMode = useCallback(() => {
    setPanelMode((prev) => (prev === "layer" ? "property" : "layer"));
  }, []);

  const handleClose = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  const handleKeyListen = useCallback(() => {
    if (justAssignedRef.current) return;
    setIsListening(true);
  }, []);

  // 크기 변경 완료 (blur 시 저장)
  const handleSizeBlur = useCallback(() => {
    if (singleKeyIndex === null) return;
    const updates: Partial<KeyPosition> = {};
    if (localState.width !== undefined) updates.width = localState.width;
    if (localState.height !== undefined) updates.height = localState.height;
    if (Object.keys(updates).length > 0) {
      onKeyUpdate({ index: singleKeyIndex, ...updates });
    }
  }, [singleKeyIndex, localState.width, localState.height, onKeyUpdate]);

  // ============================================================================
  // 다중 선택 헬퍼 함수들
  // ============================================================================

  const getSelectedKeysData = useCallback(() => {
    return selectedKeyElements
      .map((el) => {
        const keyIndex = el.index!;
        const position = positions[selectedKeyType]?.[keyIndex];
        const keyCode = keyMappings[selectedKeyType]?.[keyIndex];
        const keyInfo = keyCode ? getKeyInfoByGlobalKey(keyCode) : null;
        return { index: keyIndex, position, keyCode, keyInfo };
      })
      .filter((data) => data.position !== undefined);
  }, [selectedKeyElements, positions, selectedKeyType, keyMappings]);

  const getMixedValue = useCallback(
    <T,>(
      getter: (pos: KeyPosition) => T | undefined,
      defaultValue: T,
    ): { isMixed: boolean; value: T } => {
      const keysData = getSelectedKeysData();
      if (keysData.length === 0) return { isMixed: false, value: defaultValue };

      const firstValue = getter(keysData[0].position!) ?? defaultValue;
      const isMixed = keysData.some((data) => {
        const val = getter(data.position!) ?? defaultValue;
        if (typeof val === "object" && typeof firstValue === "object") {
          return JSON.stringify(val) !== JSON.stringify(firstValue);
        }
        return val !== firstValue;
      });

      return { isMixed, value: firstValue };
    },
    [getSelectedKeysData],
  );

  // ============================================================================
  // 다중 선택 일괄 편집 핸들러 (훅 사용)
  // ============================================================================

  const {
    handleBatchStyleChange,
    handleBatchStyleChangeComplete,
    handleBatchAlign,
    handleBatchDistribute,
    handleBatchResize,
    handleBatchCounterUpdate,
    handleBatchNoteColorChange,
    handleBatchNoteColorChangeComplete,
    handleBatchGlowColorChange,
    handleBatchGlowColorChangeComplete,
  } = useBatchHandlers({
    selectedKeyElements,
    positions,
    selectedKeyType,
    onKeyUpdate,
    onKeyBatchUpdate,
    onKeyPreview,
    onKeyBatchPreview,
  });

  // (사이드 패널) 일괄 편집에서도 전역 컬러피커를 쓰지 않음
  // - 노트/글로우는 NoteTabContent(단일 편집)에서 로컬 ColorPicker로 처리
  // - 카운터는 CounterTabContent(단일 편집)로 로컬 ColorPicker 처리

  // 배치 편집용 interactiveRefs
  const batchColorPickerInteractiveRefs = useMemo(
    () => [
      batchNoteColorButtonRef,
      batchGlowColorButtonRef,
      batchCounterFillIdleButtonRef,
      batchCounterFillActiveButtonRef,
      batchCounterStrokeIdleButtonRef,
      batchCounterStrokeActiveButtonRef,
    ],
    [],
  );

  // 배치 피커 토글 - 열릴 때 현재 색상값으로 로컬 상태 초기화
  const handleBatchPickerToggle = useCallback(
    (target: typeof batchPickerFor) => {
      if (target && target !== batchPickerFor) {
        // 피커가 열릴 때 현재 색상값으로 로컬 상태 초기화
        const keysData = getSelectedKeysData();
        const firstPos = keysData[0]?.position;
        if (firstPos) {
          const counterSettings = normalizeCounterSettings(firstPos.counter);
          setBatchLocalColors({
            noteColor: (() => {
              const nc = firstPos.noteColor;
              if (
                nc &&
                typeof nc === "object" &&
                "type" in nc &&
                nc.type === "gradient"
              ) {
                return { type: "gradient", top: nc.top, bottom: nc.bottom };
              }
              return typeof nc === "string" ? nc : "#FFA500";
            })(),
            glowColor: (() => {
              const gc = firstPos.noteGlowColor;
              if (
                gc &&
                typeof gc === "object" &&
                "type" in gc &&
                gc.type === "gradient"
              ) {
                return { type: "gradient", top: gc.top, bottom: gc.bottom };
              }
              return typeof gc === "string" ? gc : "#FFA500";
            })(),
            fillIdle: counterSettings.fill.idle,
            fillActive: counterSettings.fill.active,
            strokeIdle: counterSettings.stroke.idle,
            strokeActive: counterSettings.stroke.active,
          });
        }
      }
      setBatchPickerFor((prev) => (prev === target ? null : target));
    },
    [batchPickerFor, getSelectedKeysData],
  );

  // 배치 피커 색상값 가져오기 (로컬 상태 사용)
  const getBatchPickerColor = useCallback((): any => {
    switch (batchPickerFor) {
      case "noteColor":
        return batchLocalColors.noteColor;
      case "glowColor":
        return batchLocalColors.glowColor;
      case "fillIdle":
        return batchLocalColors.fillIdle;
      case "fillActive":
        return batchLocalColors.fillActive;
      case "strokeIdle":
        return batchLocalColors.strokeIdle;
      case "strokeActive":
        return batchLocalColors.strokeActive;
      default:
        return "#FFA500";
    }
  }, [batchPickerFor, batchLocalColors]);

  // 배치 피커 referenceRef (카운터 컬러픽커는 원본 모달처럼 fillActive 버튼 위치에 고정)
  const getBatchPickerRef = useCallback(() => {
    switch (batchPickerFor) {
      case "noteColor":
        return batchNoteColorButtonRef;
      case "glowColor":
        return batchGlowColorButtonRef;
      case "fillIdle":
      case "fillActive":
      case "strokeIdle":
      case "strokeActive":
        // 카운터 컬러픽커는 모두 fillActive 버튼 위치에서 렌더링
        return batchCounterFillActiveButtonRef;
      default:
        return null;
    }
  }, [batchPickerFor]);

  // 배치 피커 색상 변경 (드래그 중 - 로컬 상태만 업데이트)
  const handleBatchPickerColorChange = useCallback(
    (newColor: any) => {
      // 로컬 상태 업데이트
      if (batchPickerFor) {
        setBatchLocalColors((prev) => ({
          ...prev,
          [batchPickerFor]: newColor,
        }));
      }

      // 노트/글로우는 프리뷰도 함께 업데이트
      if (batchPickerFor === "noteColor") {
        handleBatchNoteColorChange(newColor);
      } else if (batchPickerFor === "glowColor") {
        handleBatchGlowColorChange(newColor);
      }
      // counter 색상은 preview 없이 complete에서만 처리
    },
    [batchPickerFor, handleBatchNoteColorChange, handleBatchGlowColorChange],
  );

  const handleBatchPickerColorChangeComplete = useCallback(
    (newColor: any) => {
      // 로컬 상태 업데이트
      if (batchPickerFor) {
        setBatchLocalColors((prev) => ({
          ...prev,
          [batchPickerFor]: newColor,
        }));
      }

      const keysData = getSelectedKeysData();
      const firstCounter = keysData[0]?.position
        ? normalizeCounterSettings(keysData[0].position.counter)
        : createDefaultCounterSettings();

      if (batchPickerFor === "noteColor") {
        handleBatchNoteColorChangeComplete(newColor);
      } else if (batchPickerFor === "glowColor") {
        handleBatchGlowColorChangeComplete(newColor);
      } else if (batchPickerFor === "fillIdle") {
        handleBatchCounterUpdate({
          fill: { ...firstCounter.fill, idle: newColor },
        });
      } else if (batchPickerFor === "fillActive") {
        handleBatchCounterUpdate({
          fill: { ...firstCounter.fill, active: newColor },
        });
      } else if (batchPickerFor === "strokeIdle") {
        handleBatchCounterUpdate({
          stroke: { ...firstCounter.stroke, idle: newColor },
        });
      } else if (batchPickerFor === "strokeActive") {
        handleBatchCounterUpdate({
          stroke: { ...firstCounter.stroke, active: newColor },
        });
      }
    },
    [
      batchPickerFor,
      getSelectedKeysData,
      handleBatchNoteColorChangeComplete,
      handleBatchGlowColorChangeComplete,
      handleBatchCounterUpdate,
    ],
  );

  // ============================================================================
  // 렌더링
  // ============================================================================

  // 패널이 닫혀있을 때는 토글 버튼만 표시
  if (!isPanelVisible) {
    return (
      <div className="absolute right-0 top-0 z-30">
        <button
          onClick={handleTogglePanel}
          className="m-[8px] w-[32px] h-[32px] bg-[#1F1F24] border border-[#3A3943] rounded-[7px] flex items-center justify-center hover:bg-[#2A2A30] hover:border-[#505058] transition-colors shadow-lg"
          title={t("propertiesPanel.openPanel") || "속성 패널 열기"}
        >
          <SidebarToggleIcon isOpen={false} />
        </button>
      </div>
    );
  }

  // 레이어 모드일 때는 선택 여부와 관계없이 레이어 패널 표시
  if (panelMode === "layer") {
    const hasAnySelection = selectedKeyElements.length > 0 || selectedElements.length > 0;
    return (
      <LayerPanel 
        onClose={handleTogglePanel} 
        onSwitchToProperty={hasAnySelection ? handleToggleMode : undefined}
        hasSelection={hasAnySelection}
      />
    );
  }

  // 선택된 키 요소가 없으면 레이어 패널 표시 (panelMode가 property여도)
  if (selectedKeyElements.length === 0 && selectedElements.length === 0) {
    return <LayerPanel onClose={handleTogglePanel} />;
  }

  // 다중 선택인 경우
  if (selectedKeyElements.length > 1) {
    const getBatchNoteColorDisplay = () => {
      // 노트 피커가 열려있으면 로컬 상태 사용
      if (batchPickerFor === "noteColor") {
        const value = batchLocalColors.noteColor;
        if (
          value &&
          typeof value === "object" &&
          "type" in value &&
          value.type === "gradient"
        ) {
          return {
            style: {
              background: `linear-gradient(to bottom, ${value.top}, ${value.bottom})`,
            },
            label: "Gradient",
            isMixed: false,
          };
        }
        const color = typeof value === "string" ? value : "#FFA500";
        return {
          style: { backgroundColor: color },
          label: color.replace(/^#/, ""),
          isMixed: false,
        };
      }

      const { isMixed, value } = getMixedValue(
        (pos) => pos.noteColor,
        "#FFA500",
      );
      if (isMixed)
        return {
          style: { backgroundColor: "#666" },
          label: "Mixed",
          isMixed: true,
        };
      if (
        value &&
        typeof value === "object" &&
        "type" in value &&
        value.type === "gradient"
      ) {
        return {
          style: {
            background: `linear-gradient(to bottom, ${value.top}, ${value.bottom})`,
          },
          label: "Gradient",
          isMixed: false,
        };
      }
      const color = typeof value === "string" ? value : "#FFA500";
      return {
        style: { backgroundColor: color },
        label: color.replace(/^#/, ""),
        isMixed: false,
      };
    };

    const getBatchGlowColorDisplay = () => {
      // 글로우 피커가 열려있으면 로컬 상태 사용
      if (batchPickerFor === "glowColor") {
        const value = batchLocalColors.glowColor;
        if (
          value &&
          typeof value === "object" &&
          "type" in value &&
          value.type === "gradient"
        ) {
          return {
            style: {
              background: `linear-gradient(to bottom, ${value.top}, ${value.bottom})`,
            },
            label: "Gradient",
            isMixed: false,
          };
        }
        const color = typeof value === "string" ? value : "#FFA500";
        return {
          style: { backgroundColor: color },
          label: color.replace(/^#/, ""),
          isMixed: false,
        };
      }

      const { isMixed, value } = getMixedValue(
        (pos) => pos.noteGlowColor,
        "#FFA500",
      );
      if (isMixed)
        return {
          style: { backgroundColor: "#666" },
          label: "Mixed",
          isMixed: true,
        };
      if (
        value &&
        typeof value === "object" &&
        "type" in value &&
        value.type === "gradient"
      ) {
        return {
          style: {
            background: `linear-gradient(to bottom, ${value.top}, ${value.bottom})`,
          },
          label: "Gradient",
          isMixed: false,
        };
      }
      const color = typeof value === "string" ? value : "#FFA500";
      return {
        style: { backgroundColor: color },
        label: color.replace(/^#/, ""),
        isMixed: false,
      };
    };

    // 카운터 색상 표시 (피커가 열려있을 때는 로컬 상태 사용)
    const getCounterColorDisplay = (
      key: "fillIdle" | "fillActive" | "strokeIdle" | "strokeActive",
    ) => {
      if (batchPickerFor === key) {
        return batchLocalColors[key];
      }
      const keysData = getSelectedKeysData();
      const firstPos = keysData[0]?.position;
      if (!firstPos) return "#FFFFFF";
      const counterSettings = normalizeCounterSettings(firstPos.counter);
      switch (key) {
        case "fillIdle":
          return counterSettings.fill.idle;
        case "fillActive":
          return counterSettings.fill.active;
        case "strokeIdle":
          return counterSettings.stroke.idle;
        case "strokeActive":
          return counterSettings.stroke.active;
      }
    };

    const keysData = getSelectedKeysData();
    const batchCounterSettings = keysData[0]?.position
      ? normalizeCounterSettings(keysData[0].position.counter)
      : createDefaultCounterSettings();

    return (
      <div
        ref={setPanelElement}
        className="absolute right-0 top-0 bottom-0 w-[220px] bg-[#1F1F24] border-l border-[#3A3943] flex flex-col z-30 shadow-lg"
      >
        {/* 헤더 + 탭 영역 */}
        <div className="flex-shrink-0 border-b border-[#3A3943]">
          {/* 헤더 */}
          <div className="flex items-center justify-between p-[12px] pb-[8px]">
            <div className="flex items-center gap-[8px]">
              <span className="text-[#DBDEE8] text-style-2">
                {t("propertiesPanel.multiSelection") || "다중 선택"}
              </span>
              <span className="text-[#6B6D75] text-style-4">
                ({selectedKeyElements.length})
              </span>
            </div>
            <div className="flex items-center gap-[4px]">
              {/* 레이어 모드로 전환 버튼 */}
              <button
                onClick={handleToggleMode}
                className="w-[24px] h-[24px] flex items-center justify-center hover:bg-[#2A2A30] rounded-[4px] transition-colors"
                title={t("propertiesPanel.switchToLayer") || "Switch to Layer"}
              >
                <ModeToggleIcon mode="layer" />
              </button>
              {/* 패널 닫기 버튼 */}
              <button
                onClick={handleTogglePanel}
                className="w-[24px] h-[24px] flex items-center justify-center hover:bg-[#2A2A30] rounded-[4px] transition-colors"
                title={t("propertiesPanel.closePanel") || "속성 패널 닫기"}
              >
                <SidebarToggleIcon isOpen={true} />
              </button>
            </div>
          </div>

          {/* 탭 */}
          <div className="px-[12px] pb-[12px]">
            <Tabs activeTab={activeTab} onTabChange={setActiveTab} t={t} />
          </div>
        </div>

        {/* 일괄 편집 모드 체크박스 */}
        {/* 일괄 편집 모드 */}
        <>
          {/* 스크롤 가능한 속성 영역 (탭별 독립 스크롤) */}
          <div className="flex-1 properties-panel-overlay-scroll">
            {/* STYLE 탭 viewport */}
            <div
              ref={batchScrollRefFor(TABS.STYLE)}
              className={`properties-panel-overlay-viewport ${activeTab === TABS.STYLE ? "" : "hidden"}`}
            >
              <div className="p-[12px] flex flex-col gap-[12px]">
                <BatchStyleTabContent
                  selectedCount={selectedKeyElements.length}
                  getMixedValue={getMixedValue}
                  getSelectedKeysData={getSelectedKeysData}
                  handleBatchAlign={handleBatchAlign}
                  handleBatchDistribute={handleBatchDistribute}
                  handleBatchResize={handleBatchResize}
                  handleBatchStyleChange={handleBatchStyleChange}
                  handleBatchStyleChangeComplete={handleBatchStyleChangeComplete}
                  showBatchImagePicker={showBatchImagePicker}
                  onToggleBatchImagePicker={() => setShowBatchImagePicker(!showBatchImagePicker)}
                  batchImageButtonRef={batchImageButtonRef}
                  panelElement={panelElement}
                  useCustomCSS={useCustomCSS}
                  t={t}
                />
              </div>
              <div className="properties-panel-overlay-bar">
                <div
                  ref={batchThumbRefFor(TABS.STYLE)}
                  className="properties-panel-overlay-thumb"
                  style={{ display: 'none' }}
                />
              </div>
            </div>

            {/* NOTE 탭 viewport */}
            <div
              ref={batchScrollRefFor(TABS.NOTE)}
              className={`properties-panel-overlay-viewport ${activeTab === TABS.NOTE ? "" : "hidden"}`}
            >
              <div className="p-[12px] flex flex-col gap-[12px]">
                <BatchNoteTabContent
                  getMixedValue={getMixedValue}
                  handleBatchStyleChangeComplete={handleBatchStyleChangeComplete}
                  getBatchNoteColorDisplay={getBatchNoteColorDisplay}
                  getBatchGlowColorDisplay={getBatchGlowColorDisplay}
                  onNoteColorPickerToggle={() => handleBatchPickerToggle("noteColor")}
                  onGlowColorPickerToggle={() => handleBatchPickerToggle("glowColor")}
                  batchNoteColorButtonRef={batchNoteColorButtonRef}
                  batchGlowColorButtonRef={batchGlowColorButtonRef}
                  t={t}
                />
              </div>
              <div className="properties-panel-overlay-bar">
                <div
                  ref={batchThumbRefFor(TABS.NOTE)}
                  className="properties-panel-overlay-thumb"
                  style={{ display: 'none' }}
                />
              </div>
            </div>

            {/* COUNTER 탭 viewport */}
            <div
              ref={batchScrollRefFor(TABS.COUNTER)}
              className={`properties-panel-overlay-viewport ${activeTab === TABS.COUNTER ? "" : "hidden"}`}
            >
              <div className="p-[12px] flex flex-col gap-[12px]">
                <BatchCounterTabContent
                  batchCounterSettings={batchCounterSettings}
                  handleBatchCounterUpdate={handleBatchCounterUpdate}
                  getCounterColorDisplay={getCounterColorDisplay}
                  onFillIdlePickerToggle={() => handleBatchPickerToggle("fillIdle")}
                  onFillActivePickerToggle={() => handleBatchPickerToggle("fillActive")}
                  onStrokeIdlePickerToggle={() => handleBatchPickerToggle("strokeIdle")}
                  onStrokeActivePickerToggle={() => handleBatchPickerToggle("strokeActive")}
                  batchCounterFillIdleButtonRef={batchCounterFillIdleButtonRef}
                  batchCounterFillActiveButtonRef={batchCounterFillActiveButtonRef}
                  batchCounterStrokeIdleButtonRef={batchCounterStrokeIdleButtonRef}
                  batchCounterStrokeActiveButtonRef={batchCounterStrokeActiveButtonRef}
                  t={t}
                />
              </div>
              <div className="properties-panel-overlay-bar">
                <div
                  ref={batchThumbRefFor(TABS.COUNTER)}
                  className="properties-panel-overlay-thumb"
                  style={{ display: 'none' }}
                />
              </div>
            </div>
          </div>

          {/* 배치 편집용 로컬 ColorPicker (모든 탭 공통) */}
          {batchPickerFor && (
            <ColorPicker
              open={!!batchPickerFor}
              referenceRef={getBatchPickerRef()}
              panelElement={panelElement}
              color={getBatchPickerColor()}
              onColorChange={handleBatchPickerColorChange}
              onColorChangeComplete={handleBatchPickerColorChangeComplete}
              onClose={() => setBatchPickerFor(null)}
              interactiveRefs={batchColorPickerInteractiveRefs}
              solidOnly={
                batchPickerFor !== "noteColor" &&
                batchPickerFor !== "glowColor"
              }
            />
          )}

          {/* 다중 선택용 ImagePicker */}
          {showBatchImagePicker && batchImageButtonRef.current && (
            <ImagePicker
              open={showBatchImagePicker}
              referenceRef={batchImageButtonRef}
              panelElement={panelElement}
              idleImage={getMixedValue((pos) => pos.inactiveImage, "").isMixed ? "" : getMixedValue((pos) => pos.inactiveImage, "").value}
              activeImage={getMixedValue((pos) => pos.activeImage, "").isMixed ? "" : getMixedValue((pos) => pos.activeImage, "").value}
              idleTransparent={getMixedValue((pos) => pos.idleTransparent, false).value}
              activeTransparent={getMixedValue((pos) => pos.activeTransparent, false).value}
              onIdleImageChange={(imageUrl: string) => {
                handleBatchStyleChangeComplete("inactiveImage", imageUrl);
              }}
              onActiveImageChange={(imageUrl: string) => {
                handleBatchStyleChangeComplete("activeImage", imageUrl);
              }}
              onIdleTransparentChange={(value: boolean) => {
                handleBatchStyleChangeComplete("idleTransparent", value);
              }}
              onActiveTransparentChange={(value: boolean) => {
                handleBatchStyleChangeComplete("activeTransparent", value);
              }}
              onIdleImageReset={() => {
                handleBatchStyleChangeComplete("inactiveImage", "");
              }}
              onActiveImageReset={() => {
                handleBatchStyleChangeComplete("activeImage", "");
              }}
              onClose={() => setShowBatchImagePicker(false)}
            />
          )}
        </>
      </div>
    );
  }

  // 플러그인 요소가 선택된 경우
  if (selectedElements.length > 0 && selectedKeyElements.length === 0) {
    return (
      <div className="absolute right-0 top-0 bottom-0 w-[220px] bg-[#1F1F24] border-l border-[#3A3943] flex flex-col z-30 shadow-lg">
        <div className="flex items-center justify-between p-[12px] border-b border-[#3A3943]">
          <span className="text-[#DBDEE8] text-style-2">
            {t("propertiesPanel.pluginElement") || "플러그인 요소"}
          </span>
          <button
            onClick={handleClose}
            className="w-[20px] h-[20px] flex items-center justify-center hover:bg-[#2A2A30] rounded-[4px] transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path
                d="M1 1L9 9M9 1L1 9"
                stroke="#6B6D75"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-[16px]">
          <p className="text-[#6B6D75] text-style-4 text-center">
            {t("propertiesPanel.pluginHint") ||
              "플러그인 요소는 플러그인 설정에서 편집할 수 있습니다."}
          </p>
        </div>
      </div>
    );
  }

  // 단일 키 선택인 경우
  if (!singleKeyPosition) {
    return null;
  }

  return (
    <div
      ref={setPanelElement}
      className="absolute right-0 top-0 bottom-0 w-[220px] bg-[#1F1F24] border-l border-[#3A3943] flex flex-col z-30 shadow-lg"
    >
      {/* 헤더 + 탭 영역 */}
      <div className="flex-shrink-0 border-b border-[#3A3943]">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-[12px] pb-[8px]">
          <span className="text-[#DBDEE8] text-style-2">
            {singleKeyInfo?.displayName || singleKeyCode || "Key"}
          </span>

          <div className="flex items-center gap-[4px]">
            {/* 레이어 모드로 전환 버튼 */}
            <button
              onClick={handleToggleMode}
              className="w-[24px] h-[24px] flex items-center justify-center hover:bg-[#2A2A30] rounded-[4px] transition-colors"
              title={t("propertiesPanel.switchToLayer") || "Switch to Layer"}
            >
              <ModeToggleIcon mode="layer" />
            </button>
            {/* 패널 닫기 버튼 */}
            <button
              onClick={handleTogglePanel}
              className="w-[24px] h-[24px] flex items-center justify-center hover:bg-[#2A2A30] rounded-[4px] transition-colors"
              title={t("propertiesPanel.closePanel") || "속성 패널 닫기"}
            >
              <SidebarToggleIcon isOpen={true} />
            </button>
          </div>
        </div>

        {/* 탭 */}
        <div className="px-[12px] pb-[12px]">
          <Tabs activeTab={activeTab} onTabChange={setActiveTab} t={t} />
        </div>
      </div>

      {/* 스크롤 가능한 속성 영역 (탭별 독립 스크롤) */}
      <div className="flex-1 properties-panel-overlay-scroll">
        {/* STYLE 탭 viewport */}
        <div
          ref={singleScrollRefFor(TABS.STYLE)}
          className={`properties-panel-overlay-viewport ${activeTab === TABS.STYLE ? "" : "hidden"}`}
        >
          <div className="p-[12px] flex flex-col gap-[12px]">
            <StyleTabContent
              keyIndex={singleKeyIndex!}
              keyPosition={singleKeyPosition}
              keyCode={singleKeyCode}
              keyInfo={singleKeyInfo}
              onPositionChange={onPositionChange}
              onKeyUpdate={onKeyUpdate}
              onKeyPreview={onKeyPreview}
              onKeyMappingChange={onKeyMappingChange}
              isListening={isListening}
              onKeyListen={handleKeyListen}
              showImagePicker={showImagePicker}
              onToggleImagePicker={() => setShowImagePicker(!showImagePicker)}
              imageButtonRef={imageButtonRef}
              panelElement={panelElement}
              useCustomCSS={useCustomCSS}
              t={t}
              localDx={localState.dx}
              localDy={localState.dy}
              localWidth={localState.width}
              localHeight={localState.height}
              onLocalDxChange={(value) =>
                setLocalState((prev) => ({ ...prev, dx: value }))
              }
              onLocalDyChange={(value) =>
                setLocalState((prev) => ({ ...prev, dy: value }))
              }
              onLocalWidthChange={(value) =>
                setLocalState((prev) => ({ ...prev, width: value }))
              }
              onLocalHeightChange={(value) =>
                setLocalState((prev) => ({ ...prev, height: value }))
              }
              onSizeBlur={handleSizeBlur}
            />
          </div>
          <div className="properties-panel-overlay-bar">
            <div
              ref={singleThumbRefFor(TABS.STYLE)}
              className="properties-panel-overlay-thumb"
              style={{ display: 'none' }}
            />
          </div>
        </div>

        {/* NOTE 탭 viewport */}
        <div
          ref={singleScrollRefFor(TABS.NOTE)}
          className={`properties-panel-overlay-viewport ${activeTab === TABS.NOTE ? "" : "hidden"}`}
        >
          <div className="p-[12px] flex flex-col gap-[12px]">
            <NoteTabContent
              keyIndex={singleKeyIndex!}
              keyPosition={singleKeyPosition}
              onKeyUpdate={onKeyUpdate}
              onKeyPreview={onKeyPreview}
              panelElement={panelElement}
              t={t}
            />
          </div>
          <div className="properties-panel-overlay-bar">
            <div
              ref={singleThumbRefFor(TABS.NOTE)}
              className="properties-panel-overlay-thumb"
              style={{ display: 'none' }}
            />
          </div>
        </div>

        {/* COUNTER 탭 viewport */}
        <div
          ref={singleScrollRefFor(TABS.COUNTER)}
          className={`properties-panel-overlay-viewport ${activeTab === TABS.COUNTER ? "" : "hidden"}`}
        >
          <div className="p-[12px] flex flex-col gap-[12px]">
            <CounterTabContent
              keyIndex={singleKeyIndex!}
              keyPosition={singleKeyPosition}
              onKeyUpdate={onKeyUpdate}
              panelElement={panelElement}
              t={t}
            />
          </div>
          <div className="properties-panel-overlay-bar">
            <div
              ref={singleThumbRefFor(TABS.COUNTER)}
              className="properties-panel-overlay-thumb"
              style={{ display: 'none' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertiesPanel;
