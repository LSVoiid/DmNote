import React, { useCallback, useRef, useState } from "react";
import { usePluginDisplayElementStore } from "@stores/usePluginDisplayElementStore";

/**
 * 다중 선택 시 그룹 전체를 감싸는 리사이즈 핸들을 표시하는 컴포넌트
 * 선택된 모든 요소의 바운딩 박스를 계산하고, 비율을 유지하며 크기를 조절합니다.
 */

// ===== 조절 가능한 설정 값들 =====
const CORNER_HANDLE_SIZE = 10; // 꼭짓점 핸들의 시각적 크기 (픽셀)
const EDGE_HANDLE_WIDTH = 8; // 상하좌우 핸들의 두께 (픽셀)
const EDGE_HANDLE_LENGTH = 18; // 상하좌우 핸들의 길이 (픽셀)
const HANDLE_HIT_SIZE = 18; // 핸들의 클릭 가능 영역 크기 (픽셀)
const MIN_SIZE = 10; // 최소 크기 (픽셀)
const RESIZE_SNAP_SIZE = 1; // 리사이즈 시 스냅 단위 (픽셀)
const GROUP_BORDER_WIDTH = 3; // 그룹 테두리 두께 (픽셀)
// ================================

const HANDLE_HIT_HALF = HANDLE_HIT_SIZE / 2;

// 핸들 타입 정의
const HANDLES = [
  {
    id: "nw",
    cursor: "nwse-resize",
    x: 0,
    y: 0,
    dx: -1,
    dy: -1,
    type: "corner",
  },
  { id: "n", cursor: "ns-resize", x: 0.5, y: 0, dx: 0, dy: -1, type: "edge-h" },
  {
    id: "ne",
    cursor: "nesw-resize",
    x: 1,
    y: 0,
    dx: 1,
    dy: -1,
    type: "corner",
  },
  { id: "w", cursor: "ew-resize", x: 0, y: 0.5, dx: -1, dy: 0, type: "edge-v" },
  { id: "e", cursor: "ew-resize", x: 1, y: 0.5, dx: 1, dy: 0, type: "edge-v" },
  {
    id: "sw",
    cursor: "nesw-resize",
    x: 0,
    y: 1,
    dx: -1,
    dy: 1,
    type: "corner",
  },
  { id: "s", cursor: "ns-resize", x: 0.5, y: 1, dx: 0, dy: 1, type: "edge-h" },
  { id: "se", cursor: "nwse-resize", x: 1, y: 1, dx: 1, dy: 1, type: "corner" },
];

// 핸들 시각적 스타일 반환
const getHandleStyle = (type, isHovered) => {
  const baseStyle = {
    backgroundColor: isHovered ? "rgba(59, 130, 246, 1)" : "white",
    border: "2px solid rgba(59, 130, 246, 0.9)",
    pointerEvents: "none",
    transition: "background-color 0.15s ease",
  };

  if (type === "corner") {
    return {
      ...baseStyle,
      width: CORNER_HANDLE_SIZE,
      height: CORNER_HANDLE_SIZE,
      borderRadius: "50%",
    };
  } else if (type === "edge-h") {
    return {
      ...baseStyle,
      width: EDGE_HANDLE_LENGTH,
      height: EDGE_HANDLE_WIDTH,
      borderRadius: EDGE_HANDLE_WIDTH / 2,
    };
  } else {
    return {
      ...baseStyle,
      width: EDGE_HANDLE_WIDTH,
      height: EDGE_HANDLE_LENGTH,
      borderRadius: EDGE_HANDLE_WIDTH / 2,
    };
  }
};

