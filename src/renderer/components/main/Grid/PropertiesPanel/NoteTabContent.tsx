import React, { useCallback } from "react";
import type { NoteTabContentProps } from "./types";
import type { NoteColor, KeyPosition } from "@src/types/keys";
import {
  PropertyRow,
  NumberInput,
  SectionDivider,
} from "./PropertyInputs";
import Checkbox from "@components/main/common/Checkbox";

const NoteTabContent: React.FC<NoteTabContentProps> = ({
  keyIndex,
  keyPosition,
  onKeyUpdate,
  onKeyPreview,
  t,
}) => {
  // 노트 색상 헬퍼 함수
  const getNoteColorDisplay = useCallback(() => {
    const noteColor = keyPosition.noteColor;
    if (noteColor && typeof noteColor === "object" && "type" in noteColor && noteColor.type === "gradient") {
      return {
        style: { background: `linear-gradient(to bottom, ${noteColor.top}, ${noteColor.bottom})` },
        label: "Gradient",
      };
    }
    const color = typeof noteColor === "string" ? noteColor : "#FFA500";
    return {
      style: { backgroundColor: color },
      label: color.replace(/^#/, ""),
    };
  }, [keyPosition.noteColor]);

  const getGlowColorDisplay = useCallback(() => {
    const glowColor = keyPosition.noteGlowColor;
    if (glowColor && typeof glowColor === "object" && "type" in glowColor && glowColor.type === "gradient") {
      return {
        style: { background: `linear-gradient(to bottom, ${glowColor.top}, ${glowColor.bottom})` },
        label: "Gradient",
      };
    }
    const color = typeof glowColor === "string" ? glowColor : "#FFA500";
    return {
      style: { backgroundColor: color },
      label: color.replace(/^#/, ""),
    };
  }, [keyPosition.noteGlowColor]);

  // 노트 색상 변경 핸들러
  const handleNoteColorChange = useCallback(
    (newColor: any) => {
      let colorValue: NoteColor;
      if (newColor && typeof newColor === "object" && newColor.type === "gradient") {
        colorValue = { type: "gradient", top: newColor.top, bottom: newColor.bottom };
      } else {
        colorValue = newColor;
      }
      onKeyPreview?.(keyIndex, { noteColor: colorValue });
    },
    [keyIndex, onKeyPreview]
  );

  const handleNoteColorChangeComplete = useCallback(
    (newColor: any) => {
      let colorValue: NoteColor;
      if (newColor && typeof newColor === "object" && newColor.type === "gradient") {
        colorValue = { type: "gradient", top: newColor.top, bottom: newColor.bottom };
      } else {
        colorValue = newColor;
      }
      onKeyUpdate({ index: keyIndex, noteColor: colorValue });
    },
    [keyIndex, onKeyUpdate]
  );

  // 글로우 색상 변경 핸들러
  const handleGlowColorChange = useCallback(
    (newColor: any) => {
      let colorValue: NoteColor;
      if (newColor && typeof newColor === "object" && newColor.type === "gradient") {
        colorValue = { type: "gradient", top: newColor.top, bottom: newColor.bottom };
      } else {
        colorValue = newColor;
      }
      onKeyPreview?.(keyIndex, { noteGlowColor: colorValue });
    },
    [keyIndex, onKeyPreview]
  );

  const handleGlowColorChangeComplete = useCallback(
    (newColor: any) => {
      let colorValue: NoteColor;
      if (newColor && typeof newColor === "object" && newColor.type === "gradient") {
        colorValue = { type: "gradient", top: newColor.top, bottom: newColor.bottom };
      } else {
        colorValue = newColor;
      }
      onKeyUpdate({ index: keyIndex, noteGlowColor: colorValue });
    },
    [keyIndex, onKeyUpdate]
  );

  // 노트 컬러 피커 열기
  const handleOpenNoteColorPicker = useCallback(() => {
    if (typeof (window as any).__dmn_showColorPicker === "function") {
      const noteColor = keyPosition.noteColor;
      let initialColor: any = "#FFA500";
      if (noteColor && typeof noteColor === "object" && "type" in noteColor && noteColor.type === "gradient") {
        initialColor = { type: "gradient", top: noteColor.top, bottom: noteColor.bottom };
      } else if (typeof noteColor === "string") {
        initialColor = noteColor;
      }
      (window as any).__dmn_showColorPicker({
        initialColor,
        onColorChange: handleNoteColorChange,
        onColorChangeComplete: handleNoteColorChangeComplete,
        id: `note-color-picker-${keyIndex}-${Date.now()}`,
        enableGradient: true,
      });
    }
  }, [keyPosition.noteColor, keyIndex, handleNoteColorChange, handleNoteColorChangeComplete]);

  // 글로우 컬러 피커 열기
  const handleOpenGlowColorPicker = useCallback(() => {
    if (typeof (window as any).__dmn_showColorPicker === "function") {
      const glowColor = keyPosition.noteGlowColor;
      let initialColor: any = "#FFA500";
      if (glowColor && typeof glowColor === "object" && "type" in glowColor && glowColor.type === "gradient") {
        initialColor = { type: "gradient", top: glowColor.top, bottom: glowColor.bottom };
      } else if (typeof glowColor === "string") {
        initialColor = glowColor;
      }
      (window as any).__dmn_showColorPicker({
        initialColor,
        onColorChange: handleGlowColorChange,
        onColorChangeComplete: handleGlowColorChangeComplete,
        id: `glow-color-picker-${keyIndex}-${Date.now()}`,
        enableGradient: true,
      });
    }
  }, [keyPosition.noteGlowColor, keyIndex, handleGlowColorChange, handleGlowColorChangeComplete]);

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
          onClick={handleOpenNoteColorPicker}
          className="relative w-[80px] h-[23px] bg-[#2A2A30] rounded-[7px] border-[1px] border-[#3A3943] flex items-center justify-center text-[#DBDEE8] text-style-2"
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
              onClick={handleOpenGlowColorPicker}
              className="relative w-[80px] h-[23px] bg-[#2A2A30] rounded-[7px] border-[1px] border-[#3A3943] flex items-center justify-center text-[#DBDEE8] text-style-2"
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
    </>
  );
};

export default NoteTabContent;
