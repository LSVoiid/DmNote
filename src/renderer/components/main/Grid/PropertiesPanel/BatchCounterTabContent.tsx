import React from "react";
import type { KeyCounterSettings } from "@src/types/keys";
import { PropertyRow, NumberInput, FontStyleToggle, SectionDivider } from "./index";
import Checkbox from "@components/main/common/Checkbox";
import Dropdown from "@components/main/common/Dropdown";

interface BatchCounterTabContentProps {
  // 카운터 설정 (첫 번째 선택 키 기준)
  batchCounterSettings: KeyCounterSettings;
  // 핸들러
  handleBatchCounterUpdate: (updates: Partial<KeyCounterSettings>) => void;
  // 컬러 디스플레이
  getCounterColorDisplay: (
    key: "fillIdle" | "fillActive" | "strokeIdle" | "strokeActive",
  ) => string;
  // 컬러 피커 토글
  onFillIdlePickerToggle: () => void;
  onFillActivePickerToggle: () => void;
  onStrokeIdlePickerToggle: () => void;
  onStrokeActivePickerToggle: () => void;
  // Refs
  batchCounterFillIdleButtonRef: React.RefObject<HTMLButtonElement>;
  batchCounterFillActiveButtonRef: React.RefObject<HTMLButtonElement>;
  batchCounterStrokeIdleButtonRef: React.RefObject<HTMLButtonElement>;
  batchCounterStrokeActiveButtonRef: React.RefObject<HTMLButtonElement>;
  // 번역
  t: (key: string) => string;
}

