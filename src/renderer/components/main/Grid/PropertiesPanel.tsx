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
import { useLenis } from "@hooks/useLenis";
import { getKeyInfoByGlobalKey } from "@utils/KeyMaps";
import type {
  KeyPosition,
  NoteColor,
  KeyCounterSettings,
} from "@src/types/keys";
import {
  createDefaultCounterSettings,
  normalizeCounterSettings,
} from "@src/types/keys";
import Checkbox from "@components/main/common/Checkbox";
import Dropdown from "@components/main/common/Dropdown";
import ColorPicker from "@components/main/Modal/content/ColorPicker";

type ScrollThumbState = { top: number; height: number; visible: boolean };

// 분리된 컴포넌트들
import {
  TABS,
  TabType,
  PropertyRow,
  NumberInput,
  ColorInput,
  Tabs,
  SectionDivider,
  SidebarToggleIcon,
  FontStyleToggle,
} from "./PropertiesPanel/index";
import StyleTabContent from "./PropertiesPanel/StyleTabContent";
import NoteTabContent from "./PropertiesPanel/NoteTabContent";
import CounterTabContent from "./PropertiesPanel/CounterTabContent";

// ============================================================================
// 메인 컴포넌트 Props
// ============================================================================

interface PropertiesPanelProps {
  onPositionChange: (index: number, dx: number, dy: number) => void;
  onKeyUpdate: (data: Partial<KeyPosition> & { index: number }) => void;
  onKeyBatchUpdate?: (updates: Array<{ index: number } & Partial<KeyPosition>>) => void;
  onKeyPreview?: (index: number, updates: Partial<KeyPosition>) => void;
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
  const [isPanelVisible, setIsPanelVisible] = useState(true);

  // overlay scrollbar thumb refs (직접 DOM 조작으로 리렌더링 방지)
  const batchThumbRef = useRef<HTMLDivElement | null>(null);
  const accordionThumbRef = useRef<HTMLDivElement | null>(null);
  const singleThumbRef = useRef<HTMLDivElement | null>(null);

