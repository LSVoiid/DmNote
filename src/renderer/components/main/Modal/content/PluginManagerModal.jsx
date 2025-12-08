import React from "react";
import Modal from "@components/main/Modal/Modal";
import Checkbox from "@components/main/common/Checkbox";
import TrashIcon from "@assets/svgs/trash.svg";
import { getScrollShadowState } from "@utils/scrollShadow";

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
  const scrollRef = React.useRef(null);
  const contentRef = React.useRef(null);
  const [scrollState, setScrollState] = React.useState({
    hasTopShadow: false,
    hasBottomShadow: false,
  });
  const [skipShadowTransition, setSkipShadowTransition] = React.useState(true);
  const [containerHeight, setContainerHeight] = React.useState(null);
  const isFirstRender = React.useRef(true);

  // 스크롤 상태 업데이트
  const updateScrollState = React.useCallback(() => {
    const el = scrollRef.current;
    const contentEl = contentRef.current;
    if (!el) return;

    const nextState = getScrollShadowState(el, contentEl);
    setScrollState((prev) =>
      prev.hasTopShadow === nextState.hasTopShadow &&
      prev.hasBottomShadow === nextState.hasBottomShadow
        ? prev
        : nextState
    );
  }, []);

  // 스크롤 상태 및 높이 업데이트
  React.useEffect(() => {
    if (!isOpen) return;

    setSkipShadowTransition(true);

    const el = scrollRef.current;
    const contentEl = contentRef.current;
    if (!el) return;

    const updateHeight = () => {
      if (contentEl) {
        const contentHeight = contentEl.scrollHeight;
        const maxHeight = 195;
        setContainerHeight(Math.min(contentHeight, maxHeight));
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      updateScrollState();
      updateHeight();
    });

    if (contentEl) {
      resizeObserver.observe(contentEl);
    }
    resizeObserver.observe(el);

    updateScrollState();
    updateHeight();

    const rafId = requestAnimationFrame(() => {
      setSkipShadowTransition(false);
      isFirstRender.current = false;
    });

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(rafId);
    };
  }, [isOpen, plugins.length, updateScrollState]);

  if (!isOpen) return null;

  return (
    <Modal onClick={onClose}>
      <div
        className="flex flex-col bg-[#1A191E] rounded-[13px] border-[1px] border-[#2A2A30] p-[20px] pr-[6px]"
        onClick={(event) => event.stopPropagation()}
      >
        {/* 스크롤 영역 */}
        <div className="relative">
          {/* 상단 그림자 */}
          <div
            className={`absolute top-0 left-0 right-[14px] h-[10px] bg-gradient-to-b from-[#1A191E] to-transparent pointer-events-none z-10 ${
              skipShadowTransition ? "" : "transition-opacity duration-150"
            } ${scrollState.hasTopShadow ? "opacity-100" : "opacity-0"}`}
          />

          <div
            ref={scrollRef}
            className="overflow-y-auto modal-content-scroll pr-[14px]"
            style={{
              height:
                containerHeight !== null ? `${containerHeight}px` : "auto",
              maxHeight: "195px",
              transition: isFirstRender.current
                ? "none"
                : "height 100ms ease-in-out",
            }}
            onScroll={updateScrollState}
          >
            <div ref={contentRef} className="flex flex-col gap-[19px]">
              {plugins.length === 0 ? (
                <div className="flex items-center justify-center py-[10px] px-[12px] text-style-2 text-white">
                  {t("settings.noPlugins")}
                </div>
              ) : (
                plugins.map((plugin, index) => {
                  const isPending =
                    pendingPluginAction && pendingPluginAction.id === plugin.id;
                  const isRemovePending =
                    isPending && pendingPluginAction.op === "remove";
                  const isFirst = index === 0;
                  const isLast = index === plugins.length - 1;
                  return (
                    <div
                      key={plugin.id}
                      className={`flex items-center justify-between${
                        scrollState.hasTopShadow && isFirst ? " mt-[5px]" : ""
                      }${
                        scrollState.hasBottomShadow && isLast ? " mb-[5px]" : ""
                      }`}
                    >
                      <div className="flex items-center gap-[10px]  h-[23px]">
                        <button
                          className={`flex items-center justify-center transition-colors ${
                            isRemovePending
                              ? "opacity-50 cursor-not-allowed"
                              : "hover:opacity-80"
                          }`}
                          onClick={() => {
                            if (!isRemovePending) onRemove(plugin.id);
                          }}
                          disabled={isRemovePending}
                          aria-label={t("settings.removePlugin")}
                          title={t("settings.removePlugin")}
                        >
                          <TrashIcon className="w-[14px] h-[15px]" />
                        </button>
                        <span className="text-white text-style-2">
                          {plugin.name}
                        </span>
                      </div>
                      {/* 경로 미리보기 - 숨김 처리
                      {plugin.path ? (
                        <p className="text-[11px] text-[#6F7280] truncate">
                          {plugin.path}
                        </p>
                      ) : null}
                      */}
                      <div className="flex items-center justify-center w-[27px] h-[21px]">
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
          </div>

          {/* 하단 그림자 */}
          <div
            className={`absolute bottom-0 left-0 right-[14px] h-[10px] bg-gradient-to-t from-[#1A191E] to-transparent pointer-events-none z-10 ${
              skipShadowTransition ? "" : "transition-opacity duration-150"
            } ${scrollState.hasBottomShadow ? "opacity-100" : "opacity-0"}`}
          />
        </div>

        {/* 구분선 */}
        <div className="h-[0.5px] bg-[#2A2A30] my-[20px] -ml-[20px] -mr-[6px]" />

        {/* 하단 버튼 */}
        <div className="flex items-center gap-[10.5px] pr-[14px]">
          <button
            className={`flex items-center justify-center w-[150px] h-[30px] rounded-[7px] text-style-3 text-[#DCDEE7] transition-colors ${
              isAdding
                ? "bg-[#222228] cursor-not-allowed opacity-50"
                : "bg-[#2A2A30] hover:bg-[#34343c]"
            }`}
            onClick={onAdd}
            disabled={isAdding}
          >
            {isAdding
              ? t("settings.adding")
              : `${t("settings.loadJs")} (${plugins.length})`}
          </button>
          <button
            className="flex items-center justify-center w-[75px] h-[30px] bg-[#2A2A30] rounded-[7px] text-style-3 text-[#DCDEE7] hover:bg-[#34343c] transition-colors"
            onClick={onClose}
          >
            {t("common.ok")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
