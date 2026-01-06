import React, { useCallback } from "react";
import type { CounterTabContentProps } from "./types";
import type { KeyCounterSettings } from "@src/types/keys";
import { normalizeCounterSettings } from "@src/types/keys";
import {
  PropertyRow,
  NumberInput,
  SectionDivider,
} from "./PropertyInputs";
import Checkbox from "@components/main/common/Checkbox";
import Dropdown from "@components/main/common/Dropdown";

const CounterTabContent: React.FC<CounterTabContentProps> = ({
  keyIndex,
  keyPosition,
  onKeyUpdate,
  t,
}) => {
  // 카운터 설정 가져오기 (정규화된)
  const counterSettings = normalizeCounterSettings(keyPosition.counter);

  // 카운터 설정 업데이트 핸들러
  const handleCounterUpdate = useCallback(
    (updates: Partial<KeyCounterSettings>) => {
      const currentSettings = normalizeCounterSettings(keyPosition.counter);
      const newSettings = { ...currentSettings, ...updates };
      onKeyUpdate({ index: keyIndex, counter: newSettings });
    },
    [keyIndex, keyPosition.counter, onKeyUpdate]
  );

  // 카운터 컬러 피커 열기
  const handleOpenCounterColorPicker = useCallback(
    (target: "fillIdle" | "fillActive" | "strokeIdle" | "strokeActive") => {
      const colors = {
        fillIdle: counterSettings.fill.idle,
        fillActive: counterSettings.fill.active,
        strokeIdle: counterSettings.stroke.idle,
        strokeActive: counterSettings.stroke.active,
      };

      if (typeof (window as any).__dmn_showColorPicker === "function") {
        (window as any).__dmn_showColorPicker({
          initialColor: colors[target],
          onColorChange: () => {},
          onColorChangeComplete: (color: string) => {
            if (target === "fillIdle") {
              handleCounterUpdate({ fill: { ...counterSettings.fill, idle: color } });
            } else if (target === "fillActive") {
              handleCounterUpdate({ fill: { ...counterSettings.fill, active: color } });
            } else if (target === "strokeIdle") {
              handleCounterUpdate({ stroke: { ...counterSettings.stroke, idle: color } });
            } else if (target === "strokeActive") {
              handleCounterUpdate({ stroke: { ...counterSettings.stroke, active: color } });
            }
          },
          id: `counter-${target}-picker-${keyIndex}-${Date.now()}`,
        });
      }
    },
    [counterSettings, keyIndex, handleCounterUpdate]
  );

  return (
    <>
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
        />
      </PropertyRow>

      <SectionDivider />

      {/* 채우기 색상 */}
      <PropertyRow label={t("counterSetting.fill") || "채우기"}>
        <div className="flex items-center gap-[4px]">
          <button
            onClick={() => handleOpenCounterColorPicker("fillIdle")}
            className="relative px-[7px] h-[23px] bg-[#2A2A30] rounded-[7px] border-[1px] border-[#3A3943] flex items-center justify-center text-[#DBDEE8] text-style-4"
          >
            <div
              className="absolute left-[6px] top-[4.5px] w-[11px] h-[11px] rounded-[2px] border border-[#3A3943]"
              style={{ backgroundColor: counterSettings.fill.idle }}
            />
            <span className="ml-[16px] text-left">{t("counterSetting.idle") || "대기"}</span>
          </button>
          <button
            onClick={() => handleOpenCounterColorPicker("fillActive")}
            className="relative px-[7px] h-[23px] bg-[#2A2A30] rounded-[7px] border-[1px] border-[#3A3943] flex items-center justify-center text-[#DBDEE8] text-style-4"
          >
            <div
              className="absolute left-[6px] top-[4.5px] w-[11px] h-[11px] rounded-[2px] border border-[#3A3943]"
              style={{ backgroundColor: counterSettings.fill.active }}
            />
            <span className="ml-[16px] text-left">{t("counterSetting.active") || "입력"}</span>
          </button>
        </div>
      </PropertyRow>

      {/* 외곽선 색상 */}
      <PropertyRow label={t("counterSetting.stroke") || "외곽선"}>
        <div className="flex items-center gap-[4px]">
          <button
            onClick={() => handleOpenCounterColorPicker("strokeIdle")}
            className="relative px-[7px] h-[23px] bg-[#2A2A30] rounded-[7px] border-[1px] border-[#3A3943] flex items-center justify-center text-[#DBDEE8] text-style-4"
          >
            <div
              className="absolute left-[6px] top-[4.5px] w-[11px] h-[11px] rounded-[2px] border border-[#3A3943]"
              style={{ backgroundColor: counterSettings.stroke.idle }}
            />
            <span className="ml-[16px] text-left">{t("counterSetting.idle") || "대기"}</span>
          </button>
          <button
            onClick={() => handleOpenCounterColorPicker("strokeActive")}
            className="relative px-[7px] h-[23px] bg-[#2A2A30] rounded-[7px] border-[1px] border-[#3A3943] flex items-center justify-center text-[#DBDEE8] text-style-4"
          >
            <div
              className="absolute left-[6px] top-[4.5px] w-[11px] h-[11px] rounded-[2px] border border-[#3A3943]"
              style={{ backgroundColor: counterSettings.stroke.active }}
            />
            <span className="ml-[16px] text-left">{t("counterSetting.active") || "입력"}</span>
          </button>
        </div>
      </PropertyRow>

      <SectionDivider />

      {/* 카운터 사용 */}
      <div className="flex justify-between items-center w-full">
        <p className="text-white text-style-2">{t("counterSetting.counterEnabled") || "카운터 표시"}</p>
        <Checkbox
          checked={counterSettings.enabled}
          onChange={() => handleCounterUpdate({ enabled: !counterSettings.enabled })}
        />
      </div>
    </>
  );
};

export default CounterTabContent;
