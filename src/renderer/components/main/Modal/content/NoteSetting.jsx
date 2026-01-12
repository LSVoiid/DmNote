import React, { useState } from "react";
import Checkbox from "@components/main/common/Checkbox";
import Dropdown from "@components/main/common/Dropdown";
import Modal from "../Modal";
import { useTranslation } from "@contexts/I18nContext";
import {
  NOTE_SETTINGS_CONSTRAINTS,
  clampValue,
} from "../../../../../types/noteSettingsConstraints";

export default function NoteSetting({ onClose, settings, onSave }) {
  const { t } = useTranslation();
  const initial = settings || {};
  const [speed, setSpeed] = useState(
    Number.isFinite(Number(initial.speed)) ? Number(initial.speed) : 180
  );
  const [trackHeight, setTrackHeight] = useState(
    Number.isFinite(Number(initial.trackHeight))
      ? Number(initial.trackHeight)
      : 150
  );
  const [reverse, setReverse] = useState(Boolean(initial.reverse || false));
  const [fadePosition, setFadePosition] = useState(
    initial.fadePosition || "auto"
  );

  const fadeOptions = [
    { label: t("noteSetting.auto"), value: "auto" },
    { label: t("noteSetting.top"), value: "top" },
    { label: t("noteSetting.bottom"), value: "bottom" },
  ];

  const handleSave = async () => {
    const normalized = {
      ...settings,
      speed: clampValue(
        parseInt(speed || NOTE_SETTINGS_CONSTRAINTS.speed.default),
        "speed"
      ),
      trackHeight: clampValue(
        parseInt(trackHeight || NOTE_SETTINGS_CONSTRAINTS.trackHeight.default),
        "trackHeight"
      ),
      reverse,
      fadePosition,
    };
    try {
      await onSave?.(normalized);
      onClose?.();
    } catch (e) {
      onClose?.();
    }
  };

  return (
    <Modal onClick={onClose}>
      <div
        className="flex flex-col items-center justify-center p-[20px] bg-[#1A191E] rounded-[13px] gap-[19px] border-[1px] border-[#2A2A30]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between w-full items-center">
          <p className="text-white text-style-2">{t("noteSetting.speed")}</p>
          <input
            type="number"
            min={NOTE_SETTINGS_CONSTRAINTS.speed.min}
            max={NOTE_SETTINGS_CONSTRAINTS.speed.max}
            value={speed}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "") {
                setSpeed("");
              } else {
                const num = parseInt(v);
                if (!Number.isNaN(num) && num >= 0) {
                  setSpeed(num);
                }
              }
            }}
            onBlur={(e) => {
              if (e.target.value === "" || isNaN(parseInt(e.target.value))) {
                setSpeed(NOTE_SETTINGS_CONSTRAINTS.speed.default);
              } else {
                const num = parseInt(e.target.value);
                setSpeed(clampValue(num, "speed"));
              }
            }}
            className="text-center w-[47px] h-[23px] bg-[#2A2A30] rounded-[7px] border-[1px] border-[#3A3943] focus:border-[#459BF8] text-style-4 text-[#DBDEE8]"
          />
        </div>

        <div className="flex justify-between w-full items-center">
          <p className="text-white text-style-2">
            {t("noteSetting.trackHeight")}
          </p>
          <input
            type="number"
            min={NOTE_SETTINGS_CONSTRAINTS.trackHeight.min}
            max={NOTE_SETTINGS_CONSTRAINTS.trackHeight.max}
            value={trackHeight}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "") {
                setTrackHeight("");
              } else {
                const num = parseInt(v);
                if (!Number.isNaN(num) && num >= 0) {
                  setTrackHeight(num);
                }
              }
            }}
            onBlur={(e) => {
              if (e.target.value === "" || isNaN(parseInt(e.target.value))) {
                setTrackHeight(NOTE_SETTINGS_CONSTRAINTS.trackHeight.default);
              } else {
                const num = parseInt(e.target.value);
                setTrackHeight(clampValue(num, "trackHeight"));
              }
            }}
            className="text-center w-[47px] h-[23px] bg-[#2A2A30] rounded-[7px] border-[1px] border-[#3A3943] focus:border-[#459BF8] text-style-4 text-[#DBDEE8]"
          />
        </div>

        <div className="flex justify-between w-full items-center">
          <p className="text-white text-style-2">
            {t("noteSetting.fadePosition")}
          </p>
          <Dropdown
            options={fadeOptions}
            value={fadePosition}
            onChange={setFadePosition}
            placeholder={t("noteSetting.select")}
          />
        </div>

        <div className="flex justify-between w-full items-center">
          <p className="text-white text-style-2">
            {t("noteSetting.reverseEffect")}
          </p>
          <Checkbox checked={reverse} onChange={() => setReverse(!reverse)} />
        </div>

        <div className="flex gap-[10.5px]">
          <button
            onClick={handleSave}
            className="w-[150px] h-[30px] bg-[#2A2A30] hover:bg-[#303036] active:bg-[#393941] rounded-[7px] text-[#DCDEE7] text-style-3"
          >
            {t("noteSetting.save")}
          </button>
          <button
            onClick={onClose}
            className="w-[75px] h-[30px] bg-[#3C1E1E] hover:bg-[#442222] active:bg-[#522929] rounded-[7px] text-[#E6DBDB] text-style-3"
          >
            {t("noteSetting.cancel")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
