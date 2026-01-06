import React, { useCallback, useEffect, useState, useRef } from "react";
import { useTranslation } from "@contexts/I18nContext";
import { useGridSelectionStore } from "@stores/useGridSelectionStore";
import { useKeyStore } from "@stores/useKeyStore";
import { useSettingsStore } from "@stores/useSettingsStore";
import { getKeyInfoByGlobalKey } from "@utils/KeyMaps";
import type { KeyPosition, ImageFit } from "@src/types/keys";
import ImagePicker from "../Modal/content/ImagePicker";

// ============================================================================
// 타입 정의
// ============================================================================

interface PropertiesPanelProps {
  onPositionChange: (index: number, dx: number, dy: number) => void;
  onKeyUpdate: (data: Partial<KeyPosition> & { index: number }) => void;
  onKeyPreview?: (index: number, updates: Partial<KeyPosition>) => void;
  onKeyMappingChange?: (index: number, newKey: string) => void;
}

interface PropertyRowProps {
  label: string;
  children: React.ReactNode;
}

interface NumberInputProps {
  value: number | string;
  onChange: (value: number) => void;
  onBlur?: () => void;
  min?: number;
  max?: number;
  prefix?: string;
  suffix?: string;
  step?: number;
  width?: string;
}

interface ColorInputProps {
  value: string;
  onChange: (value: string) => void;
  onChangeComplete?: (value: string) => void;
}

interface SelectInputProps {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  width?: string;
}

// ============================================================================
// 공통 컴포넌트 - KeyTabContent 스타일 참고
// ============================================================================

const PropertyRow: React.FC<PropertyRowProps> = ({ label, children }) => (
  <div className="flex justify-between items-center w-full">
    <p className="text-white text-style-2">{label}</p>
    <div className="flex items-center gap-[10.5px]">{children}</div>
  </div>
);

