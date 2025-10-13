import React, { useEffect, useMemo, useRef, useState } from "react";
import Modal from "../Modal";
import Dropdown from "@components/main/common/Dropdown";
import ColorPicker from "./ColorPicker";
import { useTranslation } from "@contexts/I18nContext";
import {
  createDefaultCounterSettings,
  normalizeCounterSettings,
} from "@src/types/keys";

export default function CounterSettingModal({
  onClose,
  onSave,
  initialSettings,
  keyName,
}) {
  const { t } = useTranslation();

  const resolvedSettings = useMemo(
    () =>
      normalizeCounterSettings(
        initialSettings ?? createDefaultCounterSettings()
      ),
    [initialSettings]
  );

  const [placement, setPlacement] = useState(resolvedSettings.placement);
  const [align, setAlign] = useState(resolvedSettings.align);

  const [fillIdle, setFillIdle] = useState(resolvedSettings.fill.idle);
  const [fillActive, setFillActive] = useState(resolvedSettings.fill.active);
  const [strokeIdle, setStrokeIdle] = useState(resolvedSettings.stroke.idle);
  const [strokeActive, setStrokeActive] = useState(
    resolvedSettings.stroke.active
  );

  useEffect(() => {
    setPlacement(resolvedSettings.placement);
    setAlign(resolvedSettings.align);
    setFillIdle(resolvedSettings.fill.idle);
    setFillActive(resolvedSettings.fill.active);
    setStrokeIdle(resolvedSettings.stroke.idle);
    setStrokeActive(resolvedSettings.stroke.active);
    setPickerOpen(false);
    setPickerFor(null);
  }, [resolvedSettings]);

  const [pickerFor, setPickerFor] = useState(null); // 'fillIdle' | 'fillActive' | 'strokeIdle' | 'strokeActive'
  const [pickerOpen, setPickerOpen] = useState(false);

  const fillIdleBtnRef = useRef(null);
  const fillActiveBtnRef = useRef(null);
  const strokeIdleBtnRef = useRef(null);
  const strokeActiveBtnRef = useRef(null);
  const fillGroupRef = useRef(null);
  const strokeGroupRef = useRef(null);

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

  const placementOptions = [
    { label: t("counterSetting.placementInside"), value: "inside" },
    { label: t("counterSetting.placementOutside"), value: "outside" },
  ];

  const alignOptions = [
    { label: t("counterSetting.alignTop"), value: "top" },
    { label: t("counterSetting.alignBottom"), value: "bottom" },
    { label: t("counterSetting.alignLeft"), value: "left" },
    { label: t("counterSetting.alignRight"), value: "right" },
  ];

  const colorButtonClass = (active) =>
    `relative w-[80px] h-[23px] bg-[#2A2A30] rounded-[7px] border-[1px] flex items-center justify-center ${
      active ? "border-[#459BF8]" : "border-[#3A3943]"
    } text-[#DBDEE8] text-style-2`;

  const renderColorSquare = (style) => (
    <div
      className="absolute left-[6px] top-[4.5px] w-[11px] h-[11px] rounded-[2px] border border-[#3A3943]"
      style={style}
    />
  );

  const closePicker = () => {
    setPickerOpen(false);
    setPickerFor(null);
  };

  const referenceRefFor = () => {
    // 항상 "채우기 위치에 고정 앵커
    return fillActiveBtnRef;
  };

  const colorValueFor = (key) => {
    switch (key) {
      case "fillIdle":
        return fillIdle;
      case "fillActive":
        return fillActive;
      case "strokeIdle":
        return strokeIdle;
      case "strokeActive":
        return strokeActive;
      default:
        return "#FFFFFF";
    }
  };

  const setColorFor = (key, color) => {
    switch (key) {
      case "fillIdle":
        setFillIdle(color);
        break;
      case "fillActive":
        setFillActive(color);
        break;
      case "strokeIdle":
        setStrokeIdle(color);
        break;
      case "strokeActive":
        setStrokeActive(color);
        break;
      default:
        break;
    }
  };

  const handleColorToggle = (target) => {
    if (pickerOpen && pickerFor === target) {
      closePicker();
    } else {
      setPickerFor(target);
      setPickerOpen(true);
    }
  };

  const handleApply = () => {
    const payload = {
      placement,
      align,
      fill: {
        idle: fillIdle,
        active: fillActive,
      },
      stroke: {
        idle: strokeIdle,
        active: strokeActive,
      },
    };
    if (typeof onSave === "function") {
      onSave(normalizeCounterSettings(payload));
    }
  };

  return (
    <Modal onClick={onClose}>
      <div
        className="flex flex-col items-center justify-center p-[20px] bg-[#1A191E] rounded-[13px] border-[1px] border-[#2A2A30] gap-[19px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 배치 영역 */}
        <div className="flex justify-between w-full items-center">
          <p className="text-white text-style-2">
            {t("counterSetting.placementArea")}
          </p>
          <Dropdown
            options={placementOptions}
            value={placement}
            onChange={setPlacement}
          />
        </div>

        {/* 정렬 방향 */}
        <div className="flex justify-between w-full items-center">
          <p className="text-white text-style-2">
            {t("counterSetting.alignDirection")}
          </p>
          <Dropdown options={alignOptions} value={align} onChange={setAlign} />
        </div>

        {/* 채우기 */}
        <div className="flex justify-between w-full items-center">
          <p className="text-white text-style-2">{t("counterSetting.fill")}</p>
          <div ref={fillGroupRef} className="flex items-center gap-[8px]">
            <button
              ref={fillIdleBtnRef}
              type="button"
              className={colorButtonClass(
                pickerOpen && pickerFor === "fillIdle"
              )}
              onClick={() => handleColorToggle("fillIdle")}
            >
              {renderColorSquare({ backgroundColor: fillIdle })}
              <span className="ml-[16px] text-left">
                {t("counterSetting.idle")}
              </span>
            </button>
            <button
              ref={fillActiveBtnRef}
              type="button"
              className={colorButtonClass(
                pickerOpen && pickerFor === "fillActive"
              )}
              onClick={() => handleColorToggle("fillActive")}
            >
              {renderColorSquare({ backgroundColor: fillActive })}
              <span className="ml-[16px] text-left">
                {t("counterSetting.active")}
              </span>
            </button>
          </div>
        </div>

        {/* 외곽선 */}
        <div className="flex justify-between w-full items-center">
          <p className="text-white text-style-2">
            {t("counterSetting.stroke")}
          </p>
          <div ref={strokeGroupRef} className="flex items-center gap-[8px]">
            <button
              ref={strokeIdleBtnRef}
              type="button"
              className={colorButtonClass(
                pickerOpen && pickerFor === "strokeIdle"
              )}
              onClick={() => handleColorToggle("strokeIdle")}
            >
              {renderColorSquare({ backgroundColor: strokeIdle })}
              <span className="ml-[16px] text-left">
                {t("counterSetting.idle")}
              </span>
            </button>
            <button
              ref={strokeActiveBtnRef}
              type="button"
              className={colorButtonClass(
                pickerOpen && pickerFor === "strokeActive"
              )}
              onClick={() => handleColorToggle("strokeActive")}
            >
              {renderColorSquare({ backgroundColor: strokeActive })}
              <span className="ml-[16px] text-left">
                {t("counterSetting.active")}
              </span>
            </button>
          </div>
        </div>

        {/* 적용하기/취소 */}
        <div className="flex gap-[10.5px]">
          <button
            onClick={handleApply}
            className="w-[150px] h-[30px] bg-[#2A2A30] hover:bg-[#303036] active:bg-[#393941] rounded-[7px] text-[#DCDEE7] text-style-3"
          >
            {t("counterSetting.apply")}
          </button>
          <button
            onClick={onClose}
            className="w-[75px] h-[30px] bg-[#3C1E1E] hover:bg-[#442222] active:bg-[#522929] rounded-[7px] text-[#E6DBDB] text-style-3"
          >
            {t("counterSetting.cancel")}
          </button>
        </div>

        {pickerFor && (
          <ColorPicker
            open={pickerOpen}
            referenceRef={referenceRefFor()}
            color={colorValueFor(pickerFor)}
            onColorChange={(c) => setColorFor(pickerFor, c)}
            onClose={closePicker}
            solidOnly={true}
            interactiveRefs={colorPickerInteractiveRefs}
          />
        )}
      </div>
    </Modal>
  );
}