  const calculateThumb = useCallback((el: HTMLDivElement): ScrollThumbState => {
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

  // thumb DOM 직접 업데이트 (리렌더링 없이 성능 최적화)
  const updateThumbDOM = useCallback(
    (thumbEl: HTMLDivElement | null, scrollEl: HTMLDivElement | null) => {
      if (!thumbEl || !scrollEl) return;
      const thumb = calculateThumb(scrollEl);
      thumbEl.style.top = `${thumb.top}px`;
      thumbEl.style.height = `${thumb.height}px`;
      thumbEl.style.display = thumb.visible ? 'block' : 'none';
    },
    [calculateThumb],
  );

  // 스크롤 엘리먼트 refs (thumb 계산용)
  const batchScrollElementRef = useRef<HTMLDivElement | null>(null);
  const accordionScrollElementRef = useRef<HTMLDivElement | null>(null);
  const singleScrollElementRef = useRef<HTMLDivElement | null>(null);

  // Lenis 스크롤 적용 (직접 DOM 조작으로 thumb 업데이트)
  const {
    scrollContainerRef: batchLenisRef,
    wrapperElement: batchScrollElement,
  } = useLenis({
    onScroll: useCallback(() => {
      updateThumbDOM(batchThumbRef.current, batchScrollElementRef.current);
    }, [updateThumbDOM]),
  });

  const {
    scrollContainerRef: accordionLenisRef,
    wrapperElement: accordionScrollElement,
  } = useLenis({
    onScroll: useCallback(() => {
      updateThumbDOM(accordionThumbRef.current, accordionScrollElementRef.current);
    }, [updateThumbDOM]),
  });

  const {
    scrollContainerRef: singleLenisRef,
    wrapperElement: singleScrollElement,
  } = useLenis({
    onScroll: useCallback(() => {
      updateThumbDOM(singleThumbRef.current, singleScrollElementRef.current);
    }, [updateThumbDOM]),
  });

  // wrapperElement가 변경되면 ref 업데이트
  useEffect(() => {
    batchScrollElementRef.current = batchScrollElement;
  }, [batchScrollElement]);

  useEffect(() => {
    accordionScrollElementRef.current = accordionScrollElement;
  }, [accordionScrollElement]);

  useEffect(() => {
    singleScrollElementRef.current = singleScrollElement;
  }, [singleScrollElement]);

  // callback ref를 합성하여 Lenis와 내부 ref 모두 업데이트
  const batchScrollRef = useCallback((node: HTMLDivElement | null) => {
    batchScrollElementRef.current = node;
    batchLenisRef(node);
  }, [batchLenisRef]);

  const accordionScrollRef = useCallback((node: HTMLDivElement | null) => {
    accordionScrollElementRef.current = node;
    accordionLenisRef(node);
  }, [accordionLenisRef]);

  const singleScrollRef = useCallback((node: HTMLDivElement | null) => {
    singleScrollElementRef.current = node;
    singleLenisRef(node);
  }, [singleLenisRef]);

  const updateThumbs = useCallback(() => {
    updateThumbDOM(batchThumbRef.current, batchScrollElementRef.current);
    updateThumbDOM(accordionThumbRef.current, accordionScrollElementRef.current);
    updateThumbDOM(singleThumbRef.current, singleScrollElementRef.current);
  }, [updateThumbDOM]);

  // 탭 상태
  const [activeTab, setActiveTab] = useState<TabType>(TABS.STYLE);

  // 다중 선택 모드 상태
  const [isBatchEditMode, setIsBatchEditMode] = useState(true);
  const [expandedAccordionIndex, setExpandedAccordionIndex] = useState<
    number | null
  >(null);

  useEffect(() => {
    updateThumbs();
  }, [
    updateThumbs,
    activeTab,
    isBatchEditMode,
    expandedAccordionIndex,
    selectedElements.length,
  ]);

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

  // 선택된 키가 변경될 때만 패널 열기
  useEffect(() => {
    if (singleKeyIndex !== null) {
      setIsPanelVisible(true);
    }
    setShowImagePicker(false);
    setIsListening(false);
  }, [singleKeyIndex]);

  // 다중 선택 시 패널 자동 열기
  useEffect(() => {
    if (selectedKeyElements.length > 1) {
      setIsPanelVisible(true);
      setExpandedAccordionIndex(null);
    }
  }, [selectedKeyElements.length]);

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
    }
  }, [isPanelVisible]);

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
  // 다중 선택 일괄 편집 핸들러
  // ============================================================================

  const handleBatchStyleChange = useCallback(
    (property: keyof KeyPosition, value: any) => {
      selectedKeyElements.forEach((el) => {
        if (el.index !== undefined) {
          onKeyPreview?.(el.index, { [property]: value });
        }
      });
    },
    [selectedKeyElements, onKeyPreview],
  );

  const handleBatchStyleChangeComplete = useCallback(
    (property: keyof KeyPosition, value: any) => {
      const updates = selectedKeyElements
        .filter((el) => el.index !== undefined)
        .map((el) => ({ index: el.index!, [property]: value }));

      if (onKeyBatchUpdate && updates.length > 0) {
        onKeyBatchUpdate(updates);
      } else {
        // 폴백: 개별 업데이트
        updates.forEach((update) => onKeyUpdate(update));
      }
    },
    [selectedKeyElements, onKeyBatchUpdate, onKeyUpdate],
  );

  const handleBatchCounterUpdate = useCallback(
    (updates: Partial<KeyCounterSettings>) => {
      const batchUpdates = selectedKeyElements
        .filter((el) => el.index !== undefined)
        .map((el) => {
          const pos = positions[selectedKeyType]?.[el.index!];
          if (pos) {
            const currentSettings = normalizeCounterSettings(pos.counter);
            const newSettings = { ...currentSettings, ...updates };
            return { index: el.index!, counter: newSettings };
          }
          return null;
        })
        .filter((update): update is { index: number; counter: KeyCounterSettings } => update !== null);

      if (onKeyBatchUpdate && batchUpdates.length > 0) {
        onKeyBatchUpdate(batchUpdates);
      } else {
        // 폴백: 개별 업데이트
        batchUpdates.forEach((update) => onKeyUpdate(update));
      }
    },
    [selectedKeyElements, positions, selectedKeyType, onKeyBatchUpdate, onKeyUpdate],
  );

  const handleBatchNoteColorChange = useCallback(
    (newColor: any) => {
      let colorValue: NoteColor;
      if (
        newColor &&
        typeof newColor === "object" &&
        newColor.type === "gradient"
      ) {
        colorValue = {
          type: "gradient",
          top: newColor.top,
          bottom: newColor.bottom,
        };
      } else {
        colorValue = newColor;
      }
      selectedKeyElements.forEach((el) => {
        if (el.index !== undefined) {
          onKeyPreview?.(el.index, { noteColor: colorValue });
        }
      });
    },
    [selectedKeyElements, onKeyPreview],
  );

  const handleBatchNoteColorChangeComplete = useCallback(
    (newColor: any) => {
      let colorValue: NoteColor;
      if (
        newColor &&
        typeof newColor === "object" &&
        newColor.type === "gradient"
      ) {
        colorValue = {
          type: "gradient",
          top: newColor.top,
          bottom: newColor.bottom,
        };
      } else {
        colorValue = newColor;
      }

      const updates = selectedKeyElements
        .filter((el) => el.index !== undefined)
        .map((el) => ({ index: el.index!, noteColor: colorValue }));

      if (onKeyBatchUpdate && updates.length > 0) {
        onKeyBatchUpdate(updates);
      } else {
        updates.forEach((update) => onKeyUpdate(update));
      }
    },
    [selectedKeyElements, onKeyBatchUpdate, onKeyUpdate],
  );

  const handleBatchGlowColorChange = useCallback(
    (newColor: any) => {
      let colorValue: NoteColor;
      if (
        newColor &&
        typeof newColor === "object" &&
        newColor.type === "gradient"
      ) {
        colorValue = {
          type: "gradient",
          top: newColor.top,
          bottom: newColor.bottom,
        };
      } else {
        colorValue = newColor;
      }
      selectedKeyElements.forEach((el) => {
        if (el.index !== undefined) {
          onKeyPreview?.(el.index, { noteGlowColor: colorValue });
        }
      });
    },
    [selectedKeyElements, onKeyPreview],
  );

  const handleBatchGlowColorChangeComplete = useCallback(
    (newColor: any) => {
      let colorValue: NoteColor;
      if (
        newColor &&
        typeof newColor === "object" &&
        newColor.type === "gradient"
      ) {
        colorValue = {
          type: "gradient",
          top: newColor.top,
          bottom: newColor.bottom,
        };
      } else {
        colorValue = newColor;
      }

      const updates = selectedKeyElements
        .filter((el) => el.index !== undefined)
        .map((el) => ({ index: el.index!, noteGlowColor: colorValue }));

      if (onKeyBatchUpdate && updates.length > 0) {
        onKeyBatchUpdate(updates);
      } else {
        updates.forEach((update) => onKeyUpdate(update));
      }
    },
    [selectedKeyElements, onKeyBatchUpdate, onKeyUpdate],
  );

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

  // 선택된 키 요소가 없으면 렌더링하지 않음
  if (selectedKeyElements.length === 0) {
    return null;
  }

  // 다중 선택인 경우
  if (selectedKeyElements.length > 1) {
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

    // 혼합 값 표시 함수 (피커가 열려있을 때는 로컬 상태 사용)
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
            <button
              onClick={handleTogglePanel}
              className="w-[24px] h-[24px] flex items-center justify-center hover:bg-[#2A2A30] rounded-[4px] transition-colors"
              title={t("propertiesPanel.closePanel") || "속성 패널 닫기"}
            >
              <SidebarToggleIcon isOpen={true} />
            </button>
          </div>

          {/* 탭 */}
          <div className="px-[12px] pb-[12px]">
            <Tabs activeTab={activeTab} onTabChange={setActiveTab} t={t} />
          </div>
        </div>

        {/* 일괄 편집 모드 체크박스 */}
        <div className="px-[12px] py-[10px] border-b border-[#3A3943]">
          <label className="flex items-center gap-[8px] cursor-pointer">
            <Checkbox
              checked={isBatchEditMode}
              onChange={() => {
                setIsBatchEditMode(!isBatchEditMode);
                setExpandedAccordionIndex(null);
              }}
            />
            <span className="text-[#DBDEE8] text-style-2">
              {t("propertiesPanel.batchEditMode") || "일괄 편집 모드"}
            </span>
          </label>
        </div>

        {/* 일괄 편집 모드 */}
        {isBatchEditMode ? (
          <>
            {/* 스크롤 가능한 속성 영역 */}
            <div className="flex-1 properties-panel-overlay-scroll">
              <div
                ref={batchScrollRef}
                className="properties-panel-overlay-viewport"
              >
                <div className="p-[12px] flex flex-col gap-[12px]">
                  {/* 스타일 탭 (위치/크기 제외) */}
                  {activeTab === TABS.STYLE && (
                    <>
                      {/* 배경색 */}
                      <PropertyRow
                        label={t("propertiesPanel.backgroundColor") || "배경색"}
                      >
                        {getMixedValue((pos) => pos.backgroundColor, "#2E2E2F")
                          .isMixed ? (
                          <span className="text-[#6B6D75] text-style-4 italic">
                            Mixed
                          </span>
                        ) : null}
                        <ColorInput
                          value={
                            getMixedValue(
                              (pos) => pos.backgroundColor,
                              "#2E2E2F",
                            ).value
                          }
                          onChange={(color) =>
                            handleBatchStyleChange("backgroundColor", color)
                          }
                          onChangeComplete={(color) =>
                            handleBatchStyleChangeComplete(
                              "backgroundColor",
                              color,
                            )
                          }
                          panelElement={panelElement}
                        />
                      </PropertyRow>

                      {/* 테두리 색상 */}
                      <PropertyRow
                        label={
                          t("propertiesPanel.borderColor") || "테두리 색상"
                        }
                      >
                        {getMixedValue((pos) => pos.borderColor, "#717171")
                          .isMixed ? (
                          <span className="text-[#6B6D75] text-style-4 italic">
                            Mixed
                          </span>
                        ) : null}
                        <ColorInput
                          value={
                            getMixedValue((pos) => pos.borderColor, "#717171")
                              .value
                          }
                          onChange={(color) =>
                            handleBatchStyleChange("borderColor", color)
                          }
                          onChangeComplete={(color) =>
                            handleBatchStyleChangeComplete("borderColor", color)
                          }
                          panelElement={panelElement}
                        />
                      </PropertyRow>

                      {/* 테두리 두께 */}
                      <PropertyRow
                        label={
                          t("propertiesPanel.borderWidth") || "테두리 두께"
                        }
                      >
                        {getMixedValue((pos) => pos.borderWidth, 3).isMixed ? (
                          <span className="text-[#6B6D75] text-style-4 italic">
                            Mixed
                          </span>
                        ) : null}
                        <NumberInput
                          value={
                            getMixedValue((pos) => pos.borderWidth, 3).value
                          }
                          onChange={(value) =>
                            handleBatchStyleChangeComplete("borderWidth", value)
                          }
                          suffix="px"
                          min={0}
                          max={20}
                        />
                      </PropertyRow>

                      {/* 모서리 반경 */}
                      <PropertyRow
                        label={
                          t("propertiesPanel.borderRadius") || "모서리 반경"
                        }
                      >
                        {getMixedValue((pos) => pos.borderRadius, 10)
                          .isMixed ? (
                          <span className="text-[#6B6D75] text-style-4 italic">
                            Mixed
                          </span>
                        ) : null}
                        <NumberInput
                          value={
                            getMixedValue((pos) => pos.borderRadius, 10).value
                          }
                          onChange={(value) =>
                            handleBatchStyleChangeComplete(
                              "borderRadius",
                              value,
                            )
                          }
                          suffix="px"
                          min={0}
                          max={100}
                        />
                      </PropertyRow>

                      <SectionDivider />

                      {/* 글꼴 크기 */}
                      <PropertyRow
                        label={t("propertiesPanel.fontSize") || "글꼴 크기"}
                      >
                        {getMixedValue((pos) => pos.fontSize, 14).isMixed ? (
                          <span className="text-[#6B6D75] text-style-4 italic">
                            Mixed
                          </span>
                        ) : null}
                        <NumberInput
                          value={getMixedValue((pos) => pos.fontSize, 14).value}
                          onChange={(value) =>
                            handleBatchStyleChangeComplete("fontSize", value)
                          }
                          suffix="px"
                          min={8}
                          max={72}
                        />
                      </PropertyRow>

                      {/* 글꼴 색상 */}
                      <PropertyRow
                        label={t("propertiesPanel.fontColor") || "글꼴 색상"}
                      >
                        {getMixedValue((pos) => pos.fontColor, "#717171")
                          .isMixed ? (
                          <span className="text-[#6B6D75] text-style-4 italic">
                            Mixed
                          </span>
                        ) : null}
                        <ColorInput
                          value={
                            getMixedValue((pos) => pos.fontColor, "#717171")
                              .value
                          }
                          onChange={(color) =>
                            handleBatchStyleChange("fontColor", color)
                          }
                          onChangeComplete={(color) =>
                            handleBatchStyleChangeComplete("fontColor", color)
                          }
                          panelElement={panelElement}
                        />
                      </PropertyRow>

                      {/* 글꼴 스타일 */}
                      <PropertyRow
                        label={t("propertiesPanel.fontStyle") || "글꼴 스타일"}
                      >
                        <FontStyleToggle
                          isBold={
                            getMixedValue(
                              (pos) => (pos.fontWeight ?? 700) >= 700,
                              true,
                            ).value
                          }
                          isItalic={
                            getMixedValue((pos) => pos.fontItalic, false).value
                          }
                          isUnderline={
                            getMixedValue((pos) => pos.fontUnderline, false)
                              .value
                          }
                          isStrikethrough={
                            getMixedValue((pos) => pos.fontStrikethrough, false)
                              .value
                          }
                          onBoldChange={(value) =>
                            handleBatchStyleChangeComplete(
                              "fontWeight",
                              value ? 700 : 400,
                            )
                          }
                          onItalicChange={(value) =>
                            handleBatchStyleChangeComplete("fontItalic", value)
                          }
                          onUnderlineChange={(value) =>
                            handleBatchStyleChangeComplete(
                              "fontUnderline",
                              value,
                            )
                          }
                          onStrikethroughChange={(value) =>
                            handleBatchStyleChangeComplete(
                              "fontStrikethrough",
                              value,
                            )
                          }
                        />
                      </PropertyRow>
                    </>
                  )}

                  {/* 노트 탭 */}
                  {activeTab === TABS.NOTE && (
                    <>
                      {/* 노트 색상 */}
                      <PropertyRow
                        label={t("keySetting.noteColor") || "노트 색상"}
                      >
                        <button
                          ref={batchNoteColorButtonRef}
                          onClick={() => handleBatchPickerToggle("noteColor")}
                          className="relative w-[80px] h-[23px] bg-[#2A2A30] rounded-[7px] border-[1px] border-[#3A3943] flex items-center justify-center text-[#DBDEE8] text-style-2"
                        >
                          <div
                            className="absolute left-[6px] top-[4.5px] w-[11px] h-[11px] rounded-[2px] border border-[#3A3943]"
                            style={getBatchNoteColorDisplay().style}
                          />
                          <span
                            className={`ml-[16px] text-left text-style-4 ${getBatchNoteColorDisplay().isMixed ? "italic text-[#6B6D75]" : ""}`}
                          >
                            {getBatchNoteColorDisplay().label}
                          </span>
                        </button>
                      </PropertyRow>

                      {/* 노트 투명도 */}
                      <PropertyRow
                        label={t("keySetting.noteOpacity") || "노트 투명도"}
                      >
                        {getMixedValue((pos) => pos.noteOpacity, 80).isMixed ? (
                          <span className="text-[#6B6D75] text-style-4 italic">
                            Mixed
                          </span>
                        ) : null}
                        <NumberInput
                          value={
                            getMixedValue((pos) => pos.noteOpacity, 80).value
                          }
                          onChange={(value) =>
                            handleBatchStyleChangeComplete("noteOpacity", value)
                          }
                          suffix="%"
                          min={0}
                          max={100}
                        />
                      </PropertyRow>

                      <SectionDivider />

                      {/* 글로우 효과 */}
                      <div className="flex justify-between items-center w-full h-[23px]">
                        <p className="text-white text-style-2">
                          {t("keySetting.noteGlow") || "글로우 효과"}
                        </p>
                        <Checkbox
                          checked={
                            getMixedValue((pos) => pos.noteGlowEnabled, false)
                              .value
                          }
                          onChange={() => {
                            const currentValue = getMixedValue(
                              (pos) => pos.noteGlowEnabled,
                              false,
                            ).value;
                            handleBatchStyleChangeComplete(
                              "noteGlowEnabled",
                              !currentValue,
                            );
                          }}
                        />
                      </div>

                      {/* 글로우 색상/크기/투명도 */}
                      {getMixedValue((pos) => pos.noteGlowEnabled, false)
                        .value && (
                        <>
                          <PropertyRow
                            label={
                              t("keySetting.noteGlowColor") || "글로우 색상"
                            }
                          >
                            <button
                              ref={batchGlowColorButtonRef}
                              onClick={() =>
                                handleBatchPickerToggle("glowColor")
                              }
                              className="relative w-[80px] h-[23px] bg-[#2A2A30] rounded-[7px] border-[1px] border-[#3A3943] flex items-center justify-center text-[#DBDEE8] text-style-2"
                            >
                              <div
                                className="absolute left-[6px] top-[4.5px] w-[11px] h-[11px] rounded-[2px] border border-[#3A3943]"
                                style={getBatchGlowColorDisplay().style}
                              />
                              <span
                                className={`ml-[16px] text-left text-style-4 ${getBatchGlowColorDisplay().isMixed ? "italic text-[#6B6D75]" : ""}`}
                              >
                                {getBatchGlowColorDisplay().label}
                              </span>
                            </button>
                          </PropertyRow>

                          <PropertyRow
                            label={
                              t("keySetting.noteGlowSize") || "글로우 크기"
                            }
                          >
                            {getMixedValue((pos) => pos.noteGlowSize, 20)
                              .isMixed ? (
                              <span className="text-[#6B6D75] text-style-4 italic">
                                Mixed
                              </span>
                            ) : null}
                            <NumberInput
                              value={
                                getMixedValue((pos) => pos.noteGlowSize, 20)
                                  .value
                              }
                              onChange={(value) =>
                                handleBatchStyleChangeComplete(
                                  "noteGlowSize",
                                  value,
                                )
                              }
                              min={0}
                              max={50}
                            />
                          </PropertyRow>

                          <PropertyRow
                            label={
                              t("keySetting.noteGlowOpacity") || "글로우 투명도"
                            }
                          >
                            {getMixedValue((pos) => pos.noteGlowOpacity, 70)
                              .isMixed ? (
                              <span className="text-[#6B6D75] text-style-4 italic">
                                Mixed
                              </span>
                            ) : null}
                            <NumberInput
                              value={
                                getMixedValue((pos) => pos.noteGlowOpacity, 70)
                                  .value
                              }
                              onChange={(value) =>
                                handleBatchStyleChangeComplete(
                                  "noteGlowOpacity",
                                  value,
                                )
                              }
                              suffix="%"
                              min={0}
                              max={100}
                            />
                          </PropertyRow>
                        </>
                      )}

                      <SectionDivider />

                      {/* 노트 효과 표시 */}
                      <div className="flex justify-between items-center w-full h-[23px]">
                        <p className="text-white text-style-2">
                          {t("keySetting.noteEffectEnabled") ||
                            "노트 효과 표시"}
                        </p>
                        <Checkbox
                          checked={
                            getMixedValue((pos) => pos.noteEffectEnabled, true)
                              .value
                          }
                          onChange={() => {
                            const currentValue = getMixedValue(
                              (pos) => pos.noteEffectEnabled,
                              true,
                            ).value;
                            handleBatchStyleChangeComplete(
                              "noteEffectEnabled",
                              !currentValue,
                            );
                          }}
                        />
                      </div>

                      {/* Y축 자동 보정 */}
                      <div className="flex justify-between items-center w-full h-[23px]">
                        <p className="text-white text-style-2">
                          {t("keySetting.noteAutoYCorrection") ||
                            "Y축 자동 보정"}
                        </p>
                        <Checkbox
                          checked={
                            getMixedValue(
                              (pos) => pos.noteAutoYCorrection,
                              true,
                            ).value
                          }
                          onChange={() => {
                            const currentValue = getMixedValue(
                              (pos) => pos.noteAutoYCorrection,
                              true,
                            ).value;
                            handleBatchStyleChangeComplete(
                              "noteAutoYCorrection",
                              !currentValue,
                            );
                          }}
                        />
                      </div>
                    </>
                  )}

                  {/* 카운터 탭 */}
                  {activeTab === TABS.COUNTER && (
                    <>
                      {/* 배치 영역 */}
                      <PropertyRow
                        label={t("counterSetting.placementArea") || "배치 영역"}
                      >
                        <Dropdown
                          options={[
                            {
                              label:
                                t("counterSetting.placementInside") || "내부",
                              value: "inside",
                            },
                            {
                              label:
                                t("counterSetting.placementOutside") || "외부",
                              value: "outside",
                            },
                          ]}
                          value={batchCounterSettings.placement}
                          onChange={(value) =>
                            handleBatchCounterUpdate({
                              placement: value as "inside" | "outside",
                            })
                          }
                        />
                      </PropertyRow>

                      {/* 정렬 방향 */}
                      <PropertyRow
                        label={
                          t("counterSetting.alignDirection") || "정렬 방향"
                        }
                      >
                        <Dropdown
                          options={[
                            {
                              label: t("counterSetting.alignTop") || "상단",
                              value: "top",
                            },
                            {
                              label: t("counterSetting.alignBottom") || "하단",
                              value: "bottom",
                            },
                            {
                              label: t("counterSetting.alignLeft") || "좌측",
                              value: "left",
                            },
                            {
                              label: t("counterSetting.alignRight") || "우측",
                              value: "right",
                            },
                          ]}
                          value={batchCounterSettings.align}
                          onChange={(value) =>
                            handleBatchCounterUpdate({
                              align: value as
                                | "top"
                                | "bottom"
                                | "left"
                                | "right",
                            })
                          }
                        />
                      </PropertyRow>

                      {/* 간격 */}
                      <PropertyRow label={t("counterSetting.gap") || "간격"}>
                        <NumberInput
                          value={batchCounterSettings.gap}
                          onChange={(value) =>
                            handleBatchCounterUpdate({ gap: value })
                          }
                          suffix="px"
                          min={0}
                          max={100}
                        />
                      </PropertyRow>

                      <SectionDivider />

                      {/* 채우기 색상 */}
                      <PropertyRow label={t("counterSetting.fill") || "채우기"}>
                        <div className="flex items-center gap-[4px]">
                          <button
                            ref={batchCounterFillIdleButtonRef}
                            onClick={() => handleBatchPickerToggle("fillIdle")}
                            className="relative px-[7px] h-[23px] bg-[#2A2A30] rounded-[7px] border-[1px] border-[#3A3943] flex items-center justify-center text-[#DBDEE8] text-style-4"
                          >
                            <div
                              className="absolute left-[6px] top-[4.5px] w-[11px] h-[11px] rounded-[2px] border border-[#3A3943]"
                              style={{
                                backgroundColor:
                                  getCounterColorDisplay("fillIdle"),
                              }}
                            />
                            <span className="ml-[16px] text-left">
                              {t("counterSetting.idle") || "대기"}
                            </span>
                          </button>
                          <button
                            ref={batchCounterFillActiveButtonRef}
                            onClick={() =>
                              handleBatchPickerToggle("fillActive")
                            }
                            className="relative px-[7px] h-[23px] bg-[#2A2A30] rounded-[7px] border-[1px] border-[#3A3943] flex items-center justify-center text-[#DBDEE8] text-style-4"
                          >
                            <div
                              className="absolute left-[6px] top-[4.5px] w-[11px] h-[11px] rounded-[2px] border border-[#3A3943]"
                              style={{
                                backgroundColor:
                                  getCounterColorDisplay("fillActive"),
                              }}
                            />
                            <span className="ml-[16px] text-left">
                              {t("counterSetting.active") || "입력"}
                            </span>
                          </button>
                        </div>
                      </PropertyRow>

                      {/* 외곽선 색상 */}
                      <PropertyRow
                        label={t("counterSetting.stroke") || "외곽선"}
                      >
                        <div className="flex items-center gap-[4px]">
                          <button
                            ref={batchCounterStrokeIdleButtonRef}
                            onClick={() =>
                              handleBatchPickerToggle("strokeIdle")
                            }
                            className="relative px-[7px] h-[23px] bg-[#2A2A30] rounded-[7px] border-[1px] border-[#3A3943] flex items-center justify-center text-[#DBDEE8] text-style-4"
                          >
                            <div
                              className="absolute left-[6px] top-[4.5px] w-[11px] h-[11px] rounded-[2px] border border-[#3A3943]"
                              style={{
                                backgroundColor:
                                  getCounterColorDisplay("strokeIdle"),
                              }}
                            />
                            <span className="ml-[16px] text-left">
                              {t("counterSetting.idle") || "대기"}
                            </span>
                          </button>
                          <button
                            ref={batchCounterStrokeActiveButtonRef}
                            onClick={() =>
                              handleBatchPickerToggle("strokeActive")
                            }
                            className="relative px-[7px] h-[23px] bg-[#2A2A30] rounded-[7px] border-[1px] border-[#3A3943] flex items-center justify-center text-[#DBDEE8] text-style-4"
                          >
                            <div
                              className="absolute left-[6px] top-[4.5px] w-[11px] h-[11px] rounded-[2px] border border-[#3A3943]"
                              style={{
                                backgroundColor:
                                  getCounterColorDisplay("strokeActive"),
                              }}
                            />
                            <span className="ml-[16px] text-left">
                              {t("counterSetting.active") || "입력"}
                            </span>
                          </button>
                        </div>
                      </PropertyRow>

                      <SectionDivider />

                      {/* 카운터 사용 */}
                      <div className="flex justify-between items-center w-full h-[23px]">
                        <p className="text-white text-style-2">
                          {t("counterSetting.counterEnabled") || "카운터 표시"}
                        </p>
                        <Checkbox
                          checked={batchCounterSettings.enabled}
                          onChange={() =>
                            handleBatchCounterUpdate({
                              enabled: !batchCounterSettings.enabled,
                            })
                          }
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* 배치 편집용 로컬 ColorPicker */}
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
              </div>
              <div className="properties-panel-overlay-bar">
                <div
                  ref={batchThumbRef}
                  className="properties-panel-overlay-thumb"
                  style={{ display: 'none' }}
                />
              </div>
            </div>
          </>
        ) : (
          /* 개별 편집 모드 - 아코디언 */
          <div className="flex-1 properties-panel-overlay-scroll">
            <div
              ref={accordionScrollRef}
              className="properties-panel-overlay-viewport"
            >
              <div className="flex flex-col">
                {getSelectedKeysData().map((keyData, idx) => {
                  const isExpanded = expandedAccordionIndex === idx;
                  const keyName =
                    keyData.keyInfo?.displayName ||
                    keyData.keyCode ||
                    `Key ${idx + 1}`;

                  return (
                    <div
                      key={keyData.index}
                      className="border-b border-[#3A3943]"
                    >
                      {/* 아코디언 헤더 */}
                      <button
                        onClick={() =>
                          setExpandedAccordionIndex(isExpanded ? null : idx)
                        }
                        className="w-full p-[12px] flex items-center justify-between hover:bg-[#2A2A30] transition-colors"
                      >
                        <span className="text-[#DBDEE8] text-style-2">
                          {keyName}
                        </span>
                        <svg
                          width="10"
                          height="6"
                          viewBox="0 0 10 6"
                          fill="none"
                          className={`transform transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        >
                          <path
                            d="M1 1L5 5L9 1"
                            stroke="#6B6D75"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>

                      {/* 아코디언 콘텐츠 - 분리된 컴포넌트 사용 */}
                      {isExpanded && keyData.position && (
                        <div className="p-[12px] pt-0 flex flex-col gap-[12px]">
                          {activeTab === TABS.STYLE && (
                            <StyleTabContent
                              keyIndex={keyData.index}
                              keyPosition={keyData.position}
                              keyCode={keyData.keyCode}
                              keyInfo={keyData.keyInfo}
                              onPositionChange={onPositionChange}
                              onKeyUpdate={onKeyUpdate}
                              onKeyPreview={onKeyPreview}
                              onKeyMappingChange={onKeyMappingChange}
                              panelElement={panelElement}
                              useCustomCSS={useCustomCSS}
                              t={t}
                            />
                          )}
                          {activeTab === TABS.NOTE && (
                            <NoteTabContent
                              keyIndex={keyData.index}
                              keyPosition={keyData.position}
                              onKeyUpdate={onKeyUpdate}
                              onKeyPreview={onKeyPreview}
                              panelElement={panelElement}
                              t={t}
                            />
                          )}
                          {activeTab === TABS.COUNTER && (
                            <CounterTabContent
                              keyIndex={keyData.index}
                              keyPosition={keyData.position}
                              onKeyUpdate={onKeyUpdate}
                              panelElement={panelElement}
                              t={t}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="properties-panel-overlay-bar">
              <div
                ref={accordionThumbRef}
                className="properties-panel-overlay-thumb"
                style={{ display: 'none' }}
              />
            </div>
          </div>
        )}
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

          <button
            onClick={handleTogglePanel}
            className="w-[24px] h-[24px] flex items-center justify-center hover:bg-[#2A2A30] rounded-[4px] transition-colors"
            title={t("propertiesPanel.closePanel") || "속성 패널 닫기"}
          >
            <SidebarToggleIcon isOpen={true} />
          </button>
        </div>

        {/* 탭 */}
        <div className="px-[12px] pb-[12px]">
          <Tabs activeTab={activeTab} onTabChange={setActiveTab} t={t} />
        </div>
      </div>

      {/* 스크롤 가능한 속성 영역 */}
      <div className="flex-1 properties-panel-overlay-scroll">
        <div
          ref={singleScrollRef}
          className="properties-panel-overlay-viewport"
        >
          <div className="p-[12px] flex flex-col gap-[12px]">
            {/* 스타일 탭 - 분리된 컴포넌트 사용 */}
            {activeTab === TABS.STYLE && (
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
                // 로컬 상태 (단일 선택 시에만 사용)
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
            )}

            {/* 노트 탭 - 분리된 컴포넌트 사용 */}
            {activeTab === TABS.NOTE && (
              <NoteTabContent
                keyIndex={singleKeyIndex!}
                keyPosition={singleKeyPosition}
                onKeyUpdate={onKeyUpdate}
                onKeyPreview={onKeyPreview}
                panelElement={panelElement}
                t={t}
              />
            )}

            {/* 카운터 탭 - 분리된 컴포넌트 사용 */}
            {activeTab === TABS.COUNTER && (
              <CounterTabContent
                keyIndex={singleKeyIndex!}
                keyPosition={singleKeyPosition}
                onKeyUpdate={onKeyUpdate}
                panelElement={panelElement}
                t={t}
              />
            )}
          </div>
        </div>
        <div className="properties-panel-overlay-bar">
          <div
            ref={singleThumbRef}
            className="properties-panel-overlay-thumb"
            style={{ display: 'none' }}
          />
        </div>
      </div>
    </div>
  );
};

export default PropertiesPanel;