const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  onBlur,
  min = 0,
  max = 9999,
  prefix,
  suffix,
  step = 1,
  width = "54px",
}) => {
  const [localValue, setLocalValue] = useState<string>(String(value));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(String(value));
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    
    if (newValue !== "" && !isNaN(Number(newValue))) {
      const numValue = Number(newValue);
      const clamped = Math.min(Math.max(numValue, min), max);
      onChange(clamped);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (localValue === "" || isNaN(Number(localValue))) {
      setLocalValue(String(value));
    } else {
      const numValue = Number(localValue);
      const clamped = Math.min(Math.max(numValue, min), max);
      setLocalValue(String(clamped));
      onChange(clamped);
    }
    onBlur?.();
  };

  return (
    <div
      className={`relative h-[23px] bg-[#2A2A30] rounded-[7px] border-[1px] ${
        isFocused ? "border-[#459BF8]" : "border-[#3A3943]"
      }`}
      style={{ width }}
    >
      {prefix && (
        <span className="absolute left-[5px] top-[50%] transform -translate-y-1/2 text-[#97999E] text-style-1 pointer-events-none">
          {prefix}
        </span>
      )}
      <input
        type="number"
        value={localValue}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
        step={step}
        className={`absolute ${prefix ? "left-[20px]" : "left-[5px]"} top-[-1px] h-[23px] ${
          prefix ? "w-[26px]" : suffix ? "w-[calc(100%-30px)]" : "w-[calc(100%-10px)]"
        } bg-transparent text-style-4 text-[#DBDEE8] text-left [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
      />
      {suffix && (
        <span className="absolute right-[5px] top-[50%] transform -translate-y-1/2 text-[#97999E] text-style-1 pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
};

const TextInput: React.FC<TextInputProps> = ({
  value,
  onChange,
  onBlur,
  placeholder,
  width = "90px",
}) => {
  const [localValue, setLocalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(value);
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
    onChange(e.target.value);
  };

  const handleBlur = () => {
    setIsFocused(false);
    onBlur?.();
  };

  return (
    <input
      type="text"
      value={localValue}
      onChange={handleChange}
      onFocus={() => setIsFocused(true)}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={`text-center h-[23px] p-[6px] bg-[#2A2A30] rounded-[7px] border-[1px] ${
        isFocused ? "border-[#459BF8]" : "border-[#3A3943]"
      } text-style-4 text-[#DBDEE8]`}
      style={{ width }}
    />
  );
};

const ColorInput: React.FC<ColorInputProps> = ({ value, onChange, onChangeComplete }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClick = () => {
    // 글로벌 컬러 픽커 사용
    if (typeof (window as any).__dmn_showColorPicker === "function") {
      (window as any).__dmn_showColorPicker({
        initialColor: value || "#FFFFFF",
        onColorChange: onChange,
        onColorChangeComplete: onChangeComplete,
        referenceElement: buttonRef.current,
        id: `props-panel-color-${Date.now()}`,
      });
    }
  };

  // 색상 값에서 투명도 제거하고 hex로 변환
  const getDisplayColor = (color: string): string => {
    if (!color) return "#ffffff";
    if (color.startsWith("rgba") || color.startsWith("rgb")) {
      const match = color.match(/\d+/g);
      if (match && match.length >= 3) {
        const r = parseInt(match[0]).toString(16).padStart(2, "0");
        const g = parseInt(match[1]).toString(16).padStart(2, "0");
        const b = parseInt(match[2]).toString(16).padStart(2, "0");
        return `#${r}${g}${b}`;
      }
    }
    if (color.startsWith("#")) {
      return color.slice(0, 7);
    }
    return "#ffffff";
  };

  return (
    <button
      ref={buttonRef}
      onClick={handleClick}
      className="w-[23px] h-[23px] rounded-[7px] border-[1px] border-[#3A3943] overflow-hidden cursor-pointer hover:border-[#505058] transition-colors flex-shrink-0"
      style={{ backgroundColor: getDisplayColor(value) }}
    />
  );
};

const SelectInput: React.FC<SelectInputProps> = ({ value, options, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`h-[23px] min-w-[70px] bg-[#2A2A30] rounded-[7px] border-[1px] ${
          isOpen ? "border-[#459BF8]" : "border-[#3A3943]"
        } px-[8px] flex items-center justify-between gap-[4px] hover:border-[#505058] transition-colors`}
      >
        <span className="text-style-4 text-[#DBDEE8]">
          {options.find((opt) => opt.value === value)?.label || value}
        </span>
        <svg width="8" height="5" viewBox="0 0 8 5" fill="none" className="flex-shrink-0">
          <path d="M1 1L4 4L7 1" stroke="#6B6D75" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-[27px] left-0 right-0 bg-[#2A2A30] border border-[#3A3943] rounded-[7px] z-20 overflow-hidden shadow-lg min-w-[70px]">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full px-[8px] py-[6px] text-left text-style-4 hover:bg-[#32323A] transition-colors ${
                  value === opt.value ? "text-[#459BF8]" : "text-[#DBDEE8]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange }) => {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-[32px] h-[18px] rounded-full transition-colors relative flex-shrink-0 ${
        checked ? "bg-[#459BF8]" : "bg-[#3A3943]"
      }`}
    >
      <div
        className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform ${
          checked ? "translate-x-[16px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  );
};

const SectionDivider: React.FC = () => (
  <div className="w-full h-[1px] bg-[#3A3943] my-[15px]" />
);

// ============================================================================
// 아이콘 컴포넌트
// ============================================================================

const CloseIcon: React.FC = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <path d="M1 1L9 9M9 1L1 9" stroke="#6B6D75" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

/**
 * 사이드바 토글 아이콘
 * isOpen 상태에 따라 분할 영역 비율이 달라짐
 * - 열린 상태: 오른쪽 영역이 넓음 (패널이 보이는 상태)
 * - 닫힌 상태: 오른쪽 영역이 좁음 (패널이 숨겨진 상태)
 */
const SidebarToggleIcon: React.FC<{ isOpen: boolean }> = ({ isOpen }) => (
  <svg width="16" height="14" viewBox="0 0 16 14" fill="none">
    {/* 외곽 사각형 */}
    <rect
      x="0.75"
      y="0.75"
      width="14.5"
      height="12.5"
      rx="2"
      stroke="#6B6D75"
      strokeWidth="1.5"
      fill="none"
    />
    {/* 분할선 - 열린 상태면 왼쪽에, 닫힌 상태면 오른쪽에 */}
    <line
      x1={isOpen ? "10" : "12"}
      y1="1"
      x2={isOpen ? "10" : "12"}
      y2="13"
      stroke="#6B6D75"
      strokeWidth="1.5"
    />
    {/* 오른쪽 패널 영역 표시 (열린 상태에서만) */}
    {isOpen && (
      <>
        <line x1="12" y1="4" x2="13.5" y2="4" stroke="#6B6D75" strokeWidth="1" strokeLinecap="round" />
        <line x1="12" y1="7" x2="13.5" y2="7" stroke="#6B6D75" strokeWidth="1" strokeLinecap="round" />
        <line x1="12" y1="10" x2="13.5" y2="10" stroke="#6B6D75" strokeWidth="1" strokeLinecap="round" />
      </>
    )}
  </svg>
);

// ============================================================================
// 메인 컴포넌트
// ============================================================================

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  onPositionChange,
  onKeyUpdate,
  onKeyPreview,
  onKeyMappingChange,
}) => {
  const { t } = useTranslation();
  const selectedElements = useGridSelectionStore((state) => state.selectedElements);
  const clearSelection = useGridSelectionStore((state) => state.clearSelection);
  const selectedKeyType = useKeyStore((state) => state.selectedKeyType);
  const positions = useKeyStore((state) => state.positions);
  const keyMappings = useKeyStore((state) => state.keyMappings);
  const { useCustomCSS } = useSettingsStore();

  // 선택된 키 요소 필터링
  const selectedKeyElements = selectedElements.filter((el) => el.type === "key");
  
  // 단일 키 선택인 경우의 데이터
  const singleKeyIndex = selectedKeyElements.length === 1 ? selectedKeyElements[0].index : null;
  const singleKeyPosition = singleKeyIndex !== null 
    ? positions[selectedKeyType]?.[singleKeyIndex] 
    : null;
  const singleKeyCode = singleKeyIndex !== null
    ? keyMappings[selectedKeyType]?.[singleKeyIndex]
    : null;
  const singleKeyInfo = singleKeyCode ? getKeyInfoByGlobalKey(singleKeyCode) : null;

  // 로컬 상태 (실시간 편집용)
  const [localState, setLocalState] = useState<Partial<KeyPosition> & { dx?: number; dy?: number }>({});
  
  // 키 리스닝 상태
  const [isListening, setIsListening] = useState(false);
  const justAssignedRef = useRef(false);
  
  // 이미지 픽커 상태
  const [showImagePicker, setShowImagePicker] = useState(false);
  const imageButtonRef = useRef<HTMLButtonElement>(null);

  // 패널 가시성 상태 (선택과 별개로 패널만 닫을 수 있음)
  const [isPanelVisible, setIsPanelVisible] = useState(true);

  // 선택이 변경되면 로컬 상태 초기화
  // 참고: 패널 가시성은 singleKeyIndex 변경 시에만 처리 (드래그/리사이즈로 인한 위치/크기 변경 시에는 유지)
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
  }, [singleKeyPosition?.dx, singleKeyPosition?.dy, singleKeyPosition?.width, singleKeyPosition?.height]);

  // 선택된 키가 변경될 때만 패널 열기 (드래그/리사이즈 시에는 유지)
  useEffect(() => {
    if (singleKeyIndex !== null) {
      // 새로운 단일 키 선택 시 패널 자동 열기
      setIsPanelVisible(true);
    }
    // 선택 변경 시 이미지 픽커 닫기
    setShowImagePicker(false);
    setIsListening(false);
  }, [singleKeyIndex]);

  // 다중 선택 시 패널 기본 닫기
  useEffect(() => {
    if (selectedKeyElements.length > 1) {
      setIsPanelVisible(false);
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
      
      // 키 매핑 변경
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

  // 패널 토글 핸들러 (선택 유지, 패널만 열기/닫기)
  const handleTogglePanel = useCallback(() => {
    setIsPanelVisible((prev) => !prev);
    // 패널 닫을 때 이미지 픽커도 닫기
    if (isPanelVisible) {
      setShowImagePicker(false);
    }
  }, [isPanelVisible]);

  // 선택 해제 핸들러 (다중 선택/플러그인 요소용)
  const handleClose = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  // 키 리스닝 시작
  const handleKeyListen = useCallback(() => {
    if (justAssignedRef.current) return;
    setIsListening(true);
  }, []);

  // 위치 변경 핸들러
  const handlePositionXChange = useCallback(
    (value: number) => {
      if (singleKeyIndex === null) return;
      setLocalState((prev) => ({ ...prev, dx: value }));
      onPositionChange(singleKeyIndex, value, localState.dy ?? singleKeyPosition?.dy ?? 0);
    },
    [singleKeyIndex, localState.dy, singleKeyPosition?.dy, onPositionChange]
  );

  const handlePositionYChange = useCallback(
    (value: number) => {
      if (singleKeyIndex === null) return;
      setLocalState((prev) => ({ ...prev, dy: value }));
      onPositionChange(singleKeyIndex, localState.dx ?? singleKeyPosition?.dx ?? 0, value);
    },
    [singleKeyIndex, localState.dx, singleKeyPosition?.dx, onPositionChange]
  );

  // 크기 변경 핸들러
  const handleWidthChange = useCallback(
    (value: number) => {
      if (singleKeyIndex === null) return;
      setLocalState((prev) => ({ ...prev, width: value }));
      onKeyPreview?.(singleKeyIndex, { width: value });
    },
    [singleKeyIndex, onKeyPreview]
  );

  const handleHeightChange = useCallback(
    (value: number) => {
      if (singleKeyIndex === null) return;
      setLocalState((prev) => ({ ...prev, height: value }));
      onKeyPreview?.(singleKeyIndex, { height: value });
    },
    [singleKeyIndex, onKeyPreview]
  );

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

  // 스타일 속성 변경 핸들러
  const handleStyleChange = useCallback(
    (property: keyof KeyPosition, value: any) => {
      if (singleKeyIndex === null) return;
      onKeyPreview?.(singleKeyIndex, { [property]: value });
    },
    [singleKeyIndex, onKeyPreview]
  );

  const handleStyleChangeComplete = useCallback(
    (property: keyof KeyPosition, value: any) => {
      if (singleKeyIndex === null) return;
      onKeyUpdate({ index: singleKeyIndex, [property]: value });
    },
    [singleKeyIndex, onKeyUpdate]
  );

  // 이미지 변경 핸들러
  const handleIdleImageChange = useCallback(
    (imageUrl: string) => {
      if (singleKeyIndex === null) return;
      onKeyPreview?.(singleKeyIndex, { inactiveImage: imageUrl });
      onKeyUpdate({ index: singleKeyIndex, inactiveImage: imageUrl });
    },
    [singleKeyIndex, onKeyPreview, onKeyUpdate]
  );

  const handleActiveImageChange = useCallback(
    (imageUrl: string) => {
      if (singleKeyIndex === null) return;
      onKeyPreview?.(singleKeyIndex, { activeImage: imageUrl });
      onKeyUpdate({ index: singleKeyIndex, activeImage: imageUrl });
    },
    [singleKeyIndex, onKeyPreview, onKeyUpdate]
  );

  const handleIdleTransparentChange = useCallback(
    (checked: boolean) => {
      if (singleKeyIndex === null) return;
      onKeyPreview?.(singleKeyIndex, { idleTransparent: checked });
      onKeyUpdate({ index: singleKeyIndex, idleTransparent: checked });
    },
    [singleKeyIndex, onKeyPreview, onKeyUpdate]
  );

  const handleActiveTransparentChange = useCallback(
    (checked: boolean) => {
      if (singleKeyIndex === null) return;
      onKeyPreview?.(singleKeyIndex, { activeTransparent: checked });
      onKeyUpdate({ index: singleKeyIndex, activeTransparent: checked });
    },
    [singleKeyIndex, onKeyPreview, onKeyUpdate]
  );

  const handleIdleImageReset = useCallback(() => {
    if (singleKeyIndex === null) return;
    onKeyPreview?.(singleKeyIndex, { inactiveImage: "" });
    onKeyUpdate({ index: singleKeyIndex, inactiveImage: "" });
  }, [singleKeyIndex, onKeyPreview, onKeyUpdate]);

  const handleActiveImageReset = useCallback(() => {
    if (singleKeyIndex === null) return;
    onKeyPreview?.(singleKeyIndex, { activeImage: "" });
    onKeyUpdate({ index: singleKeyIndex, activeImage: "" });
  }, [singleKeyIndex, onKeyPreview, onKeyUpdate]);

  // 클래스명 변경 핸들러
  const handleClassNameChange = useCallback(
    (value: string) => {
      if (singleKeyIndex === null) return;
      onKeyPreview?.(singleKeyIndex, { className: value });
    },
    [singleKeyIndex, onKeyPreview]
  );

  const handleClassNameBlur = useCallback(() => {
    if (singleKeyIndex === null || !singleKeyPosition) return;
    onKeyUpdate({ index: singleKeyIndex, className: singleKeyPosition.className || "" });
  }, [singleKeyIndex, singleKeyPosition, onKeyUpdate]);

  // 표시 텍스트 변경 핸들러
  const handleDisplayTextChange = useCallback(
    (value: string) => {
      if (singleKeyIndex === null) return;
      onKeyPreview?.(singleKeyIndex, { displayText: value });
    },
    [singleKeyIndex, onKeyPreview]
  );

  const handleDisplayTextBlur = useCallback(() => {
    if (singleKeyIndex === null || !singleKeyPosition) return;
    onKeyUpdate({ index: singleKeyIndex, displayText: singleKeyPosition.displayText || "" });
  }, [singleKeyIndex, singleKeyPosition, onKeyUpdate]);

  // 선택된 키 요소가 없으면 렌더링하지 않음 (조건부 렌더링)
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

    return (
      <div className="absolute right-0 top-0 bottom-0 w-[220px] bg-[#1F1F24] border-l border-[#3A3943] flex flex-col z-30 shadow-lg">
        <div className="flex items-center justify-between p-[12px] border-b border-[#3A3943]">
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
        <div className="flex-1 flex items-center justify-center p-[16px]">
          <p className="text-[#6B6D75] text-style-4 text-center">
            {t("propertiesPanel.multiSelectionHint") || "다중 선택 시 개별 속성 편집이 제한됩니다."}
          </p>
        </div>
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
            <CloseIcon />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-[16px]">
          <p className="text-[#6B6D75] text-style-4 text-center">
            {t("propertiesPanel.pluginHint") || "플러그인 요소는 플러그인 설정에서 편집할 수 있습니다."}
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
    <>
      <div className="absolute right-0 top-0 bottom-0 w-[220px] bg-[#1F1F24] border-l border-[#3A3943] flex flex-col z-30 shadow-lg">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-[12px] border-b border-[#3A3943] flex-shrink-0">
          <div className="flex items-center gap-[8px]">
            <div className="w-[23px] h-[23px] bg-[#2A2A30] rounded-[7px] border-[1px] border-[#3A3943] flex items-center justify-center">
              <span className="text-[#DBDEE8] text-[10px] font-bold">
                {singleKeyInfo?.displayName?.slice(0, 2) || "K"}
              </span>
            </div>
            <div className="flex items-center gap-[4px]">
              <span className="text-[#DBDEE8] text-style-2">
                {t("propertiesPanel.key") || "키"}
              </span>
              <span className="text-[#6B6D75] text-style-4">
                [{singleKeyInfo?.displayName || singleKeyCode || "?"}]
              </span>
            </div>
          </div>
          <button
            onClick={handleTogglePanel}
            className="w-[24px] h-[24px] flex items-center justify-center hover:bg-[#2A2A30] rounded-[4px] transition-colors"
            title={t("propertiesPanel.closePanel") || "속성 패널 닫기"}
          >
            <SidebarToggleIcon isOpen={true} />
          </button>
        </div>

        {/* 스크롤 가능한 속성 영역 - modal-content-scroll 스타일 적용 */}
        <div className="flex-1 overflow-y-auto modal-content-scroll">
          <div className="p-[12px] flex flex-col gap-[12px]">
            
            {/* 키 매핑 */}
            <PropertyRow label={t("propertiesPanel.keyMapping") || "키 매핑"}>
              <button
                onClick={handleKeyListen}
                className={`flex items-center justify-center h-[23px] min-w-[0px] px-[8.5px] bg-[#2A2A30] rounded-[7px] border-[1px] ${
                  isListening ? "border-[#459BF8]" : "border-[#3A3943]"
                } text-[#DBDEE8] text-style-2`}
              >
                {isListening
                  ? t("propertiesPanel.pressAnyKey") || "Press any key"
                  : singleKeyInfo?.displayName || t("propertiesPanel.clickToSet") || "Click to set"}
              </button>
            </PropertyRow>

            {/* 표시 텍스트 */}
            <PropertyRow label={t("propertiesPanel.displayText") || "표시 텍스트"}>
              <TextInput
                value={singleKeyPosition.displayText || ""}
                onChange={handleDisplayTextChange}
                onBlur={handleDisplayTextBlur}
                placeholder={singleKeyInfo?.displayName || t("propertiesPanel.displayTextPlaceholder") || "Custom text"}
                width="90px"
              />
            </PropertyRow>

            <SectionDivider />
            
            {/* 위치 */}
            <PropertyRow label={t("propertiesPanel.position") || "위치"}>
              <NumberInput
                value={localState.dx ?? singleKeyPosition.dx}
                onChange={handlePositionXChange}
                prefix="X"
                min={-9999}
                max={9999}
              />
              <NumberInput
                value={localState.dy ?? singleKeyPosition.dy}
                onChange={handlePositionYChange}
                prefix="Y"
                min={-9999}
                max={9999}
              />
            </PropertyRow>

            {/* 크기 */}
            <PropertyRow label={t("propertiesPanel.size") || "크기"}>
              <NumberInput
                value={localState.width ?? singleKeyPosition.width ?? 60}
                onChange={handleWidthChange}
                onBlur={handleSizeBlur}
                prefix="W"
                min={1}
                max={999}
              />
              <NumberInput
                value={localState.height ?? singleKeyPosition.height ?? 60}
                onChange={handleHeightChange}
                onBlur={handleSizeBlur}
                prefix="H"
                min={1}
                max={999}
              />
            </PropertyRow>

            <SectionDivider />

            {/* 커스텀 이미지 */}
            <PropertyRow label={t("propertiesPanel.customImage") || "커스텀 이미지"}>
              <button
                ref={imageButtonRef}
                type="button"
                className={`px-[7px] h-[23px] bg-[#2A2A30] rounded-[7px] border-[1px] flex items-center justify-center ${
                  showImagePicker ? "border-[#459BF8]" : "border-[#3A3943]"
                } text-[#DBDEE8] text-style-4`}
                onClick={() => setShowImagePicker(!showImagePicker)}
              >
                {t("propertiesPanel.configure") || "설정하기"}
              </button>
            </PropertyRow>

            <SectionDivider />

            {/* 배경색 */}
            <PropertyRow label={t("propertiesPanel.backgroundColor") || "배경색"}>
              <ColorInput
                value={singleKeyPosition.backgroundColor || "#2E2E2F"}
                onChange={(color) => handleStyleChange("backgroundColor", color)}
                onChangeComplete={(color) => handleStyleChangeComplete("backgroundColor", color)}
              />
            </PropertyRow>

            {/* 테두리 색상 */}
            <PropertyRow label={t("propertiesPanel.borderColor") || "테두리 색상"}>
              <ColorInput
                value={singleKeyPosition.borderColor || "#717171"}
                onChange={(color) => handleStyleChange("borderColor", color)}
                onChangeComplete={(color) => handleStyleChangeComplete("borderColor", color)}
              />
            </PropertyRow>

            {/* 테두리 두께 */}
            <PropertyRow label={t("propertiesPanel.borderWidth") || "테두리 두께"}>
              <NumberInput
                value={singleKeyPosition.borderWidth ?? 3}
                onChange={(value) => handleStyleChangeComplete("borderWidth", value)}
                suffix="px"
                min={0}
                max={20}
                width="60px"
              />
            </PropertyRow>

            {/* 모서리 반경 */}
            <PropertyRow label={t("propertiesPanel.borderRadius") || "모서리 반경"}>
              <NumberInput
                value={singleKeyPosition.borderRadius ?? 10}
                onChange={(value) => handleStyleChangeComplete("borderRadius", value)}
                suffix="px"
                min={0}
                max={100}
                width="60px"
              />
            </PropertyRow>

            <SectionDivider />

            {/* 글꼴 크기 */}
            <PropertyRow label={t("propertiesPanel.fontSize") || "글꼴 크기"}>
              <NumberInput
                value={singleKeyPosition.fontSize ?? 14}
                onChange={(value) => handleStyleChangeComplete("fontSize", value)}
                suffix="px"
                min={8}
                max={72}
                width="60px"
              />
            </PropertyRow>

            {/* 글꼴 색상 */}
            <PropertyRow label={t("propertiesPanel.fontColor") || "글꼴 색상"}>
              <ColorInput
                value={singleKeyPosition.fontColor || "#717171"}
                onChange={(color) => handleStyleChange("fontColor", color)}
                onChangeComplete={(color) => handleStyleChangeComplete("fontColor", color)}
              />
            </PropertyRow>

            {/* 이미지가 있을 때만 이미지 맞춤 옵션 표시 */}
            {(singleKeyPosition.activeImage || singleKeyPosition.inactiveImage) && (
              <>
                <SectionDivider />
                <PropertyRow label={t("propertiesPanel.imageFit") || "이미지 맞춤"}>
                  <SelectInput
                    value={singleKeyPosition.imageFit || "cover"}
                    options={[
                      { value: "cover", label: t("propertiesPanel.imageFitCover") || "채우기" },
                      { value: "contain", label: t("propertiesPanel.imageFitContain") || "맞춤" },
                      { value: "fill", label: t("propertiesPanel.imageFitFill") || "늘리기" },
                      { value: "none", label: t("propertiesPanel.imageFitNone") || "원본" },
                    ]}
                    onChange={(value) => handleStyleChangeComplete("imageFit", value as ImageFit)}
                  />
                </PropertyRow>
              </>
            )}

            {/* 커스텀 CSS 활성화 시에만 클래스명 및 CSS 우선순위 표시 */}
            {useCustomCSS && (
              <>
                <SectionDivider />
                
                {/* 클래스명 */}
                <PropertyRow label={t("propertiesPanel.className") || "클래스"}>
                  <TextInput
                    value={singleKeyPosition.className || ""}
                    onChange={handleClassNameChange}
                    onBlur={handleClassNameBlur}
                    placeholder="className"
                    width="90px"
                  />
                </PropertyRow>

                {/* CSS 우선순위 토글 */}
                <div className="flex justify-between items-center w-full">
                  <p className="text-white text-style-2">
                    {t("propertiesPanel.useInlineStyles") || "인라인 스타일 우선"}
                  </p>
                  <ToggleSwitch
                    checked={singleKeyPosition.useInlineStyles ?? false}
                    onChange={(checked) => handleStyleChangeComplete("useInlineStyles", checked)}
                  />
                </div>
                <p className="text-[#6B6D75] text-[10px] mt-[-4px]">
                  {t("propertiesPanel.useInlineStylesHint") || "활성화 시 커스텀 CSS보다 속성 패널 스타일이 우선 적용됩니다."}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 이미지 픽커 팝업 */}
      {showImagePicker && (
        <ImagePicker
          open={showImagePicker}
          referenceRef={imageButtonRef}
          idleImage={singleKeyPosition.inactiveImage || ""}
          activeImage={singleKeyPosition.activeImage || ""}
          idleTransparent={singleKeyPosition.idleTransparent ?? false}
          activeTransparent={singleKeyPosition.activeTransparent ?? false}
          onIdleImageChange={handleIdleImageChange}
          onActiveImageChange={handleActiveImageChange}
          onIdleTransparentChange={handleIdleTransparentChange}
          onActiveTransparentChange={handleActiveTransparentChange}
          onIdleImageReset={handleIdleImageReset}
          onActiveImageReset={handleActiveImageReset}
          onClose={() => setShowImagePicker(false)}
        />
      )}
    </>
  );
};

export default PropertiesPanel;
