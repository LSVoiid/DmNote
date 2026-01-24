import React from "react";
import type { KeyPosition } from "@src/types/keys";
import { PropertyRow, NumberInput, OptionalNumberInput, SectionDivider } from "./index";
import Checkbox from "@components/main/common/Checkbox";
import { NOTE_SETTINGS_CONSTRAINTS } from "@src/types/noteSettingsConstraints";

interface BatchNoteTabContentProps {
  // getMixedValue 함수
  getMixedValue: <T>(
    getter: (pos: KeyPosition) => T | undefined,
    defaultValue: T,
  ) => { isMixed: boolean; value: T };
  // 핸들러
  handleBatchStyleChangeComplete: (property: keyof KeyPosition, value: any) => void;
  // 노트/글로우 색상 디스플레이
  getBatchNoteColorDisplay: () => {
    style: React.CSSProperties;
    label: string;
    isMixed: boolean;
  };
  getBatchGlowColorDisplay: () => {
    style: React.CSSProperties;
    label: string;
    isMixed: boolean;
  };
  // 컬러 피커 토글
  onNoteColorPickerToggle: () => void;
  onGlowColorPickerToggle: () => void;
  batchNoteColorButtonRef: React.RefObject<HTMLButtonElement>;
  batchGlowColorButtonRef: React.RefObject<HTMLButtonElement>;
  // 번역
  t: (key: string) => string;
}

