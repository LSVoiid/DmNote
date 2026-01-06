import React, { useState, useRef, useCallback, useEffect } from "react";
import type { StyleTabContentProps } from "./types";
import type { ImageFit, KeyPosition } from "@src/types/keys";
import {
  PropertyRow,
  NumberInput,
  TextInput,
  ColorInput,
  SelectInput,
  ToggleSwitch,
  FontStyleToggle,
  SectionDivider,
} from "./PropertyInputs";
import ImagePicker from "../../Modal/content/ImagePicker";

interface StyleTabContentInternalProps extends StyleTabContentProps {
  // 로컬 상태 (단일 선택 시에만 사용, 개별 편집 모드에서는 사용하지 않음)
  localDx?: number;
  localDy?: number;
  localWidth?: number;
  localHeight?: number;
  onLocalDxChange?: (value: number) => void;
  onLocalDyChange?: (value: number) => void;
  onLocalWidthChange?: (value: number) => void;
  onLocalHeightChange?: (value: number) => void;
  onSizeBlur?: () => void;
}

const StyleTabContent: React.FC<StyleTabContentInternalProps> = ({
  keyIndex,
  keyPosition,
  keyCode,
  keyInfo,
  onPositionChange,
  onKeyUpdate,
  onKeyPreview,
  onKeyMappingChange,
  isListening = false,
  onKeyListen,
  showImagePicker = false,
  onToggleImagePicker,
  imageButtonRef,
  useCustomCSS = false,
  t,
  // 로컬 상태
  localDx,
  localDy,
  localWidth,
  localHeight,
  onLocalDxChange,
  onLocalDyChange,
  onLocalWidthChange,
  onLocalHeightChange,
  onSizeBlur,
}) => {
  // 개별 편집 모드인지 확인 (로컬 상태 핸들러가 없으면 개별 편집 모드)
  const isIndividualMode = !onLocalDxChange;

  // 위치 변경 핸들러
  const handlePositionXChange = useCallback(
    (value: number) => {
      if (onLocalDxChange) {
        onLocalDxChange(value);
      }
      onPositionChange(keyIndex, value, localDy ?? keyPosition.dy);
    },
    [keyIndex, localDy, keyPosition.dy, onPositionChange, onLocalDxChange]
  );

  const handlePositionYChange = useCallback(
    (value: number) => {
      if (onLocalDyChange) {
        onLocalDyChange(value);
      }
      onPositionChange(keyIndex, localDx ?? keyPosition.dx, value);
    },
    [keyIndex, localDx, keyPosition.dx, onPositionChange, onLocalDyChange]
  );

  // 크기 변경 핸들러
  const handleWidthChange = useCallback(
    (value: number) => {
      if (onLocalWidthChange) {
        onLocalWidthChange(value);
        onKeyPreview?.(keyIndex, { width: value });
      } else {
        onKeyUpdate({ index: keyIndex, width: value });
      }
    },
    [keyIndex, onKeyPreview, onKeyUpdate, onLocalWidthChange]
  );

  const handleHeightChange = useCallback(
    (value: number) => {
      if (onLocalHeightChange) {
        onLocalHeightChange(value);
        onKeyPreview?.(keyIndex, { height: value });
      } else {
        onKeyUpdate({ index: keyIndex, height: value });
      }
    },
    [keyIndex, onKeyPreview, onKeyUpdate, onLocalHeightChange]
  );

  // 스타일 변경 핸들러
  const handleStyleChange = useCallback(
    (property: keyof KeyPosition, value: any) => {
      onKeyPreview?.(keyIndex, { [property]: value });
    },
    [keyIndex, onKeyPreview]
  );

  const handleStyleChangeComplete = useCallback(
    (property: keyof KeyPosition, value: any) => {
      onKeyUpdate({ index: keyIndex, [property]: value });
    },
    [keyIndex, onKeyUpdate]
  );

  // 이미지 변경 핸들러
  const handleIdleImageChange = useCallback(
    (imageUrl: string) => {
      onKeyPreview?.(keyIndex, { inactiveImage: imageUrl });
      onKeyUpdate({ index: keyIndex, inactiveImage: imageUrl });
    },
    [keyIndex, onKeyPreview, onKeyUpdate]
  );

  const handleActiveImageChange = useCallback(
    (imageUrl: string) => {
      onKeyPreview?.(keyIndex, { activeImage: imageUrl });
      onKeyUpdate({ index: keyIndex, activeImage: imageUrl });
    },
    [keyIndex, onKeyPreview, onKeyUpdate]
  );

  const handleIdleTransparentChange = useCallback(
    (checked: boolean) => {
      onKeyPreview?.(keyIndex, { idleTransparent: checked });
      onKeyUpdate({ index: keyIndex, idleTransparent: checked });
    },
    [keyIndex, onKeyPreview, onKeyUpdate]
  );

  const handleActiveTransparentChange = useCallback(
    (checked: boolean) => {
      onKeyPreview?.(keyIndex, { activeTransparent: checked });
      onKeyUpdate({ index: keyIndex, activeTransparent: checked });
    },
    [keyIndex, onKeyPreview, onKeyUpdate]
  );

  const handleIdleImageReset = useCallback(() => {
    onKeyPreview?.(keyIndex, { inactiveImage: "" });
    onKeyUpdate({ index: keyIndex, inactiveImage: "" });
  }, [keyIndex, onKeyPreview, onKeyUpdate]);

  const handleActiveImageReset = useCallback(() => {
    onKeyPreview?.(keyIndex, { activeImage: "" });
    onKeyUpdate({ index: keyIndex, activeImage: "" });
  }, [keyIndex, onKeyPreview, onKeyUpdate]);

  // 표시 텍스트 핸들러
  const handleDisplayTextChange = useCallback(
    (value: string) => {
      onKeyPreview?.(keyIndex, { displayText: value });
    },
    [keyIndex, onKeyPreview]
  );

  const handleDisplayTextBlur = useCallback(() => {
    onKeyUpdate({ index: keyIndex, displayText: keyPosition.displayText || "" });
  }, [keyIndex, keyPosition.displayText, onKeyUpdate]);

  // 클래스명 핸들러
  const handleClassNameChange = useCallback(
    (value: string) => {
      onKeyPreview?.(keyIndex, { className: value });
    },
    [keyIndex, onKeyPreview]
  );

  const handleClassNameBlur = useCallback(() => {
    onKeyUpdate({ index: keyIndex, className: keyPosition.className || "" });
  }, [keyIndex, keyPosition.className, onKeyUpdate]);

  return (
    <>
      {/* 키 매핑 - 단일 선택 모드에서만 표시 */}
      {onKeyListen && (
        <PropertyRow label={t("propertiesPanel.keyMapping") || "키 매핑"}>
          <button
            onClick={onKeyListen}
            className={`flex items-center justify-center h-[23px] min-w-[0px] px-[8.5px] bg-[#2A2A30] rounded-[7px] border-[1px] ${
              isListening ? "border-[#459BF8]" : "border-[#3A3943]"
            } text-[#DBDEE8] text-style-2`}
          >
            {isListening
              ? t("propertiesPanel.pressAnyKey") || "Press any key"
              : keyInfo?.displayName || t("propertiesPanel.clickToSet") || "Click to set"}
          </button>
        </PropertyRow>
      )}

      {/* 표시 텍스트 */}
      <PropertyRow label={t("propertiesPanel.displayText") || "표시 텍스트"}>
        <TextInput
          value={keyPosition.displayText || ""}
          onChange={handleDisplayTextChange}
          onBlur={handleDisplayTextBlur}
          placeholder={keyInfo?.displayName || t("propertiesPanel.displayTextPlaceholder") || "Custom text"}
          width="90px"
        />
      </PropertyRow>

      <SectionDivider />
      
      {/* 위치 */}
      <PropertyRow label={t("propertiesPanel.position") || "위치"}>
        <NumberInput
          value={isIndividualMode ? keyPosition.dx : (localDx ?? keyPosition.dx)}
          onChange={handlePositionXChange}
          prefix="X"
          min={-9999}
          max={9999}
        />
        <NumberInput
          value={isIndividualMode ? keyPosition.dy : (localDy ?? keyPosition.dy)}
          onChange={handlePositionYChange}
          prefix="Y"
          min={-9999}
          max={9999}
        />
      </PropertyRow>

      {/* 크기 */}
      <PropertyRow label={t("propertiesPanel.size") || "크기"}>
        <NumberInput
          value={isIndividualMode ? (keyPosition.width ?? 60) : (localWidth ?? keyPosition.width ?? 60)}
          onChange={handleWidthChange}
          onBlur={onSizeBlur}
          prefix="W"
          min={1}
          max={999}
        />
        <NumberInput
          value={isIndividualMode ? (keyPosition.height ?? 60) : (localHeight ?? keyPosition.height ?? 60)}
          onChange={handleHeightChange}
          onBlur={onSizeBlur}
          prefix="H"
          min={1}
          max={999}
        />
      </PropertyRow>

      <SectionDivider />

      {/* 커스텀 이미지 - 단일 선택 모드에서만 표시 */}
      {onToggleImagePicker && imageButtonRef && (
        <>
          <PropertyRow label={t("propertiesPanel.customImage") || "커스텀 이미지"}>
            <button
              ref={imageButtonRef}
              type="button"
              className={`px-[7px] h-[23px] bg-[#2A2A30] rounded-[7px] border-[1px] flex items-center justify-center ${
                showImagePicker ? "border-[#459BF8]" : "border-[#3A3943]"
              } text-[#DBDEE8] text-style-4`}
              onClick={onToggleImagePicker}
            >
              {t("propertiesPanel.configure") || "설정하기"}
            </button>
          </PropertyRow>

          <SectionDivider />
        </>
      )}

      {/* 배경색 */}
      <PropertyRow label={t("propertiesPanel.backgroundColor") || "배경색"}>
        <ColorInput
          value={keyPosition.backgroundColor || "#2E2E2F"}
          onChange={(color) => handleStyleChange("backgroundColor", color)}
          onChangeComplete={(color) => handleStyleChangeComplete("backgroundColor", color)}
        />
      </PropertyRow>

      {/* 테두리 색상 */}
      <PropertyRow label={t("propertiesPanel.borderColor") || "테두리 색상"}>
        <ColorInput
          value={keyPosition.borderColor || "#717171"}
          onChange={(color) => handleStyleChange("borderColor", color)}
          onChangeComplete={(color) => handleStyleChangeComplete("borderColor", color)}
        />
      </PropertyRow>

      {/* 테두리 두께 */}
      <PropertyRow label={t("propertiesPanel.borderWidth") || "테두리 두께"}>
        <NumberInput
          value={keyPosition.borderWidth ?? 3}
          onChange={(value) => handleStyleChangeComplete("borderWidth", value)}
          suffix="px"
          min={0}
          max={20}
        />
      </PropertyRow>

      {/* 모서리 반경 */}
      <PropertyRow label={t("propertiesPanel.borderRadius") || "모서리 반경"}>
        <NumberInput
          value={keyPosition.borderRadius ?? 10}
          onChange={(value) => handleStyleChangeComplete("borderRadius", value)}
          suffix="px"
          min={0}
          max={100}
        />
      </PropertyRow>

      <SectionDivider />

      {/* 글꼴 크기 */}
      <PropertyRow label={t("propertiesPanel.fontSize") || "글꼴 크기"}>
        <NumberInput
          value={keyPosition.fontSize ?? 14}
          onChange={(value) => handleStyleChangeComplete("fontSize", value)}
          suffix="px"
          min={8}
          max={72}
        />
      </PropertyRow>

      {/* 글꼴 색상 */}
      <PropertyRow label={t("propertiesPanel.fontColor") || "글꼴 색상"}>
        <ColorInput
          value={keyPosition.fontColor || "#717171"}
          onChange={(color) => handleStyleChange("fontColor", color)}
          onChangeComplete={(color) => handleStyleChangeComplete("fontColor", color)}
        />
      </PropertyRow>

      {/* 글꼴 스타일 */}
      <PropertyRow label={t("propertiesPanel.fontStyle") || "글꼴 스타일"}>
        <FontStyleToggle
          isBold={(keyPosition.fontWeight ?? 700) >= 700}
          isItalic={keyPosition.fontItalic ?? false}
          isUnderline={keyPosition.fontUnderline ?? false}
          isStrikethrough={keyPosition.fontStrikethrough ?? false}
          onBoldChange={(value) => handleStyleChangeComplete("fontWeight", value ? 700 : 400)}
          onItalicChange={(value) => handleStyleChangeComplete("fontItalic", value)}
          onUnderlineChange={(value) => handleStyleChangeComplete("fontUnderline", value)}
          onStrikethroughChange={(value) => handleStyleChangeComplete("fontStrikethrough", value)}
        />
      </PropertyRow>

      {/* 이미지가 있을 때만 이미지 맞춤 옵션 표시 */}
      {(keyPosition.activeImage || keyPosition.inactiveImage) && (
        <>
          <SectionDivider />
          <PropertyRow label={t("propertiesPanel.imageFit") || "이미지 맞춤"}>
            <SelectInput
              value={keyPosition.imageFit || "cover"}
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
              value={keyPosition.className || ""}
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
              checked={keyPosition.useInlineStyles ?? false}
              onChange={(checked) => handleStyleChangeComplete("useInlineStyles", checked)}
            />
          </div>
          <p className="text-[#6B6D75] text-[10px] mt-[-4px]">
            {t("propertiesPanel.useInlineStylesHint") || "활성화 시 커스텀 CSS보다 속성 패널 스타일이 우선 적용됩니다."}
          </p>
        </>
      )}

      {/* 이미지 픽커 팝업 - 단일 선택 모드에서만 */}
      {showImagePicker && onToggleImagePicker && imageButtonRef && (
        <ImagePicker
          open={showImagePicker}
          referenceRef={imageButtonRef}
          idleImage={keyPosition.inactiveImage || ""}
          activeImage={keyPosition.activeImage || ""}
          idleTransparent={keyPosition.idleTransparent ?? false}
          activeTransparent={keyPosition.activeTransparent ?? false}
          onIdleImageChange={handleIdleImageChange}
          onActiveImageChange={handleActiveImageChange}
          onIdleTransparentChange={handleIdleTransparentChange}
          onActiveTransparentChange={handleActiveTransparentChange}
          onIdleImageReset={handleIdleImageReset}
          onActiveImageReset={handleActiveImageReset}
          onClose={() => onToggleImagePicker()}
        />
      )}
    </>
  );
};

export default StyleTabContent;
