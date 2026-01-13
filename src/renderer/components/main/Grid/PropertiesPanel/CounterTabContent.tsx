import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CounterTabContentProps } from "./types";
import type { KeyCounterSettings } from "@src/types/keys";
import { normalizeCounterSettings } from "@src/types/keys";
import {
  PropertyRow,
  FontStyleToggle,
  NumberInput,
  SectionDivider,
} from "./PropertyInputs";
import Checkbox from "@components/main/common/Checkbox";
import Dropdown from "@components/main/common/Dropdown";
import ColorPicker from "@components/main/Modal/content/ColorPicker";

type ColorPickerTarget = "fillIdle" | "fillActive" | "strokeIdle" | "strokeActive";

const CounterTabContent: React.FC<CounterTabContentProps> = ({
  keyIndex,
  keyPosition,
  onKeyUpdate,
  panelElement,
  t,
}) => {
  const fillIdleBtnRef = useRef<HTMLButtonElement>(null);
  const fillActiveBtnRef = useRef<HTMLButtonElement>(null);
  const strokeIdleBtnRef = useRef<HTMLButtonElement>(null);
  const strokeActiveBtnRef = useRef<HTMLButtonElement>(null);
  const fillGroupRef = useRef<HTMLDivElement>(null);
  const strokeGroupRef = useRef<HTMLDivElement>(null);

  const [pickerFor, setPickerFor] = useState<ColorPickerTarget | null>(null);
  const pickerOpen = !!pickerFor;

  const counterSettings = normalizeCounterSettings(keyPosition.counter);

  // 로컬 색상 상태 (드래그 중 UI 업데이트용)
  const [localColors, setLocalColors] = useState({
    fillIdle: counterSettings.fill.idle,
    fillActive: counterSettings.fill.active,
    strokeIdle: counterSettings.stroke.idle,
    strokeActive: counterSettings.stroke.active,
  });

  // 피커가 닫혀있을 때만 외부 prop과 동기화
  useEffect(() => {
    if (!pickerOpen) {
      setLocalColors({
        fillIdle: counterSettings.fill.idle,
        fillActive: counterSettings.fill.active,
        strokeIdle: counterSettings.stroke.idle,
        strokeActive: counterSettings.stroke.active,
      });
    }
  }, [
    pickerOpen,
    counterSettings.fill.idle,
    counterSettings.fill.active,
    counterSettings.stroke.idle,
    counterSettings.stroke.active,
  ]);

  const colorPickerInteractiveRefs = useMemo(
    () => [
      fillIdleBtnRef,
      fillActiveBtnRef,
      strokeIdleBtnRef,
      strokeActiveBtnRef,
      fillGroupRef,
      strokeGroupRef,
    ],
    []
  );

  const handleCounterUpdate = useCallback(
    (updates: Partial<KeyCounterSettings>) => {
      const currentSettings = normalizeCounterSettings(keyPosition.counter);
      const newSettings = { ...currentSettings, ...updates };
      onKeyUpdate({ index: keyIndex, counter: newSettings });
    },
    [keyIndex, keyPosition.counter, onKeyUpdate]
  );

  const handleColorToggle = useCallback((target: ColorPickerTarget) => {
    setPickerFor((prev) => (prev === target ? null : target));
  }, []);

  // 로컬 상태에서 색상 값 가져오기 (버튼 표시용)
  const colorValueFor = useCallback(
    (key: ColorPickerTarget | null): string => {
      switch (key) {
        case "fillIdle":
          return localColors.fillIdle;
        case "fillActive":
          return localColors.fillActive;
        case "strokeIdle":
          return localColors.strokeIdle;
        case "strokeActive":
          return localColors.strokeActive;
        default:
          return "#FFFFFF";
      }
    },
    [localColors]
  );

  // 드래그 중 로컬 상태만 업데이트 (부모에게 전달 안함)
  const handleColorChange = useCallback(
    (key: ColorPickerTarget | null, color: string) => {
      if (!key) return;
      setLocalColors((prev) => ({ ...prev, [key]: color }));
    },
    []
  );

  // 드래그 완료 시 부모에게 전달
  const handleColorChangeComplete = useCallback(
    (key: ColorPickerTarget | null, color: string) => {
      if (!key) return;
      setLocalColors((prev) => ({ ...prev, [key]: color }));
      switch (key) {
        case "fillIdle":
          handleCounterUpdate({ fill: { ...counterSettings.fill, idle: color } });
          break;
        case "fillActive":
          handleCounterUpdate({ fill: { ...counterSettings.fill, active: color } });
          break;
        case "strokeIdle":
          handleCounterUpdate({ stroke: { ...counterSettings.stroke, idle: color } });
          break;
        case "strokeActive":
          handleCounterUpdate({
            stroke: { ...counterSettings.stroke, active: color },
          });
          break;
        default:
          break;
      }
    },
    [counterSettings.fill, counterSettings.stroke, handleCounterUpdate]
  );

  // 원본 모달처럼 모든 컬러픽커가 같은 위치(fillActive 버튼 기준)에서 렌더링
  const referenceRef = fillActiveBtnRef;

  return (
    <>
      {/* 카운터 사용 */}
      <div className="flex justify-between items-center w-full h-[23px]">
        <p className="text-white text-style-2">{t("counterSetting.counterEnabled") || "카운터 표시"}</p>
        <Checkbox
          checked={counterSettings.enabled}
          onChange={() => handleCounterUpdate({ enabled: !counterSettings.enabled })}
        />
      </div>

      <SectionDivider />

      {/* 배치 영역 */}
      <PropertyRow label={t("counterSetting.placementArea") || "배치 영역"}>
        <Dropdown
          options={[
            { label: t("counterSetting.placementInside") || "내부", value: "inside" },
            { label: t("counterSetting.placementOutside") || "외부", value: "outside" },
          ]}
          value={counterSettings.placement}
          onChange={(value) => handleCounterUpdate({ placement: value as "inside" | "outside" })}
        />
      </PropertyRow>

      {/* 정렬 방향 */}
      <PropertyRow label={t("counterSetting.alignDirection") || "정렬 방향"}>
        <Dropdown
          options={[
            { label: t("counterSetting.alignTop") || "상단", value: "top" },
            { label: t("counterSetting.alignBottom") || "하단", value: "bottom" },
            { label: t("counterSetting.alignLeft") || "좌측", value: "left" },
            { label: t("counterSetting.alignRight") || "우측", value: "right" },
          ]}
          value={counterSettings.align}
          onChange={(value) => handleCounterUpdate({ align: value as "top" | "bottom" | "left" | "right" })}
        />
      </PropertyRow>

      {/* 간격 */}
      <PropertyRow label={t("counterSetting.gap") || "간격"}>
        <NumberInput
          value={counterSettings.gap}
          onChange={(value) => handleCounterUpdate({ gap: value })}
          suffix="px"
          min={0}
          max={100}
          width="54px"
        />
      </PropertyRow>

      <SectionDivider />

      {/* 채우기 색상 */}
      <PropertyRow label={t("counterSetting.fill") || "채우기"}>
        <div ref={fillGroupRef} className="flex items-center gap-[4px]">
          <button
            ref={fillIdleBtnRef}
            type="button"
            onClick={() => handleColorToggle("fillIdle")}
            className={`relative px-[7px] h-[23px] bg-[#2A2A30] rounded-[7px] border-[1px] flex items-center justify-center text-[#DBDEE8] text-style-4 ${
              pickerOpen && pickerFor === "fillIdle"
                ? "border-[#459BF8]"
                : "border-[#3A3943]"
            }`}
          >
            <div
              className="absolute left-[6px] top-[4.5px] w-[11px] h-[11px] rounded-[2px] border border-[#3A3943]"
              style={{ backgroundColor: localColors.fillIdle }}
            />
            <span className="ml-[16px] text-left">{t("counterSetting.idle") || "대기"}</span>
          </button>
          <button
            ref={fillActiveBtnRef}
            type="button"
            onClick={() => handleColorToggle("fillActive")}
            className={`relative px-[7px] h-[23px] bg-[#2A2A30] rounded-[7px] border-[1px] flex items-center justify-center text-[#DBDEE8] text-style-4 ${
              pickerOpen && pickerFor === "fillActive"
                ? "border-[#459BF8]"
                : "border-[#3A3943]"
            }`}
          >
            <div
              className="absolute left-[6px] top-[4.5px] w-[11px] h-[11px] rounded-[2px] border border-[#3A3943]"
              style={{ backgroundColor: localColors.fillActive }}
            />
            <span className="ml-[16px] text-left">{t("counterSetting.active") || "입력"}</span>
          </button>
        </div>
      </PropertyRow>

      {/* 외곽선 색상 */}
      <PropertyRow label={t("counterSetting.stroke") || "외곽선"}>
        <div ref={strokeGroupRef} className="flex items-center gap-[4px]">
          <button
            ref={strokeIdleBtnRef}
            type="button"
            onClick={() => handleColorToggle("strokeIdle")}
            className={`relative px-[7px] h-[23px] bg-[#2A2A30] rounded-[7px] border-[1px] flex items-center justify-center text-[#DBDEE8] text-style-4 ${
              pickerOpen && pickerFor === "strokeIdle"
                ? "border-[#459BF8]"
                : "border-[#3A3943]"
            }`}
          >
            <div
              className="absolute left-[6px] top-[4.5px] w-[11px] h-[11px] rounded-[2px] border border-[#3A3943]"
              style={{ backgroundColor: localColors.strokeIdle }}
            />
            <span className="ml-[16px] text-left">{t("counterSetting.idle") || "대기"}</span>
          </button>
          <button
            ref={strokeActiveBtnRef}
            type="button"
            onClick={() => handleColorToggle("strokeActive")}
            className={`relative px-[7px] h-[23px] bg-[#2A2A30] rounded-[7px] border-[1px] flex items-center justify-center text-[#DBDEE8] text-style-4 ${
              pickerOpen && pickerFor === "strokeActive"
                ? "border-[#459BF8]"
                : "border-[#3A3943]"
            }`}
          >
            <div
              className="absolute left-[6px] top-[4.5px] w-[11px] h-[11px] rounded-[2px] border border-[#3A3943]"
              style={{ backgroundColor: localColors.strokeActive }}
            />
            <span className="ml-[16px] text-left">{t("counterSetting.active") || "입력"}</span>
          </button>
        </div>
      </PropertyRow>

      <SectionDivider />

      {/* 폰트 크기 */}
      <PropertyRow label={t("counterSetting.fontSize") || "폰트 크기"}>
        <NumberInput
          value={counterSettings.fontSize ?? 16}
          onChange={(value) => handleCounterUpdate({ fontSize: value })}
          suffix="px"
          min={8}
          max={72}
        />
      </PropertyRow>

      {/* 폰트 스타일 */}
      <PropertyRow label={t("counterSetting.fontStyle") || "폰트 스타일"}>
        <FontStyleToggle
          isBold={(counterSettings.fontWeight ?? 400) >= 700}
          isItalic={counterSettings.fontItalic ?? false}
          isUnderline={counterSettings.fontUnderline ?? false}
          isStrikethrough={counterSettings.fontStrikethrough ?? false}
          onBoldChange={(value) =>
            handleCounterUpdate({ fontWeight: value ? 700 : 400 })
          }
          onItalicChange={(value) => handleCounterUpdate({ fontItalic: value })}
          onUnderlineChange={(value) =>
            handleCounterUpdate({ fontUnderline: value })
          }
          onStrikethroughChange={(value) =>
            handleCounterUpdate({ fontStrikethrough: value })
          }
        />
      </PropertyRow>

      {pickerFor && (
        <ColorPicker
          open={pickerOpen}
          referenceRef={referenceRef}
          panelElement={panelElement}
          color={colorValueFor(pickerFor)}
          onColorChange={(c: string) => handleColorChange(pickerFor, c)}
          onColorChangeComplete={(c: string) => handleColorChangeComplete(pickerFor, c)}
          onClose={() => setPickerFor(null)}
          solidOnly={true}
          interactiveRefs={colorPickerInteractiveRefs}
        />
      )}
    </>
  );
};

export default CounterTabContent;
