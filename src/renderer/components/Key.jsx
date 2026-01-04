import React, { memo, useMemo, useCallback, useRef, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getKeySignal } from "@stores/keySignals";
import { getKeyCounterSignal } from "@stores/keyCounterSignals";
import { useSignals } from "@preact/signals-react/runtime";
import { isMac } from "@utils/platform";
import { useDraggable } from "@hooks/Grid";
import { getKeyInfoByGlobalKey } from "@utils/KeyMaps";
import { GRID_SNAP } from "@hooks/Grid/constants";
import {
  createDefaultCounterSettings,
  normalizeCounterSettings,
} from "@src/types/keys";
import { toCssRgba } from "@utils/colorUtils";
import { useSmartGuidesElements } from "@hooks/Grid";
import { useSmartGuidesStore } from "@stores/useSmartGuidesStore";
import { useSettingsStore } from "@stores/useSettingsStore";
import { useGridSelectionStore } from "@stores/useGridSelectionStore";
import {
  calculateBounds,
  calculateSnapPoints,
  calculateGroupBounds,
} from "@utils/smartGuides";

export default function DraggableKey({
  index,
  position,
  keyName,
  onPositionChange,
  onClick,
  onCtrlClick,
  isSelected = false,
  selectedElements = [],
  onMultiDrag,
  onMultiDragStart,
  onMultiDragEnd,
  activeTool,
  onEraserClick,
  onContextMenu,
  setReferenceRef,
  zoom = 1,
  panX = 0,
  panY = 0,
  zIndex = 0,
}) {
  const macOS = isMac();
  const { displayName } = getKeyInfoByGlobalKey(keyName);
  const {
    dx,
    dy,
    width,
    height = 60,
    activeImage,
    inactiveImage,
    className,
  } = position;

  // 스마트 가이드를 위한 다른 요소들의 bounds 가져오기
  const { getOtherElements } = useSmartGuidesElements();

  // 드래그/리사이즈 중인 상태 (CSS 애니메이션 비활성화용)
  const isDraggingOrResizing = useGridSelectionStore(
    (state) => state.isDraggingOrResizing
  );

  // 다중 선택 드래그 상태
  const multiDragRef = useRef({ isDragging: false, startX: 0, startY: 0 });
  const nodeRef = useRef(null);

  // 선택된 상태면 드래그 모드 활성화
  const isSelectionMode = isSelected;

  const draggable = useDraggable({
    gridSize: GRID_SNAP,
    initialX: dx,
    initialY: dy,
    onPositionChange: (newDx, newDy) => {
      // 선택 모드가 아닐 때만 개별 이동
      if (!isSelectionMode) {
        onPositionChange(index, newDx, newDy);
      }
    },
    zoom,
    panX,
    panY,
    // 스마트 가이드 옵션
    elementId: `key-${index}`,
    elementWidth: width || 60,
    elementHeight: height || 60,
    getOtherElements,
    // 선택 모드에서는 개별 드래그 비활성화
    disabled: isSelectionMode,
  });

  // 선택 요소 드래그 핸들러 (스마트 가이드 포함)
  const handleSelectionDragMouseDown = useCallback(
    (e) => {
      if (!isSelectionMode || e.button !== 0) return;

      e.preventDefault();
      e.stopPropagation();

      // 드래그 시작 전 기존 스마트 가이드 클리어 (이전 드래그가 정상 종료되지 않은 경우 대비)
      useSmartGuidesStore.getState().clearGuides();

      // 드래그 시작 시 애니메이션 비활성화
      useGridSelectionStore.getState().setDraggingOrResizing(true);

      // 드래그 시작 시 히스토리 저장
      onMultiDragStart?.();

      // 현재 키의 시작 위치 저장 (스냅 계산용)
      const startDx = dx;
      const startDy = dy;
      const currentWidth = width || 60;
      const currentHeight = height || 60;
      const elementId = `key-${index}`;

      multiDragRef.current = {
        isDragging: true,
        startX: e.clientX,
        startY: e.clientY,
        lastSnappedDeltaX: 0,
        lastSnappedDeltaY: 0,
      };

      let rafId = null;
      // 드래그 종료 플래그 (rAF 콜백에서 체크)
      let dragEnded = false;
      const smartGuidesStore = useSmartGuidesStore.getState();

      const handleMouseMove = (moveEvent) => {
        if (!multiDragRef.current.isDragging || dragEnded) return;

        if (rafId) return;
        rafId = requestAnimationFrame(() => {
          rafId = null;

          // 드래그가 종료되었으면 rAF 콜백에서도 무시
          if (dragEnded) return;

          const currentZoom = zoom;
          // raw delta (스냅 전)
          const rawDeltaX =
            (moveEvent.clientX - multiDragRef.current.startX) / currentZoom;
          const rawDeltaY =
            (moveEvent.clientY - multiDragRef.current.startY) / currentZoom;

          // 이동 후 예상 위치
          const newX = startDx + rawDeltaX;
          const newY = startDy + rawDeltaY;

          // gridSettings에서 정렬/간격 가이드 활성화 여부 확인
          const gridSettings = useSettingsStore.getState().gridSettings;
          const alignmentGuidesEnabled =
            gridSettings?.alignmentGuides !== false;
          const spacingGuidesEnabled = gridSettings?.spacingGuides !== false;

          // 스마트 가이드 계산 (현재 키 기준으로 다른 비선택 요소들과 스냅)
          const otherElements = getOtherElements(elementId);

          // 선택된 다른 요소들도 제외 (자기 자신만 기준)
          const nonSelectedElements = otherElements.filter(
            (el) =>
              !selectedElements.some(
                (sel) =>
                  sel.id === el.id ||
                  (sel.type === "key" && el.id === `key-${sel.index}`)
              )
          );

          const draggedBounds = calculateBounds(
            newX,
            newY,
            currentWidth,
            currentHeight,
            elementId
          );

          // 다중 선택 시 그룹 전체의 bounds 계산 (캔버스 중앙 스냅용)
          let groupBounds = null;
          if (selectedElements.length > 1) {
            // 선택된 요소들의 현재 bounds 수집
            const selectedBoundsArray = selectedElements
              .map((sel) => {
                // 현재 드래그 중인 요소인 경우 새 위치 사용
                if (
                  sel.id === elementId ||
                  (sel.type === "key" && sel.index === index)
                ) {
                  return draggedBounds;
                }
                // 다른 선택된 요소들은 otherElements에서 찾아서 이동량 적용
                const found = otherElements.find(
                  (el) =>
                    el.id === sel.id ||
                    (sel.type === "key" && el.id === `key-${sel.index}`)
                );
                if (found) {
                  return calculateBounds(
                    found.left + rawDeltaX,
                    found.top + rawDeltaY,
                    found.width,
                    found.height,
                    found.id
                  );
                }
                return null;
              })
              .filter(Boolean);
            groupBounds = calculateGroupBounds(selectedBoundsArray);
          }

          // 다중 선택 시 그룹 바운딩 박스를 스냅 기준으로 사용
          const snapTargetBounds =
            selectedElements.length > 1 && groupBounds
              ? groupBounds
              : draggedBounds;

          const snapResult = alignmentGuidesEnabled
            ? calculateSnapPoints(
                snapTargetBounds,
                nonSelectedElements,
                undefined,
                {
                  groupBounds,
                  disableSpacing: !spacingGuidesEnabled,
                }
              )
            : null;

          let finalX = newX;
          let finalY = newY;

          // 스마트 가이드 스냅 적용
          if (snapResult?.didSnapX) {
            // 다중 선택 시: 그룹 바운딩 박스의 스냅 이동량을 개별 요소에 적용
            if (selectedElements.length > 1 && groupBounds) {
              const groupSnapDeltaX = snapResult.snappedX - groupBounds.left;
              finalX = newX + groupSnapDeltaX;
            } else {
              finalX = snapResult.snappedX;
            }
          } else {
            // 그리드 스냅
            finalX = Math.round(newX / GRID_SNAP) * GRID_SNAP;
          }

          if (snapResult?.didSnapY) {
            // 다중 선택 시: 그룹 바운딩 박스의 스냅 이동량을 개별 요소에 적용
            if (selectedElements.length > 1 && groupBounds) {
              const groupSnapDeltaY = snapResult.snappedY - groupBounds.top;
              finalY = newY + groupSnapDeltaY;
            } else {
              finalY = snapResult.snappedY;
            }
          } else {
            // 그리드 스냅
            finalY = Math.round(newY / GRID_SNAP) * GRID_SNAP;
          }

          // 스냅된 delta 계산
          const snappedDeltaX = Math.round(finalX - startDx);
          const snappedDeltaY = Math.round(finalY - startDy);

          // 가이드라인 업데이트
          if (snapResult && (snapResult.didSnapX || snapResult.didSnapY)) {
            // 다중 선택 시 그룹 바운딩 박스를 표시
            const displayBounds =
              selectedElements.length > 1 && groupBounds
                ? calculateBounds(
                    groupBounds.left +
                      (snapResult.didSnapX
                        ? snapResult.snappedX - groupBounds.left
                        : 0),
                    groupBounds.top +
                      (snapResult.didSnapY
                        ? snapResult.snappedY - groupBounds.top
                        : 0),
                    groupBounds.width,
                    groupBounds.height,
                    "group"
                  )
                : calculateBounds(
                    finalX,
                    finalY,
                    currentWidth,
                    currentHeight,
                    elementId
                  );
            smartGuidesStore.setDraggedBounds(displayBounds);
            smartGuidesStore.setActiveGuides(snapResult.guides);

            // 간격 가이드도 업데이트
            if (
              spacingGuidesEnabled &&
              snapResult.spacingGuides &&
              snapResult.spacingGuides.length > 0
            ) {
              smartGuidesStore.setSpacingGuides(snapResult.spacingGuides);
            } else {
              smartGuidesStore.setSpacingGuides([]);
            }
          } else {
            smartGuidesStore.clearGuides();
          }

          // 이전 delta와의 차이만큼 이동
          const moveDeltaX =
            snappedDeltaX - multiDragRef.current.lastSnappedDeltaX;
          const moveDeltaY =
            snappedDeltaY - multiDragRef.current.lastSnappedDeltaY;

          if (moveDeltaX !== 0 || moveDeltaY !== 0) {
            multiDragRef.current.lastSnappedDeltaX = snappedDeltaX;
            multiDragRef.current.lastSnappedDeltaY = snappedDeltaY;
            onMultiDrag?.(moveDeltaX, moveDeltaY);
          }
        });
      };

      const handleMouseUp = () => {
        // 드래그 종료 플래그 설정 (pending rAF 콜백이 실행되지 않도록)
        dragEnded = true;
        multiDragRef.current.isDragging = false;

        // pending rAF가 있으면 취소
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }

        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        window.removeEventListener("blur", handleMouseUp);
        // 스마트 가이드 클리어
        useSmartGuidesStore.getState().clearGuides();
        // 드래그 종료 시 애니메이션 복원
        useGridSelectionStore.getState().setDraggingOrResizing(false);
        // 드래그 종료 시 오버레이 동기화
        onMultiDragEnd?.();
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      // window blur 시에도 드래그 종료 처리 (창이 포커스를 잃었을 때)
      window.addEventListener("blur", handleMouseUp);
    },
    [
      isSelectionMode,
      zoom,
      onMultiDrag,
      onMultiDragStart,
      onMultiDragEnd,
      dx,
      dy,
      width,
      height,
      index,
      getOtherElements,
      selectedElements,
    ]
  );

  const handleClick = (e) => {
    // Ctrl+클릭으로 선택 토글 (선택 모드에서도 동작해야 함 - 선택 해제용)
    const isPrimaryModifierPressed = macOS ? e.metaKey : e.ctrlKey;
    if (isPrimaryModifierPressed && onCtrlClick) {
      e.stopPropagation();
      onCtrlClick(e);
      return;
    }

    // 선택된 상태에서는 일반 클릭 이벤트 무시
    if (isSelectionMode) {
      e.stopPropagation();
      return;
    }

    if (activeTool === "eraser") {
      onEraserClick?.();
      return;
    }
    if (!draggable.wasMoved) onClick(e);
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // 선택된 상태에서는 컨텍스트 메뉴 무시
    if (isSelectionMode) return;
    onContextMenu?.(e);
  };

  // 드래그 중에는 훅의 dx/dy 사용 (부모 리렌더 최소화)
  const renderDx = draggable.dx;
  const renderDy = draggable.dy;

  const keyStyle = useMemo(
    () => ({
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate3d(calc(${renderDx}px + var(--key-offset-x, 0px)), calc(${renderDy}px + var(--key-offset-y, 0px)), 0)`,
      backgroundColor: `var(--key-bg, ${
        inactiveImage ? "transparent" : "rgba(46, 46, 47, 0.9)"
      })`,
      borderRadius: `var(--key-radius, ${inactiveImage ? "0" : "10px"})`,
      border: `var(--key-border, ${
        inactiveImage ? "none" : "3px solid rgba(113, 113, 113, 0.9)"
      })`,
      overflow: inactiveImage ? "visible" : "hidden",
      willChange: "transform",
      backfaceVisibility: "hidden",
      transformStyle: "preserve-3d",
      contain: "layout style paint",
      imageRendering: "auto",
      isolation: "isolate",
      boxSizing: "border-box",
      zIndex: position.zIndex ?? zIndex,
    }),
    [renderDx, renderDy, width, height, inactiveImage, zIndex, position.zIndex]
  );

  const imageStyle = useMemo(
    () => ({
      width: "100%",
      height: "100%",
      objectFit: "cover",
      display: "block",
      pointerEvents: "none",
      userSelect: "none",
    }),
    []
  );

  const textStyle = useMemo(
    () => ({
      willChange: "auto",
      contain: "layout style paint",
      color: "var(--key-text-color, #717171)",
    }),
    []
  );

  const attachRef = (node) => {
    // 드래그 훅에 ref 연결 (선택 모드가 아닐 때만)
    if (!isSelectionMode) {
      draggable.ref(node);
    }
    nodeRef.current = node;
    // 팝업 위치 지정을 위해 부모에 노드 전달
    if (typeof setReferenceRef === "function") setReferenceRef(node);
  };

  return (
    <div
      ref={attachRef}
      className={`absolute cursor-pointer ${
        draggable && draggable.wasMoved ? "" : ""
      } ${className || ""}`}
      style={keyStyle}
      data-state="inactive"
      data-editing={isDraggingOrResizing ? "true" : undefined}
      onClick={handleClick}
      onMouseDown={isSelectionMode ? handleSelectionDragMouseDown : undefined}
      onContextMenu={handleContextMenu}
      onDragStart={(e) => e.preventDefault()}
    >
      {inactiveImage ? (
        <img src={inactiveImage} alt="" style={imageStyle} draggable={false} />
      ) : (
        <div
          className="flex items-center justify-center h-full font-bold"
          style={textStyle}
        >
          {displayName}
        </div>
      )}
    </div>
  );
}

export const Key = memo(
  ({ keyName, globalKey, position, mode, counterEnabled = false }) => {
    // React 환경에서 신호 변경을 구독하도록 활성화
    useSignals();
    // 각 Key는 자신의 활성 상태 신호를 직접 구독
    const selectorKey = globalKey || keyName;
    const active = getKeySignal(selectorKey).value;
    const {
      dx,
      dy,
      width,
      height = 60,
      activeImage,
      inactiveImage,
      activeTransparent = false,
      idleTransparent = false,
      className, // 단일 클래스 네임으로 통일
    } = position;

    // 투명화 옵션 체크
    const isTransparent = active ? activeTransparent : idleTransparent;

    // 투명화가 활성화되어 있으면 아무것도 렌더링하지 않음
    if (isTransparent) {
      return null;
    }

    // 활성 상태에서 activeImage가 없으면 inactiveImage를 fallback으로 사용
    const currentImage =
      active && activeImage
        ? activeImage
        : inactiveImage
        ? inactiveImage
        : null;

    const keyStyle = useMemo(
      () => ({
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate3d(calc(${dx}px + var(--key-offset-x, 0px)), calc(${dy}px + var(--key-offset-y, 0px)), 0)`,
        backgroundColor: `var(--key-bg, ${
          currentImage
            ? "transparent"
            : active
            ? "rgba(121, 121, 121, 0.9)"
            : "rgba(46, 46, 47, 0.9)"
        })`,
        borderRadius: `var(--key-radius, ${currentImage ? "0" : "10px"})`,
        border: `var(--key-border, ${
          currentImage
            ? "none"
            : active
            ? "3px solid rgba(255, 255, 255, 0.9)"
            : "3px solid rgba(113, 113, 113, 0.9)"
        })`,
        color: `var(--key-text-color, ${
          active && !activeImage ? "#FFFFFF" : "rgba(121, 121, 121, 0.9)"
        })`,
        overflow: currentImage ? "visible" : "hidden",
        // GPU 가속 최적화: active 상태 변경 시에만 willChange 적용
        willChange: active ? "transform, background-color" : "transform",
        backfaceVisibility: "hidden",
        transformStyle: "preserve-3d",
        contain: "layout style paint",
        imageRendering: "auto",
        isolation: "isolate",
        boxSizing: "border-box",
        zIndex: position.zIndex,
      }),
      [
        active,
        activeImage,
        inactiveImage,
        dx,
        dy,
        width,
        height,
        currentImage,
        position.zIndex,
      ]
    );

    const imageStyle = useMemo(
      () => ({
        width: "100%",
        height: "100%",
        objectFit: "cover",
        display: "block",
        pointerEvents: "none",
        userSelect: "none",
        position: "relative",
        zIndex: 0,
      }),
      []
    );

    const textStyle = useMemo(
      () => ({
        willChange: "auto",
        contain: "layout style paint",
      }),
      []
    );

    // 텍스트 표시 조건: 현재 상태에 사용할 이미지가 없을 때만 텍스트를 표시
    const counterSettings = normalizeCounterSettings(
      position?.counter ?? createDefaultCounterSettings()
    );
    // 개별 키의 카운터 enabled와 전역 counterEnabled 모두 확인
    const showInsideCounter =
      counterEnabled &&
      counterSettings.enabled &&
      counterSettings.placement === "inside";

    let counterSignal;
    if (showInsideCounter) {
      counterSignal = getKeyCounterSignal(mode ?? "", globalKey);
    }

    const counterValue = counterSignal?.value ?? 0;

    const showText = !currentImage;

    const counterFillColor = active
      ? counterSettings.fill.active
      : counterSettings.fill.idle;
    const counterStrokeColor = active
      ? counterSettings.stroke.active
      : counterSettings.stroke.idle;

    const contentGap = Number.isFinite(counterSettings.gap)
      ? counterSettings.gap
      : 6;

    const fillColorCss = toCssRgba(counterFillColor, "#FFFFFF");
    const strokeColorCss = toCssRgba(counterStrokeColor, "transparent");

    const renderInsideLayout = () => {
      if (!showInsideCounter) {
        return null;
      }

      const displayValue = counterValue || 0;
      const strokeWidth = strokeColorCss.alpha > 0 ? "1px" : "0px";

      const counterElement = (
        <span
          key="counter"
          className="counter pointer-events-none select-none"
          data-text={displayValue}
          data-counter-state={active ? "active" : "inactive"}
          style={{
            fontSize: "16px",
            fontWeight: 800,
            lineHeight: 1,
            "--counter-color-default": fillColorCss.css,
            "--counter-stroke-color-default": strokeColorCss.css,
            "--counter-stroke-width-default": strokeWidth,
          }}
        >
          {displayValue}
        </span>
      );

      const nameElement = (
        <span
          key="label"
          className="font-bold text-[14px] pointer-events-none select-none"
          style={textStyle}
        >
          {keyName}
        </span>
      );

      const isHorizontal =
        counterSettings.align === "left" || counterSettings.align === "right";

      const elements = isHorizontal
        ? counterSettings.align === "left"
          ? [counterElement, nameElement]
          : [nameElement, counterElement]
        : counterSettings.align === "top"
        ? [counterElement, nameElement]
        : [nameElement, counterElement];

      const containerClass = `flex ${
        isHorizontal ? "" : "flex-col"
      } w-full h-full items-center pointer-events-none select-none justify-center`;

      return (
        <div
          className={containerClass}
          style={{ padding: "0px", gap: `${contentGap}px` }}
        >
          {elements}
        </div>
      );
    };

    // macOS 용 오버레이 드래그 핸들러
    const handleKeyMouseDown = useCallback((e) => {
      if (!isMac()) return;

      if (e.buttons === 1) {
        getCurrentWindow().startDragging();
      }
    }, []);

    return (
      <div
        data-tauri-drag-region
        className={`absolute ${className || ""}`}
        style={keyStyle}
        data-state={active ? "active" : "inactive"}
        onMouseDown={handleKeyMouseDown}
      >
        {currentImage ? (
          <img src={currentImage} alt="" style={imageStyle} draggable={false} />
        ) : showText ? (
          showInsideCounter ? (
            renderInsideLayout()
          ) : (
            <div
              className="flex items-center justify-center h-full font-bold"
              style={textStyle}
            >
              {keyName}
            </div>
          )
        ) : null}
        {active && !activeImage && inactiveImage ? (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: "rgba(0,0,0,0.4)",
              borderRadius: "inherit",
              pointerEvents: "none",
              zIndex: 1,
              WebkitMaskImage: `url(${currentImage})`,
              WebkitMaskRepeat: "no-repeat",
              WebkitMaskSize: "100% 100%",
              maskImage: `url(${currentImage})`,
              maskRepeat: "no-repeat",
              maskSize: "100% 100%",
            }}
          />
        ) : null}
      </div>
    );
  },
  (prevProps, nextProps) => {
    // active는 내부 selector로 구독하므로 여기서는 position/keyName만 비교
    return (
      prevProps.keyName === nextProps.keyName &&
      prevProps.mode === nextProps.mode &&
      prevProps.counterEnabled === nextProps.counterEnabled &&
      prevProps.position.dx === nextProps.position.dx &&
      prevProps.position.dy === nextProps.position.dy &&
      prevProps.position.width === nextProps.position.width &&
      prevProps.position.height === nextProps.position.height &&
      prevProps.position.activeImage === nextProps.position.activeImage &&
      prevProps.position.inactiveImage === nextProps.position.inactiveImage &&
      prevProps.position.activeTransparent ===
        nextProps.position.activeTransparent &&
      prevProps.position.idleTransparent ===
        nextProps.position.idleTransparent &&
      prevProps.position.zIndex === nextProps.position.zIndex &&
      prevProps.position.className === nextProps.position.className &&
      prevProps.position.counter?.enabled ===
        nextProps.position.counter?.enabled &&
      prevProps.position.counter?.placement ===
        nextProps.position.counter?.placement &&
      prevProps.position.counter?.align === nextProps.position.counter?.align &&
      prevProps.position.counter?.fill?.idle ===
        nextProps.position.counter?.fill?.idle &&
      prevProps.position.counter?.fill?.active ===
        nextProps.position.counter?.fill?.active &&
      prevProps.position.counter?.stroke?.idle ===
        nextProps.position.counter?.stroke?.idle &&
      prevProps.position.counter?.stroke?.active ===
        nextProps.position.counter?.stroke?.active &&
      (prevProps.position.counter?.gap ?? 6) ===
        (nextProps.position.counter?.gap ?? 6)
    );
  }
);