const BatchCounterTabContent: React.FC<BatchCounterTabContentProps> = ({
  batchCounterSettings,
  handleBatchCounterUpdate,
  getCounterColorDisplay,
  onFillIdlePickerToggle,
  onFillActivePickerToggle,
  onStrokeIdlePickerToggle,
  onStrokeActivePickerToggle,
  batchCounterFillIdleButtonRef,
  batchCounterFillActiveButtonRef,
  batchCounterStrokeIdleButtonRef,
  batchCounterStrokeActiveButtonRef,
  t,
}) => {
  return (
    <>
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

      <SectionDivider />

      {/* 배치 영역 */}
      <PropertyRow label={t("counterSetting.placementArea") || "배치 영역"}>
        <Dropdown
          options={[
            {
              label: t("counterSetting.placementInside") || "내부",
              value: "inside",
            },
            {
              label: t("counterSetting.placementOutside") || "외부",
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
      <PropertyRow label={t("counterSetting.alignDirection") || "정렬 방향"}>
        <Dropdown
          options={[
            { label: t("counterSetting.alignTop") || "상단", value: "top" },
            {
              label: t("counterSetting.alignBottom") || "하단",
              value: "bottom",
            },
            { label: t("counterSetting.alignLeft") || "좌측", value: "left" },
            {
              label: t("counterSetting.alignRight") || "우측",
              value: "right",
            },
          ]}
          value={batchCounterSettings.align}
          onChange={(value) =>
            handleBatchCounterUpdate({
              align: value as "top" | "bottom" | "left" | "right",
            })
          }
        />
      </PropertyRow>

      {/* 간격 */}
      <PropertyRow label={t("counterSetting.gap") || "간격"}>
        <NumberInput
          value={batchCounterSettings.gap}
          onChange={(value) => handleBatchCounterUpdate({ gap: value })}
          suffix="px"
          min={0}
          max={100}
          width="54px"
        />
      </PropertyRow>

      <SectionDivider />

      {/* 채우기 색상 */}
      <PropertyRow label={t("counterSetting.fill") || "채우기"}>
        <div className="flex items-center gap-[4px]">
          <button
            ref={batchCounterFillIdleButtonRef}
            onClick={onFillIdlePickerToggle}
            className="relative px-[7px] h-[23px] bg-[#2A2A30] rounded-[7px] border-[1px] border-[#3A3943] flex items-center justify-center text-[#DBDEE8] text-style-4"
          >
            <div
              className="absolute left-[6px] top-[4.5px] w-[11px] h-[11px] rounded-[2px] border border-[#3A3943]"
              style={{
                backgroundColor: getCounterColorDisplay("fillIdle"),
              }}
            />
            <span className="ml-[16px] text-left">
              {t("counterSetting.idle") || "대기"}
            </span>
          </button>
          <button
            ref={batchCounterFillActiveButtonRef}
            onClick={onFillActivePickerToggle}
            className="relative px-[7px] h-[23px] bg-[#2A2A30] rounded-[7px] border-[1px] border-[#3A3943] flex items-center justify-center text-[#DBDEE8] text-style-4"
          >
            <div
              className="absolute left-[6px] top-[4.5px] w-[11px] h-[11px] rounded-[2px] border border-[#3A3943]"
              style={{
                backgroundColor: getCounterColorDisplay("fillActive"),
              }}
            />
            <span className="ml-[16px] text-left">
              {t("counterSetting.active") || "입력"}
            </span>
          </button>
        </div>
      </PropertyRow>

      {/* 외곽선 색상 */}
      <PropertyRow label={t("counterSetting.stroke") || "외곽선"}>
        <div className="flex items-center gap-[4px]">
          <button
            ref={batchCounterStrokeIdleButtonRef}
            onClick={onStrokeIdlePickerToggle}
            className="relative px-[7px] h-[23px] bg-[#2A2A30] rounded-[7px] border-[1px] border-[#3A3943] flex items-center justify-center text-[#DBDEE8] text-style-4"
          >
            <div
              className="absolute left-[6px] top-[4.5px] w-[11px] h-[11px] rounded-[2px] border border-[#3A3943]"
              style={{
                backgroundColor: getCounterColorDisplay("strokeIdle"),
              }}
            />
            <span className="ml-[16px] text-left">
              {t("counterSetting.idle") || "대기"}
            </span>
          </button>
          <button
            ref={batchCounterStrokeActiveButtonRef}
            onClick={onStrokeActivePickerToggle}
            className="relative px-[7px] h-[23px] bg-[#2A2A30] rounded-[7px] border-[1px] border-[#3A3943] flex items-center justify-center text-[#DBDEE8] text-style-4"
          >
            <div
              className="absolute left-[6px] top-[4.5px] w-[11px] h-[11px] rounded-[2px] border border-[#3A3943]"
              style={{
                backgroundColor: getCounterColorDisplay("strokeActive"),
              }}
            />
            <span className="ml-[16px] text-left">
              {t("counterSetting.active") || "입력"}
            </span>
          </button>
        </div>
      </PropertyRow>

      <SectionDivider />

      {/* 폰트 크기 */}
      <PropertyRow label={t("counterSetting.fontSize") || "폰트 크기"}>
        <NumberInput
          value={batchCounterSettings.fontSize ?? 16}
          onChange={(value) => handleBatchCounterUpdate({ fontSize: value })}
          suffix="px"
          min={8}
          max={72}
          width="54px"
        />
      </PropertyRow>

      {/* 폰트 스타일 */}
      <PropertyRow label={t("counterSetting.fontStyle") || "폰트 스타일"}>
        <FontStyleToggle
          isBold={(batchCounterSettings.fontWeight ?? 800) >= 700}
          isItalic={batchCounterSettings.fontItalic ?? false}
          isUnderline={batchCounterSettings.fontUnderline ?? false}
          isStrikethrough={batchCounterSettings.fontStrikethrough ?? false}
          onBoldChange={(value) =>
            handleBatchCounterUpdate({ fontWeight: value ? 800 : 400 })
          }
          onItalicChange={(value) => handleBatchCounterUpdate({ fontItalic: value })}
          onUnderlineChange={(value) =>
            handleBatchCounterUpdate({ fontUnderline: value })
          }
          onStrikethroughChange={(value) =>
            handleBatchCounterUpdate({ fontStrikethrough: value })
          }
        />
      </PropertyRow>
    </>
  );
};

export default BatchCounterTabContent;
