import React from "react";
import Modal from "@components/main/Modal/Modal";
import Checkbox from "@components/main/common/Checkbox";
import TrashIcon from "@assets/svgs/trash.svg";

export function PluginManagerModal({
  isOpen,
  onClose,
  onAdd,
  onToggle,
  onRemove,
  plugins,
  isAdding,
  pendingPluginAction,
  t,
}) {
  if (!isOpen) return null;

  const localActionButtonClass = (enabled) =>
    "py-[4px] px-[8px] border-[1px] rounded-[7px] text-style-2 transition-colors " +
    (enabled
      ? "bg-[#2A2A31] border-[#3A3944] text-[#DBDEE8] hover:bg-[#34343c]"
      : "bg-[#222228] border-[#31303C] text-[#44464E] cursor-not-allowed");

  return (
    <Modal onClick={onClose}>
      <div
        className="flex flex-col w-[420px] max-h-[340px] bg-[#1A191E] rounded-[13px] border-[1px] border-[#2A2A30] p-[20px] gap-[16px]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-style-3 text-[#FFFFFF]">
            {t("settings.managePluginsTitle")} ({plugins.length})
          </span>
        </div>
        <div className="flex flex-col gap-[8px] max-h-[200px] overflow-y-auto pr-[4px]">
          {plugins.length === 0 ? (
            <div className="flex items-center justify-center py-[40px] px-[12px] border-[1px] border-dashed border-[#2F2E36] rounded-[9px] text-style-2 text-[#6F7280] bg-[#141318]">
              {t("settings.noPlugins")}
            </div>
          ) : (
            plugins.map((plugin) => {
              const isPending =
                pendingPluginAction && pendingPluginAction.id === plugin.id;
              const isRemovePending =
                isPending && pendingPluginAction.op === "remove";
              return (
                <div
                  key={plugin.id}
                  className="flex items-center gap-[12px] py-[8px] px-[12px] bg-[#141318] border-[1px] border-[#2F2E36] rounded-[9px]"
                >
                  <button
                    className={`w-[28px] h-[24px] flex items-center justify-center rounded-[6px] border-[1px] transition-colors ${
                      isRemovePending
                        ? "bg-[#2A2A31] border-[#3A3944] opacity-50 cursor-not-allowed"
                        : "bg-[#2A2A31] border-[#3A3944] hover:bg-[#34343c]"
                    }`}
                    onClick={() => {
                      if (!isRemovePending) onRemove(plugin.id);
                    }}
                    disabled={isRemovePending}
                    aria-label={t("settings.removePlugin")}
                    title={t("settings.removePlugin")}
                  >
                    <TrashIcon className="w-[12px] h-[12px]" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-style-3 text-[#DCDEE7] truncate">
                      {plugin.name}
                    </p>
                    {plugin.path ? (
                      <p className="text-style-1 text-[#6F7280] truncate">
                        {plugin.path}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <Checkbox
                      checked={plugin.enabled}
                      onChange={() => {
                        if (pendingPluginAction) return;
                        onToggle(plugin.id, !plugin.enabled);
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="flex items-center justify-between gap-[12px]">
          <button
            className={localActionButtonClass(!isAdding)}
            onClick={onAdd}
            disabled={isAdding}
          >
            {isAdding ? t("settings.adding") : t("settings.loadJs")}
          </button>
          <button
            className="py-[4px] px-[16px] bg-[#2A2A31] border-[1px] border-[#3A3944] rounded-[7px] text-style-2 text-[#DBDEE8] hover:bg-[#34343c]"
            onClick={onClose}
          >
            {t("common.ok")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