// 개별 핸들 컴포넌트
function Handle({ handle, centerX, centerY, onMouseDown }) {
  const [isHovered, setIsHovered] = useState(false);

  const hitX = centerX - HANDLE_HIT_HALF;
  const hitY = centerY - HANDLE_HIT_HALF;

  return (
    <div
      style={{
        position: "absolute",
        left: hitX,
        top: hitY,
        width: HANDLE_HIT_SIZE,
        height: HANDLE_HIT_SIZE,
        cursor: handle.cursor,
        zIndex: 25,
        backgroundColor: "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onMouseDown={(e) => onMouseDown(e, handle)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={getHandleStyle(handle.type, isHovered)} />
    </div>
  );
}

/**
 * 요소가 리사이즈 가능한지 확인
 */
function isElementResizable(
  element,
  positions,
  selectedKeyType,
  pluginElements
) {
  if (element.type === "key") {
    // 키 요소는 항상 리사이즈 가능
    return true;
  } else if (element.type === "plugin") {
    const pluginEl = pluginElements.find((p) => p.fullId === element.id);
    if (!pluginEl) return false;

    const definitions = usePluginDisplayElementStore.getState().definitions;
    const definition = pluginEl.definitionId
      ? definitions.get(pluginEl.definitionId)
      : null;

    return definition?.resizable === true;
  }
  return false;
}

/**
 * 요소의 bounds 가져오기
 */
function getElementBounds(element, positions, selectedKeyType, pluginElements) {
  if (element.type === "key" && element.index !== undefined) {
    const pos = positions[selectedKeyType]?.[element.index];
    if (!pos) return null;
    return {
      x: pos.dx,
      y: pos.dy,
      width: pos.width || 60,
      height: pos.height || 60,
    };
  } else if (element.type === "plugin") {
    const pluginEl = pluginElements.find((p) => p.fullId === element.id);
    if (!pluginEl?.measuredSize) return null;
    return {
      x: pluginEl.position.x,
      y: pluginEl.position.y,
      width: pluginEl.measuredSize.width,
      height: pluginEl.measuredSize.height,
    };
  }
  return null;
}

/**
 * 그룹 바운딩 박스 계산 (리사이즈 가능한 요소만 포함)
 */
function calculateGroupBounds(
  selectedElements,
  positions,
  selectedKeyType,
  pluginElements
) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const elementBounds = [];

  for (const element of selectedElements) {
    // 리사이즈 가능한 요소만 그룹 bounds 계산에 포함
    if (
      !isElementResizable(element, positions, selectedKeyType, pluginElements)
    ) {
      continue;
    }

    const bounds = getElementBounds(
      element,
      positions,
      selectedKeyType,
      pluginElements
    );
    if (!bounds) continue;

    elementBounds.push({ element, bounds });

    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  }

  if (elementBounds.length === 0) return null;

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    elementBounds,
  };
}

