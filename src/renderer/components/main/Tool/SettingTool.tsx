import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import FolderIcon from "@assets/svgs/folder.svg";
import SettingIcon from "@assets/svgs/setting.svg";
import CloseEyeIcon from "@assets/svgs/close_eye.svg";
import OpenEyeIcon from "@assets/svgs/open_eye.svg";
import ChevronDownIcon from "@assets/svgs/chevron-down.svg";
import TurnIcon from "@assets/svgs/turn_arrow.svg";
import FloatingTooltip from "../modal/FloatingTooltip";
import ListPopup, { ListItem } from "../modal/ListPopup";
import { TooltipGroup } from "../modal/TooltipGroup";
import { useSettingsStore } from "@stores/useSettingsStore";

type SettingToolProps = {
  isSettingsOpen?: boolean;
  onOpenSettings?: () => void;
  onCloseSettings?: () => void;
  showAlert?: (message: string) => void;
  onOpenNoteSetting?: () => void;
  onOpenLaboratory?: () => void;
};

const SettingTool = ({
  isSettingsOpen = false,
  onOpenSettings,
  onCloseSettings,
  showAlert,
  onOpenNoteSetting,
  onOpenLaboratory,
}: SettingToolProps) => {
  const { t } = useTranslation();
  const [isOverlayVisible, setIsOverlayVisible] = useState(true);
  const [isExportImportOpen, setIsExportImportOpen] = useState(false);
  const [isExtrasOpen, setIsExtrasOpen] = useState(false);
  const exportImportRef = useRef<HTMLButtonElement | null>(null);
  const extrasRef = useRef<HTMLButtonElement | null>(null);
  const { noteEffect, laboratoryEnabled } = useSettingsStore();
  const menuItems: ListItem[] = [];
  
  if (laboratoryEnabled) {
    menuItems.push({ id: "lab", label: t("tooltip.laboratory") });
  }
  if (noteEffect) {
    menuItems.push({ id: "note", label: t("tooltip.noteSettings") });
  }

  useEffect(() => {
    const ipc = window.electron.ipcRenderer;
    ipc.invoke("get-overlay-visibility").then((visible) => {
      setIsOverlayVisible(visible);
    });

    const handleVisibilityChange = (_, visible) => {
      setIsOverlayVisible(visible);
    };

    ipc.on("overlay-visibility-changed", handleVisibilityChange);

    return () => {
      ipc.removeListener("overlay-visibility-changed", handleVisibilityChange);
    };
  }, []);

  const toggleOverlay = () => {
    const newState = !isOverlayVisible;
    setIsOverlayVisible(newState);
    window.electron.ipcRenderer.send("toggle-overlay", newState);
  };

  return (
    <div className="flex gap-[10px]">
      {!isSettingsOpen && (
        <TooltipGroup>
          <div className="flex items-center h-[40px] p-[5px] bg-button-primary rounded-[7px] gap-[0px]">
            <FloatingTooltip content={t("tooltip.exportPreset")}>
              <Button
                icon={<FolderIcon />}
                onClick={async () => {
                  try {
                    const ok = await window.electron.ipcRenderer.invoke(
                      "save-preset"
                    );
                    if (showAlert) {
                      showAlert(
                        ok ? t("preset.saveSuccess") : t("preset.saveFail")
                      );
                    }
                  } catch {
                    showAlert?.(t("preset.saveFail"));
                  }
                }}
              />
            </FloatingTooltip>

            <FloatingTooltip
              content={t("tooltip.importExport")}
              disabled={isExportImportOpen}
            >
              <ChevronButton
                ref={exportImportRef}
                isSelected={isExportImportOpen}
                onClick={() => setIsExportImportOpen((prev) => !prev)}
              />
            </FloatingTooltip>
            <div className="relative">
              <ListPopup
                open={isExportImportOpen}
                referenceRef={exportImportRef}
                onClose={() => setIsExportImportOpen(false)}
                items={[
                  { id: "import", label: t("preset.import") },
                  { id: "export", label: t("preset.export") },
                ]}
                onSelect={async (id) => {
                  try {
                    if (id === "import") {
                      const ok = await window.electron.ipcRenderer.invoke(
                        "load-preset"
                      );
                      showAlert?.(
                        ok ? t("preset.loadSuccess") : t("preset.loadFail")
                      );
                    } else if (id === "export") {
                      const ok = await window.electron.ipcRenderer.invoke(
                        "save-preset"
                      );
                      showAlert?.(
                        ok ? t("preset.saveSuccess") : t("preset.saveFail")
                      );
                    }
                  } catch {
                    if (id === "import") showAlert?.(t("preset.loadFail"));
                    else if (id === "export") showAlert?.(t("preset.saveFail"));
                  }
                }}
              />
            </div>
          </div>
        </TooltipGroup>
      )}
      <TooltipGroup>
        <div className="flex items-center h-[40px] p-[5px] bg-button-primary rounded-[7px] gap-[5px]">
          <FloatingTooltip
            content={
              isOverlayVisible
                ? t("tooltip.overlayClose")
                : t("tooltip.overlayOpen")
            }
          >
            <Button
              icon={isOverlayVisible ? <CloseEyeIcon /> : <OpenEyeIcon />}
              onClick={toggleOverlay}
            />
          </FloatingTooltip>
          <div className="flex items-center">
            <FloatingTooltip
              content={
                isSettingsOpen ? t("tooltip.back") : t("tooltip.settings")
              }
            >
              <Button
                icon={isSettingsOpen ? <TurnIcon /> : <SettingIcon />}
                onClick={isSettingsOpen ? onCloseSettings : onOpenSettings}
              />
            </FloatingTooltip>
            {noteEffect && menuItems.length > 0 && (
              <>
                <FloatingTooltip
                  content={t("tooltip.etcSettings")}
                  disabled={isExtrasOpen}
                >
                  <ChevronButton
                    ref={extrasRef}
                    isSelected={isExtrasOpen}
                    onClick={() => setIsExtrasOpen((prev) => !prev)}
                  />
                </FloatingTooltip>
                <div className="relative">
                  <ListPopup
                    open={isExtrasOpen}
                    referenceRef={extrasRef}
                    onClose={() => setIsExtrasOpen(false)}
                    items={menuItems}
                    onSelect={(id) => {
                      if (id === "lab") {
                        onOpenLaboratory?.();
                      } else if (id === "note") {
                        onOpenNoteSetting?.();
                      }
                    }}
                    offsetX={-10}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </TooltipGroup>
    </div>
  );
};

interface ButtonProps {
  icon: React.ReactNode;
  isSelected?: boolean;
  onClick?: () => void;
}

const Button = ({ icon, isSelected = false, onClick }: ButtonProps) => {
  return (
    <button
      type="button"
      className={`flex items-center justify-center h-[30px] w-[30px] rounded-[7px] transition-colors active:bg-button-active ${
        isSelected
          ? "bg-button-active"
          : "bg-button-primary hover:bg-button-hover"
      }`}
      onClick={onClick}
    >
      {icon}
    </button>
  );
};

interface ChevronButtonProps {
  isSelected?: boolean;
  onClick?: () => void;
}

const ChevronButton = React.forwardRef<HTMLButtonElement, ChevronButtonProps>(
  ({ isSelected = false, onClick }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={`flex items-center justify-center h-[30px] w-[14px] rounded-[7px] transition-colors active:bg-button-active ${
          isSelected
            ? "bg-button-active hover:bg-button-active"
            : "bg-button-primary hover:bg-button-hover"
        }`}
        onClick={onClick}
      >
        <ChevronDownIcon />
      </button>
    );
  }
);

export default SettingTool;