const BatchNoteTabContent: React.FC<BatchNoteTabContentProps> = ({
  getMixedValue,
  handleBatchStyleChangeComplete,
  getBatchNoteColorDisplay,
  getBatchGlowColorDisplay,
  onNoteColorPickerToggle,
  onGlowColorPickerToggle,
  batchNoteColorButtonRef,
  batchGlowColorButtonRef,
  t,
}) => {
  const noteWidthMixed = getMixedValue((pos) => pos.noteWidth, undefined as any);

  return (
    <>
      {/* 노트 효과 표시 */}
      <div className="flex justify-between items-center w-full h-[23px]">
        <p className="text-white text-style-2">
          {t("keySetting.noteEffectEnabled") || "노트 효과 표시"}
        </p>
        <Checkbox
          checked={
            getMixedValue((pos) => pos.noteEffectEnabled, true).value
          }
          onChange={() => {
            const currentValue = getMixedValue(
              (pos) => pos.noteEffectEnabled,
              true,
            ).value;
            handleBatchStyleChangeComplete("noteEffectEnabled", !currentValue);
          }}
        />
      </div>

      {/* Y축 자동 보정 */}
      <div className="flex justify-between items-center w-full h-[23px]">
        <p className="text-white text-style-2">
          {t("keySetting.noteAutoYCorrection") || "Y축 자동 보정"}
        </p>
        <Checkbox
          checked={
            getMixedValue((pos) => pos.noteAutoYCorrection, true).value
          }
          onChange={() => {
            const currentValue = getMixedValue(
              (pos) => pos.noteAutoYCorrection,
              true,
            ).value;
            handleBatchStyleChangeComplete("noteAutoYCorrection", !currentValue);
          }}
        />
      </div>

      <SectionDivider />

      {/* 노트 넓이 */}
      <PropertyRow label={t("keySetting.noteWidth") || "노트 넓이"}>
        {noteWidthMixed.isMixed ? (
          <span className="text-[#6B6D75] text-style-4 italic">Mixed</span>
        ) : null}
        <OptionalNumberInput
          value={noteWidthMixed.value}
          onChange={(value) => handleBatchStyleChangeComplete("noteWidth", value)}
          suffix="px"
          min={1}
          placeholder="Auto"
        />
      </PropertyRow>

      {/* 노트 색상 */}
      <PropertyRow label={t("keySetting.noteColor") || "노트 색상"}>
        <button
          ref={batchNoteColorButtonRef}
          onClick={onNoteColorPickerToggle}
          className="relative w-[80px] h-[23px] bg-[#2A2A30] rounded-[7px] border-[1px] border-[#3A3943] flex items-center justify-center text-[#DBDEE8] text-style-2"
        >
          <div
            className="absolute left-[6px] top-[4.5px] w-[11px] h-[11px] rounded-[2px] border border-[#3A3943]"
            style={getBatchNoteColorDisplay().style}
          />
          <span
            className={`ml-[16px] text-left text-style-4 ${
              getBatchNoteColorDisplay().isMixed ? "italic text-[#6B6D75]" : ""
            }`}
          >
            {getBatchNoteColorDisplay().label}
          </span>
        </button>
      </PropertyRow>

      {/* 노트 투명도 */}
      <PropertyRow label={t("keySetting.noteOpacity") || "노트 투명도"}>
        {getMixedValue((pos) => pos.noteOpacity, 80).isMixed ? (
          <span className="text-[#6B6D75] text-style-4 italic">Mixed</span>
        ) : null}
        <NumberInput
          value={getMixedValue((pos) => pos.noteOpacity, 80).value}
          onChange={(value) =>
            handleBatchStyleChangeComplete("noteOpacity", value)
          }
          suffix="%"
          min={0}
          max={100}
        />
      </PropertyRow>

      {/* 노트 라운딩 */}
      <PropertyRow label={t("keySetting.noteBorderRadius") || "노트 라운딩"}>
        {getMixedValue(
          (pos) => pos.noteBorderRadius,
          NOTE_SETTINGS_CONSTRAINTS.borderRadius.default,
        ).isMixed ? (
          <span className="text-[#6B6D75] text-style-4 italic">Mixed</span>
        ) : null}
        <NumberInput
          value={
            getMixedValue(
              (pos) => pos.noteBorderRadius,
              NOTE_SETTINGS_CONSTRAINTS.borderRadius.default,
            ).value
          }
          onChange={(value) =>
            handleBatchStyleChangeComplete("noteBorderRadius", value)
          }
          suffix="px"
          min={NOTE_SETTINGS_CONSTRAINTS.borderRadius.min}
          max={NOTE_SETTINGS_CONSTRAINTS.borderRadius.max}
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
            getMixedValue((pos) => pos.noteGlowEnabled, false).value
          }
          onChange={() => {
            const currentValue = getMixedValue(
              (pos) => pos.noteGlowEnabled,
              false,
            ).value;
            handleBatchStyleChangeComplete("noteGlowEnabled", !currentValue);
          }}
        />
      </div>

      {/* 글로우 색상/크기/투명도 */}
      <PropertyRow label={t("keySetting.noteGlowColor") || "글로우 색상"}>
        <button
          ref={batchGlowColorButtonRef}
          onClick={onGlowColorPickerToggle}
          className="relative w-[80px] h-[23px] bg-[#2A2A30] rounded-[7px] border-[1px] border-[#3A3943] flex items-center justify-center text-[#DBDEE8] text-style-2"
        >
          <div
            className="absolute left-[6px] top-[4.5px] w-[11px] h-[11px] rounded-[2px] border border-[#3A3943]"
            style={getBatchGlowColorDisplay().style}
          />
          <span
            className={`ml-[16px] text-left text-style-4 ${
              getBatchGlowColorDisplay().isMixed
                ? "italic text-[#6B6D75]"
                : ""
            }`}
          >
            {getBatchGlowColorDisplay().label}
          </span>
        </button>
      </PropertyRow>

      <PropertyRow label={t("keySetting.noteGlowSize") || "글로우 크기"}>
        {getMixedValue((pos) => pos.noteGlowSize, 20).isMixed ? (
          <span className="text-[#6B6D75] text-style-4 italic">Mixed</span>
        ) : null}
        <NumberInput
          value={getMixedValue((pos) => pos.noteGlowSize, 20).value}
          onChange={(value) =>
            handleBatchStyleChangeComplete("noteGlowSize", value)
          }
          suffix="px"
          min={0}
          max={50}
        />
      </PropertyRow>

      <PropertyRow label={t("keySetting.noteGlowOpacity") || "글로우 투명도"}>
        {getMixedValue((pos) => pos.noteGlowOpacity, 70).isMixed ? (
          <span className="text-[#6B6D75] text-style-4 italic">Mixed</span>
        ) : null}
        <NumberInput
          value={getMixedValue((pos) => pos.noteGlowOpacity, 70).value}
          onChange={(value) =>
            handleBatchStyleChangeComplete("noteGlowOpacity", value)
          }
          suffix="%"
          min={0}
          max={100}
        />
      </PropertyRow>
    </>
  );
};

export default BatchNoteTabContent;
