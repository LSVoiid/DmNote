import React, { useState, useRef } from "react";
import { useTranslation } from "@contexts/I18nContext";
import FloatingPopup from "../FloatingPopup";
import Checkbox from "@components/main/common/Checkbox";

const STATE_MODES = {
  idle: "idle",
  active: "active",
};

export default function ImagePicker({
  open,
  referenceRef,
  idleImage,
  activeImage,
  idleTransparent,
  activeTransparent,
  onIdleImageChange,
  onActiveImageChange,
  onIdleTransparentChange,
  onActiveTransparentChange,
  onIdleImageReset,
  onActiveImageReset,
  onClose,
  interactiveRefs = [],
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState(STATE_MODES.idle);
  const idleInputRef = useRef(null);
  const activeInputRef = useRef(null);

  const handleImageSelect = (e, stateMode) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (stateMode === STATE_MODES.idle) {
          onIdleImageChange?.(event.target.result);
        } else {
          onActiveImageChange?.(event.target.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageClick = (stateMode) => {
    if (stateMode === STATE_MODES.idle) {
      idleInputRef.current?.click();
    } else {
      activeInputRef.current?.click();
    }
  };

  const handleReset = () => {
    if (mode === STATE_MODES.idle) {
      onIdleImageReset?.();
    } else {
      onActiveImageReset?.();
    }
  };

  const currentImage = mode === STATE_MODES.idle ? idleImage : activeImage;
  const currentTransparent =
    mode === STATE_MODES.idle ? idleTransparent : activeTransparent;
  const handleTransparentToggle = () => {
    if (mode === STATE_MODES.idle) {
      onIdleTransparentChange?.(!idleTransparent);
    } else {
      onActiveTransparentChange?.(!activeTransparent);
    }
  };

  return (
    <FloatingPopup
      open={open}
      referenceRef={referenceRef}
      placement="right-start"
      offset={32}
      offsetY={-93}
      className="z-50"
      interactiveRefs={interactiveRefs}
      onClose={onClose}
      autoClose={false}
    >
      <div className="flex flex-col p-[8px] gap-[8px] w-[146px] bg-[#1A191E] rounded-[13px] border-[1px] border-[#2A2A30]">
        {/* 모드 전환 버튼 */}
        <div className="flex gap-[6px] max-w-full">
          {[
            { key: STATE_MODES.idle, label: t("imagePicker.idle") },
            { key: STATE_MODES.active, label: t("imagePicker.active") },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              className={`flex-1 whitespace-nowrap px-[9px] h-[23px] rounded-[7px] text-style-4 text-[#DBDEE8] transition-colors ${
                mode === item.key
                  ? "bg-[#2E2D33] text-[#FFFFFF]"
                  : "hover:bg-[#303036] text-[#6F6E7A]"
              }`}
              onClick={() => setMode(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* 이미지 미리보기 영역 */}
        <div className="relative w-[129px] h-[64px] rounded-[7px] border-[1px] border-[#3A3943] overflow-hidden cursor-pointer group">
          {/* 투명 격자 배경 */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)",
              backgroundSize: "10px 10px",
              backgroundPosition: "0 0, 0 5px, 5px -5px, -5px 0px",
              backgroundColor: "#fff",
            }}
          />

          {/* 이미지 표시 */}
          {currentImage && !currentTransparent && (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${currentImage})` }}
            />
          )}

          {/* 호버 오버레이 */}
          <div
            className="absolute inset-0 bg-black opacity-0 group-hover:opacity-40 transition-opacity"
            onClick={() => handleImageClick(mode)}
          />

          {/* 숨겨진 파일 입력 */}
          <input
            type="file"
            accept="image/*"
            ref={idleInputRef}
            className="hidden"
            onChange={(e) => handleImageSelect(e, STATE_MODES.idle)}
          />
          <input
            type="file"
            accept="image/*"
            ref={activeInputRef}
            className="hidden"
            onChange={(e) => handleImageSelect(e, STATE_MODES.active)}
          />
        </div>

        {/* 구분선 */}
        <div className="h-[1px] bg-[#2A2A30] -mx-[8px]" />

        {/* 키 투명화 토글 */}
        <div className="flex justify-between items-center w-full">
          <p className="text-white text-style-2">
            {t("imagePicker.transparent")}
          </p>
          <Checkbox
            checked={currentTransparent}
            onChange={handleTransparentToggle}
          />
        </div>

        {/* 구분선 */}
        <div className="h-[1px] bg-[#2A2A30] -mx-[8px]" />

        {/* 이미지 초기화 버튼 */}
        <button
          onClick={handleReset}
          className="w-full h-[23px] bg-[#3C1E1E] hover:bg-[#442222] active:bg-[#522929] rounded-[7px] text-[#E6DBDB] text-style-2 transition-colors"
        >
          {t("imagePicker.reset")}
        </button>
      </div>
    </FloatingPopup>
  );
}
