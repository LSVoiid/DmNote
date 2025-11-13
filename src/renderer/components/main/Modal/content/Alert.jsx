import React from "react";
import { useTranslation } from "@contexts/I18nContext";
import Modal from "../Modal";

export default function Alert({
  isOpen,
  message,
  type = "alert", // "alert", "confirm", or "custom"
  confirmText,
  cancelText,
  showCancel,
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null;

  const { t } = useTranslation();
  const confirmLabel = confirmText || t("common.confirm");
  const cancelLabel = cancelText || t("common.cancel");

  const isConfirm = type === "confirm";
  const isCustom = type === "custom";
  const shouldShowCancel = isConfirm || (isCustom && showCancel);

  return (
    <Modal onClick={onCancel}>
      <div
        className="flex flex-col justify-between p-[20px] gap-[19px] bg-[#1A191E] rounded-[13px] border-[1px] border-[#2A2A30]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 메시지 텍스트 or Custom HTML */}
        {isCustom ? (
          <div
            className="text-center text-[#FFFFFF]"
            dangerouslySetInnerHTML={{ __html: message }}
          />
        ) : (
          <div className="max-w-[235.5px] text-center text-[#FFFFFF] text-style-3 !leading-[20px]">
            {message}
          </div>
        )}

        {/* 버튼들 */}
        <div
          className={`flex ${
            !shouldShowCancel ? "justify-center" : ""
          } gap-[10.5px]`}
        >
          <button
            onClick={onConfirm}
            className={`w-${
              shouldShowCancel ? "[150px]" : "full"
            } h-[30px] bg-[#2A2A30] hover:bg-[#303036] active:bg-[#393941] rounded-[7px] text-[#DCDEE7] text-style-3`}
          >
            {confirmLabel}
          </button>
          {shouldShowCancel && (
            <button
              onClick={onCancel}
              className="w-[75px] h-[30px] bg-[#3C1E1E] hover:bg-[#442222] active:bg-[#522929] rounded-[7px] text-[#E6DBDB] text-style-3"
            >
              {cancelLabel}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
