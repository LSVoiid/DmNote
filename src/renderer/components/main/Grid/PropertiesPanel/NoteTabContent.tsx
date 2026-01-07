import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NoteTabContentProps } from "./types";
import type { NoteColor, KeyPosition } from "@src/types/keys";
import {
  PropertyRow,
  NumberInput,
  SectionDivider,
} from "./PropertyInputs";
import Checkbox from "@components/main/common/Checkbox";
import ColorPicker from "@components/main/Modal/content/ColorPicker";
import { isGradientColor } from "@utils/colorUtils";

// 색상 모드 상수
const COLOR_MODES = {
  solid: "solid",
  gradient: "gradient",
} as const;

type ColorMode = (typeof COLOR_MODES)[keyof typeof COLOR_MODES];

// 그라디언트 객체 생성 헬퍼
const toGradient = (top: string, bottom: string) => ({
  type: "gradient" as const,
  top,
  bottom,
});

const NoteTabContent: React.FC<NoteTabContentProps> = ({
  keyIndex,
  keyPosition,
  onKeyUpdate,
  onKeyPreview,
  panelElement,
  t,
}) => {
  // 통합 피커 상태 (카운터 탭 패턴)
  type PickerTarget = "note" | "glow" | null;
  const [pickerFor, setPickerFor] = useState<PickerTarget>(null);
  const pickerOpen = !!pickerFor;
  
  // 컬러 버튼 refs
  const noteColorButtonRef = useRef<HTMLButtonElement>(null);
  const glowColorButtonRef = useRef<HTMLButtonElement>(null);

  // 노트 색상 상태 (원본 모달과 동일한 패턴)
  const [noteColorMode, setNoteColorMode] = useState<ColorMode>(() => {
    const noteColor = keyPosition.noteColor;
    return isGradientColor(noteColor) ? COLOR_MODES.gradient : COLOR_MODES.solid;
  });
  const [noteColorTop, setNoteColorTop] = useState<string>(() => {
    const noteColor = keyPosition.noteColor;
    if (noteColor && typeof noteColor === "object" && noteColor.type === "gradient") {
      return noteColor.top;
    }
    return typeof noteColor === "string" ? noteColor : "#FFA500";
  });
  const [noteGradientBottom, setNoteGradientBottom] = useState<string>(() => {
    const noteColor = keyPosition.noteColor;
    if (noteColor && typeof noteColor === "object" && noteColor.type === "gradient") {
      return noteColor.bottom;
    }
    return typeof noteColor === "string" ? noteColor : "#FFA500";
  });

  // 글로우 색상 상태 (원본 모달과 동일한 패턴)
  const [glowColorMode, setGlowColorMode] = useState<ColorMode>(() => {
    const glowColor = keyPosition.noteGlowColor;
    return isGradientColor(glowColor) ? COLOR_MODES.gradient : COLOR_MODES.solid;
  });
  const [glowColorTop, setGlowColorTop] = useState<string>(() => {
    const glowColor = keyPosition.noteGlowColor;
    if (glowColor && typeof glowColor === "object" && glowColor.type === "gradient") {
      return glowColor.top;
    }
    return typeof glowColor === "string" ? glowColor : "#FFA500";
  });
  const [glowGradientBottom, setGlowGradientBottom] = useState<string>(() => {
    const glowColor = keyPosition.noteGlowColor;
    if (glowColor && typeof glowColor === "object" && glowColor.type === "gradient") {
      return glowColor.bottom;
    }
    return typeof glowColor === "string" ? glowColor : "#FFA500";
  });

  // keyPosition 변경 시 내부 상태 동기화 (피커가 닫혀있을 때만)
  useEffect(() => {
    // 피커가 열려있으면 외부 변경을 무시 (드래그 중 충돌 방지)
    if (pickerFor === "note") return;
    
    const noteColor = keyPosition.noteColor;
    if (noteColor && typeof noteColor === "object" && noteColor.type === "gradient") {
      setNoteColorMode(COLOR_MODES.gradient);
      setNoteColorTop(noteColor.top);
      setNoteGradientBottom(noteColor.bottom);
    } else {
      setNoteColorMode(COLOR_MODES.solid);
      const color = typeof noteColor === "string" ? noteColor : "#FFA500";
      setNoteColorTop(color);
      setNoteGradientBottom(color);
    }
  }, [keyPosition.noteColor, pickerFor]);

  useEffect(() => {
    // 피커가 열려있으면 외부 변경을 무시 (드래그 중 충돌 방지)
    if (pickerFor === "glow") return;
    
    const glowColor = keyPosition.noteGlowColor;
    if (glowColor && typeof glowColor === "object" && glowColor.type === "gradient") {
      setGlowColorMode(COLOR_MODES.gradient);
      setGlowColorTop(glowColor.top);
      setGlowGradientBottom(glowColor.bottom);
    } else {
      setGlowColorMode(COLOR_MODES.solid);
      const color = typeof glowColor === "string" ? glowColor : "#FFA500";
      setGlowColorTop(color);
      setGlowGradientBottom(color);
    }
  }, [keyPosition.noteGlowColor, pickerFor]);

  const interactiveRefs = useMemo(
    () => [noteColorButtonRef, glowColorButtonRef],
    []
  );

  // 노트 색상 헬퍼 함수 (내부 상태 기반으로 실시간 반영)
  const getNoteColorDisplay = useCallback(() => {
    if (noteColorMode === COLOR_MODES.gradient) {
      return {
        style: { background: `linear-gradient(to bottom, ${noteColorTop}, ${noteGradientBottom})` },
        label: "Gradient",
      };
    }
    return {
      style: { backgroundColor: noteColorTop },
      label: noteColorTop.replace(/^#/, ""),
    };
  }, [noteColorMode, noteColorTop, noteGradientBottom]);

  const getGlowColorDisplay = useCallback(() => {
    if (glowColorMode === COLOR_MODES.gradient) {
      return {
        style: { background: `linear-gradient(to bottom, ${glowColorTop}, ${glowGradientBottom})` },
        label: "Gradient",
      };
    }
    return {
      style: { backgroundColor: glowColorTop },
      label: glowColorTop.replace(/^#/, ""),
    };
  }, [glowColorMode, glowColorTop, glowGradientBottom]);

  // 통합 색상 변경 핸들러 (pickerFor 기반)
  const handleColorChange = useCallback(
    (target: "note" | "glow", newColor: any) => {
      if (target === "note") {
        if (newColor && typeof newColor === "object" && newColor.type === "gradient") {
          setNoteColorMode(COLOR_MODES.gradient);
          setNoteColorTop(newColor.top);
          setNoteGradientBottom(newColor.bottom);
        } else {
          setNoteColorMode(COLOR_MODES.solid);
          setNoteColorTop(newColor);
          setNoteGradientBottom(newColor);
        }
      } else {
        if (newColor && typeof newColor === "object" && newColor.type === "gradient") {
          setGlowColorMode(COLOR_MODES.gradient);
          setGlowColorTop(newColor.top);
          setGlowGradientBottom(newColor.bottom);
        } else {
          setGlowColorMode(COLOR_MODES.solid);
          setGlowColorTop(newColor);
          setGlowGradientBottom(newColor);
        }
      }
    },
    []
  );

  const handleColorChangeComplete = useCallback(
    (target: "note" | "glow", newColor: any) => {
      let colorValue: NoteColor;
      
      if (target === "note") {
        if (newColor && typeof newColor === "object" && newColor.type === "gradient") {
          setNoteColorMode(COLOR_MODES.gradient);
          setNoteColorTop(newColor.top);
          setNoteGradientBottom(newColor.bottom);
          colorValue = { type: "gradient", top: newColor.top, bottom: newColor.bottom };
        } else {
          setNoteColorMode(COLOR_MODES.solid);
          setNoteColorTop(newColor);
          setNoteGradientBottom(newColor);
          colorValue = newColor;
        }
        onKeyPreview?.(keyIndex, { noteColor: colorValue });
        onKeyUpdate({ index: keyIndex, noteColor: colorValue });
      } else {
        if (newColor && typeof newColor === "object" && newColor.type === "gradient") {
          setGlowColorMode(COLOR_MODES.gradient);
          setGlowColorTop(newColor.top);
          setGlowGradientBottom(newColor.bottom);
          colorValue = { type: "gradient", top: newColor.top, bottom: newColor.bottom };
        } else {
          setGlowColorMode(COLOR_MODES.solid);
          setGlowColorTop(newColor);
          setGlowGradientBottom(newColor);
          colorValue = newColor;
        }
        onKeyPreview?.(keyIndex, { noteGlowColor: colorValue });
        onKeyUpdate({ index: keyIndex, noteGlowColor: colorValue });
      }
    },
    [keyIndex, onKeyPreview, onKeyUpdate]
  );

  // ColorPicker에 전달할 색상 (내부 상태 기반)
  const notePickerColor = useMemo(() => {
    if (noteColorMode === COLOR_MODES.gradient) {
      return toGradient(noteColorTop, noteGradientBottom);
    }
    return noteColorTop;
  }, [noteColorMode, noteColorTop, noteGradientBottom]);

  const glowPickerColor = useMemo(() => {
    if (glowColorMode === COLOR_MODES.gradient) {
      return toGradient(glowColorTop, glowGradientBottom);
    }
    return glowColorTop;
  }, [glowColorMode, glowColorTop, glowGradientBottom]);

  // 피커 토글 (같은 타겟이면 닫고, 다른 타겟이면 바로 전환)
  const handlePickerToggle = useCallback((target: "note" | "glow") => {
    setPickerFor((prev) => (prev === target ? null : target));
  }, []);

  // 스타일 변경 완료 핸들러
  const handleStyleChangeComplete = useCallback(
    (property: keyof KeyPosition, value: any) => {
      onKeyUpdate({ index: keyIndex, [property]: value });
    },
    [keyIndex, onKeyUpdate]
  );

  return (
    <>
      {/* 노트 색상 */}
      <PropertyRow label={t("keySetting.noteColor") || "노트 색상"}>
        <button
          ref={noteColorButtonRef}
          onClick={() => handlePickerToggle("note")}
          className={`relative w-[80px] h-[23px] bg-[#2A2A30] rounded-[7px] border-[1px] ${
            pickerFor === "note" ? "border-[#459BF8]" : "border-[#3A3943]"
          } flex items-center justify-center text-[#DBDEE8] text-style-2`}
        >
          <div
            className="absolute left-[6px] top-[4.5px] w-[11px] h-[11px] rounded-[2px] border border-[#3A3943]"
            style={getNoteColorDisplay().style}
          />
          <span className="ml-[16px] text-left text-style-4">{getNoteColorDisplay().label}</span>
        </button>
      </PropertyRow>

      {/* 노트 투명도 */}
      <PropertyRow label={t("keySetting.noteOpacity") || "노트 투명도"}>
        <NumberInput
          value={keyPosition.noteOpacity ?? 80}
          onChange={(value) => handleStyleChangeComplete("noteOpacity", value)}
          suffix="%"
          min={0}
          max={100}
        />
      </PropertyRow>

      <SectionDivider />

      {/* 글로우 효과 */}
      <div className="flex justify-between items-center w-full">
        <p className="text-white text-style-2">{t("keySetting.noteGlow") || "글로우 효과"}</p>
        <Checkbox
          checked={keyPosition.noteGlowEnabled ?? false}
          onChange={() => handleStyleChangeComplete("noteGlowEnabled", !(keyPosition.noteGlowEnabled ?? false))}
        />
      </div>

      {/* 글로우 색상/크기/투명도 (조건부) */}
      {keyPosition.noteGlowEnabled && (
        <>
          <PropertyRow label={t("keySetting.noteGlowColor") || "글로우 색상"}>
            <button
              ref={glowColorButtonRef}
              onClick={() => handlePickerToggle("glow")}
              className={`relative w-[80px] h-[23px] bg-[#2A2A30] rounded-[7px] border-[1px] ${
                pickerFor === "glow" ? "border-[#459BF8]" : "border-[#3A3943]"
              } flex items-center justify-center text-[#DBDEE8] text-style-2`}
            >
              <div
                className="absolute left-[6px] top-[4.5px] w-[11px] h-[11px] rounded-[2px] border border-[#3A3943]"
                style={getGlowColorDisplay().style}
              />
              <span className="ml-[16px] text-left text-style-4">{getGlowColorDisplay().label}</span>
            </button>
          </PropertyRow>

          <PropertyRow label={t("keySetting.noteGlowSize") || "글로우 크기"}>
            <NumberInput
              value={keyPosition.noteGlowSize ?? 20}
              onChange={(value) => handleStyleChangeComplete("noteGlowSize", value)}
              min={0}
              max={50}
            />
          </PropertyRow>

          <PropertyRow label={t("keySetting.noteGlowOpacity") || "글로우 투명도"}>
            <NumberInput
              value={keyPosition.noteGlowOpacity ?? 70}
              onChange={(value) => handleStyleChangeComplete("noteGlowOpacity", value)}
              suffix="%"
              min={0}
              max={100}
            />
          </PropertyRow>
        </>
      )}

      <SectionDivider />

      {/* 노트 효과 표시 */}
      <div className="flex justify-between items-center w-full">
        <p className="text-white text-style-2">{t("keySetting.noteEffectEnabled") || "노트 효과 표시"}</p>
        <Checkbox
          checked={keyPosition.noteEffectEnabled ?? true}
          onChange={() => handleStyleChangeComplete("noteEffectEnabled", !(keyPosition.noteEffectEnabled ?? true))}
        />
      </div>

      {/* Y축 자동 보정 */}
      <div className="flex justify-between items-center w-full">
        <p className="text-white text-style-2">{t("keySetting.noteAutoYCorrection") || "Y축 자동 보정"}</p>
        <Checkbox
          checked={keyPosition.noteAutoYCorrection ?? true}
          onChange={() => handleStyleChangeComplete("noteAutoYCorrection", !(keyPosition.noteAutoYCorrection ?? true))}
        />
      </div>

      {/* 통합 ColorPicker - 단일 인스턴스로 깜빡임 없이 전환 */}
      {pickerFor && (
        <ColorPicker
          key={pickerFor}
          open={pickerOpen}
          referenceRef={noteColorButtonRef}
          panelElement={panelElement}
          color={pickerFor === "note" ? notePickerColor : glowPickerColor}
          onColorChange={(c: any) => handleColorChange(pickerFor, c)}
          onColorChangeComplete={(c: any) => handleColorChangeComplete(pickerFor, c)}
          onClose={() => setPickerFor(null)}
          interactiveRefs={interactiveRefs}
          solidOnly={false}
        />
      )}
    </>
  );
};

export default NoteTabContent;