export default function GroupResizeHandles({
  selectedElements,
  positions,
  selectedKeyType,
  pluginElements,
  zoom = 1,
  panX = 0,
  panY = 0,
  previewGroupBounds,
  onGroupResizeStart,
  onGroupResize,
  onGroupResizeEnd,
}) {
  const resizeRef = useRef({
    isResizing: false,
    handleId: null,
    startMouseX: 0,
    startMouseY: 0,
    startGroupBounds: null,
    startElementBounds: [],
  });

  // 그룹 바운딩 박스 계산
  const groupData = calculateGroupBounds(
    selectedElements,
    positions,
    selectedKeyType,
    pluginElements
  );

  // 각 요소가 리사이즈 가능한지 확인
  const resizabilityInfo = selectedElements.map((element) => ({
    element,
    isResizable: isElementResizable(
      element,
      positions,
      selectedKeyType,
      pluginElements
    ),
  }));

  const nonResizableElements = resizabilityInfo.filter(
    (info) => !info.isResizable
  );
  const resizableElements = resizabilityInfo.filter((info) => info.isResizable);

  const handleMouseDown = useCallback(
    (e, handle) => {
      e.preventDefault();
      e.stopPropagation();

      if (!groupData) return;

      // 리사이즈 가능한 요소만 처리 (리사이즈 불가능한 요소의 bounds도 기억)
      const resizableElementBounds = groupData.elementBounds.filter(
        ({ element }) =>
          isElementResizable(
            element,
            positions,
            selectedKeyType,
            pluginElements
          )
      );

      const nonResizableElementBounds = groupData.elementBounds.filter(
        ({ element }) =>
          !isElementResizable(
            element,
            positions,
            selectedKeyType,
            pluginElements
          )
      );

      resizeRef.current = {
        isResizing: true,
        handleId: handle.id,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startGroupBounds: {
          x: groupData.x,
          y: groupData.y,
          width: groupData.width,
          height: groupData.height,
        },
        startElementBounds: resizableElementBounds,
        nonResizableElementBounds: nonResizableElementBounds,
        handle,
      };

      onGroupResizeStart?.(handle);

      const handleMouseMove = (moveEvent) => {
        if (!resizeRef.current.isResizing) return;

        const {
          handle,
          startMouseX,
          startMouseY,
          startGroupBounds,
          startElementBounds,
          nonResizableElementBounds,
        } = resizeRef.current;

        // 마우스 이동량 계산 (줌 보정)
        const rawDeltaX = (moveEvent.clientX - startMouseX) / zoom;
        const rawDeltaY = (moveEvent.clientY - startMouseY) / zoom;

        // 새 그룹 bounds 계산
        let newGroupX = startGroupBounds.x;
        let newGroupY = startGroupBounds.y;
        let newGroupWidth = startGroupBounds.width;
        let newGroupHeight = startGroupBounds.height;

        // 핸들 방향에 따라 크기 조정
        if (handle.dx === -1) {
          newGroupWidth = Math.max(
            MIN_SIZE,
            startGroupBounds.width - rawDeltaX
          );
          if (newGroupWidth > MIN_SIZE) {
            newGroupX = startGroupBounds.x + rawDeltaX;
          } else {
            newGroupX = startGroupBounds.x + startGroupBounds.width - MIN_SIZE;
          }
        } else if (handle.dx === 1) {
          newGroupWidth = Math.max(
            MIN_SIZE,
            startGroupBounds.width + rawDeltaX
          );
        }

        if (handle.dy === -1) {
          newGroupHeight = Math.max(
            MIN_SIZE,
            startGroupBounds.height - rawDeltaY
          );
          if (newGroupHeight > MIN_SIZE) {
            newGroupY = startGroupBounds.y + rawDeltaY;
          } else {
            newGroupY = startGroupBounds.y + startGroupBounds.height - MIN_SIZE;
          }
        } else if (handle.dy === 1) {
          newGroupHeight = Math.max(
            MIN_SIZE,
            startGroupBounds.height + rawDeltaY
          );
        }

        // 그룹 bounds에 스냅 적용 (개별 요소가 아닌 그룹 전체에 적용)
        newGroupX = Math.round(newGroupX / RESIZE_SNAP_SIZE) * RESIZE_SNAP_SIZE;
        newGroupY = Math.round(newGroupY / RESIZE_SNAP_SIZE) * RESIZE_SNAP_SIZE;
        newGroupWidth =
          Math.round(newGroupWidth / RESIZE_SNAP_SIZE) * RESIZE_SNAP_SIZE;
        newGroupHeight =
          Math.round(newGroupHeight / RESIZE_SNAP_SIZE) * RESIZE_SNAP_SIZE;

        // 최소 크기 보장
        newGroupWidth = Math.max(MIN_SIZE, newGroupWidth);
        newGroupHeight = Math.max(MIN_SIZE, newGroupHeight);

        // 스케일 비율 계산 (스냅 적용된 그룹 bounds 기준)
        const scaleX =
          startGroupBounds.width > 0
            ? newGroupWidth / startGroupBounds.width
            : 1;
        const scaleY =
          startGroupBounds.height > 0
            ? newGroupHeight / startGroupBounds.height
            : 1;

        // 각 리사이즈 가능한 요소의 새 위치/크기 계산 (개별 요소에도 스냅 적용)
        const newElementBounds = startElementBounds.map(
          ({ element, bounds }) => {
            // 그룹 내에서의 상대 위치
            const relativeX = bounds.x - startGroupBounds.x;
            const relativeY = bounds.y - startGroupBounds.y;

            // 새 위치 계산 (스케일 적용)
            let newX = newGroupX + relativeX * scaleX;
            let newY = newGroupY + relativeY * scaleY;
            let newWidth = bounds.width * scaleX;
            let newHeight = bounds.height * scaleY;

            // 개별 요소에도 스냅 적용 (그리드에 딱 맞게)
            newX = Math.round(newX / RESIZE_SNAP_SIZE) * RESIZE_SNAP_SIZE;
            newY = Math.round(newY / RESIZE_SNAP_SIZE) * RESIZE_SNAP_SIZE;
            newWidth =
              Math.round(newWidth / RESIZE_SNAP_SIZE) * RESIZE_SNAP_SIZE;
            newHeight =
              Math.round(newHeight / RESIZE_SNAP_SIZE) * RESIZE_SNAP_SIZE;

            // 최소 크기 보장
            newWidth = Math.max(MIN_SIZE, newWidth);
            newHeight = Math.max(MIN_SIZE, newHeight);

            return {
              element,
              bounds: {
                x: newX,
                y: newY,
                width: newWidth,
                height: newHeight,
              },
            };
          }
        );

        // 새 그룹 bounds 계산 (리사이즈된 요소 + 리사이즈 불가능한 요소 모두 포함)
        let finalGroupMinX = Infinity;
        let finalGroupMinY = Infinity;
        let finalGroupMaxX = -Infinity;
        let finalGroupMaxY = -Infinity;

        // 리사이즈된 요소들
        for (const { bounds } of newElementBounds) {
          finalGroupMinX = Math.min(finalGroupMinX, bounds.x);
          finalGroupMinY = Math.min(finalGroupMinY, bounds.y);
          finalGroupMaxX = Math.max(finalGroupMaxX, bounds.x + bounds.width);
          finalGroupMaxY = Math.max(finalGroupMaxY, bounds.y + bounds.height);
        }

        // 리사이즈 불가능한 요소들 (원래 위치 유지)
        for (const { bounds } of nonResizableElementBounds || []) {
          finalGroupMinX = Math.min(finalGroupMinX, bounds.x);
          finalGroupMinY = Math.min(finalGroupMinY, bounds.y);
          finalGroupMaxX = Math.max(finalGroupMaxX, bounds.x + bounds.width);
          finalGroupMaxY = Math.max(finalGroupMaxY, bounds.y + bounds.height);
        }

        onGroupResize?.({
          groupBounds: {
            x: finalGroupMinX,
            y: finalGroupMinY,
            width: finalGroupMaxX - finalGroupMinX,
            height: finalGroupMaxY - finalGroupMinY,
          },
          elementBounds: newElementBounds,
          handle,
        });
      };

      const handleMouseUp = () => {
        resizeRef.current.isResizing = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        window.removeEventListener("blur", handleMouseUp);
        onGroupResizeEnd?.();
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("blur", handleMouseUp);
    },
    [
      groupData,
      positions,
      selectedKeyType,
      pluginElements,
      zoom,
      onGroupResizeStart,
      onGroupResize,
      onGroupResizeEnd,
    ]
  );

  if (!groupData || selectedElements.length < 2) return null;

  // 표시할 bounds (프리뷰 또는 실제)
  const displayBounds = previewGroupBounds || {
    x: groupData.x,
    y: groupData.y,
    width: groupData.width,
    height: groupData.height,
  };

  // 그룹 테두리 좌표 계산 - 내부 요소 테두리와 동일한 위치에 겹치게
  const selectionLeft = displayBounds.x * zoom + panX - 2;
  const selectionTop = displayBounds.y * zoom + panY - 2;
  const selectionWidth = displayBounds.width * zoom + 4;
  const selectionHeight = displayBounds.height * zoom + 4;

  // 핸들 위치 계산용 - 테두리 중앙에 배치하기 위해 테두리 두께의 절반만큼 오프셋
  const borderHalf = GROUP_BORDER_WIDTH / 2;
  const handleAreaLeft = selectionLeft + borderHalf;
  const handleAreaTop = selectionTop + borderHalf;
  const handleAreaWidth = selectionWidth - GROUP_BORDER_WIDTH;
  const handleAreaHeight = selectionHeight - GROUP_BORDER_WIDTH;

  // 리사이즈 불가능한 요소가 있으면 핸들 비활성화
  const hasNonResizable = nonResizableElements.length > 0;

  return (
    <>
      {/* 그룹 바운딩 박스 테두리 */}
      <div
        style={{
          position: "absolute",
          left: selectionLeft,
          top: selectionTop,
          width: selectionWidth,
          height: selectionHeight,
          border: `${GROUP_BORDER_WIDTH}px solid rgba(59, 130, 246, 0.9)`,
          borderRadius: "6px",
          pointerEvents: "none",
          zIndex: 22,
        }}
      />

      {/* 리사이즈 불가능한 요소들에 대한 표시 (주황색 점선만, 아이콘 없음) */}
      {nonResizableElements.map(({ element }) => {
        const bounds = getElementBounds(
          element,
          positions,
          selectedKeyType,
          pluginElements
        );
        if (!bounds) return null;

        return (
          <div
            key={`non-resizable-${element.id}`}
            style={{
              position: "absolute",
              left: bounds.x * zoom + panX - 2,
              top: bounds.y * zoom + panY - 2,
              width: bounds.width * zoom + 4,
              height: bounds.height * zoom + 4,
              border: "2px dashed rgba(251, 146, 60, 0.9)",
              borderRadius: "4px",
              pointerEvents: "none",
              zIndex: 21,
            }}
            title="크기 조절 불가능한 요소"
          />
        );
      })}

      {/* 리사이즈 핸들들 - 리사이즈 가능한 요소가 있을 때만 표시 */}
      {resizableElements.length > 0 &&
        HANDLES.map((handle) => {
          // 핸들을 테두리 중앙에 배치
          const centerX = handleAreaLeft + handleAreaWidth * handle.x;
          const centerY = handleAreaTop + handleAreaHeight * handle.y;

          return (
            <Handle
              key={handle.id}
              handle={handle}
              centerX={centerX}
              centerY={centerY}
              onMouseDown={handleMouseDown}
            />
          );
        })}
    </>
  );
}

/**
 * 리사이즈 불가능한 요소 ID 목록 반환
 */
function getNonResizableElementIds(
  selectedElements,
  positions,
  selectedKeyType,
  pluginElements
) {
  return selectedElements
    .filter(
      (element) =>
        !isElementResizable(element, positions, selectedKeyType, pluginElements)
    )
    .map((element) => element.id);
}

export {
  calculateGroupBounds,
  getElementBounds,
  isElementResizable,
  getNonResizableElementIds,
};
