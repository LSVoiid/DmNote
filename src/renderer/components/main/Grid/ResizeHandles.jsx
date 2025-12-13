import React, { useCallback, useRef } from "react";

/**
 * 8방향 리사이즈 핸들을 표시하는 컴포넌트
 * 단일 선택 시에만 표시됨
 */

// ===== 조절 가능한 설정 값들 =====
const HANDLE_VISUAL_SIZE = 8; // 핸들의 시각적 크기 (픽셀)
const HANDLE_HIT_SIZE = 16; // 핸들의 클릭 가능 영역 크기 (픽셀) - 이 값을 조절하여 잡는 범위 변경
const MIN_SIZE = 10; // 키의 최소 크기 (픽셀)
const RESIZE_SNAP_SIZE = 5; // 리사이즈 시 스냅 단위 (픽셀) - 이 값을 조절하여 크기 조절 단위 변경
// ================================

const HANDLE_VISUAL_HALF = HANDLE_VISUAL_SIZE / 2;
const HANDLE_HIT_HALF = HANDLE_HIT_SIZE / 2;

// 8방향 핸들 정의
const HANDLES = [
  { id: "nw", cursor: "nwse-resize", x: 0, y: 0, dx: -1, dy: -1 },
  { id: "n", cursor: "ns-resize", x: 0.5, y: 0, dx: 0, dy: -1 },
  { id: "ne", cursor: "nesw-resize", x: 1, y: 0, dx: 1, dy: -1 },
  { id: "w", cursor: "ew-resize", x: 0, y: 0.5, dx: -1, dy: 0 },
  { id: "e", cursor: "ew-resize", x: 1, y: 0.5, dx: 1, dy: 0 },
  { id: "sw", cursor: "nesw-resize", x: 0, y: 1, dx: -1, dy: 1 },
  { id: "s", cursor: "ns-resize", x: 0.5, y: 1, dx: 0, dy: 1 },
  { id: "se", cursor: "nwse-resize", x: 1, y: 1, dx: 1, dy: 1 },
];

export default function ResizeHandles({
  bounds, // { x, y, width, height } - 그리드 좌표
  zoom = 1,
  panX = 0,
  panY = 0,
  onResizeStart,
  onResize,
  onResizeEnd,
  elementId, // 스마트 가이드용 요소 ID
  getOtherElements, // 스마트 가이드용 다른 요소 가져오기 함수
}) {
  const resizeRef = useRef({
    isResizing: false,
    handleId: null,
    startMouseX: 0,
    startMouseY: 0,
    startBounds: null,
  });

  const handleMouseDown = useCallback(
    (e, handle) => {
      e.preventDefault();
      e.stopPropagation();

      resizeRef.current = {
        isResizing: true,
        handleId: handle.id,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startBounds: { ...bounds },
        handle,
      };

      onResizeStart?.(handle);

      const handleMouseMove = (moveEvent) => {
        if (!resizeRef.current.isResizing) return;

        const { handle, startMouseX, startMouseY, startBounds } =
          resizeRef.current;

        // 마우스 이동량 계산 (줌 보정)
        const rawDeltaX = (moveEvent.clientX - startMouseX) / zoom;
        const rawDeltaY = (moveEvent.clientY - startMouseY) / zoom;

        // 새 bounds 계산 (스냅 전)
        let newX = startBounds.x;
        let newY = startBounds.y;
        let newWidth = startBounds.width;
        let newHeight = startBounds.height;

        // 핸들 방향에 따라 크기 조정
        if (handle.dx === -1) {
          // 왼쪽 핸들: x 이동 + width 조정
          newWidth = Math.max(MIN_SIZE, startBounds.width - rawDeltaX);
          if (newWidth > MIN_SIZE) {
            newX = startBounds.x + rawDeltaX;
          } else {
            newX = startBounds.x + startBounds.width - MIN_SIZE;
          }
        } else if (handle.dx === 1) {
          // 오른쪽 핸들: width만 조정
          newWidth = Math.max(MIN_SIZE, startBounds.width + rawDeltaX);
        }

        if (handle.dy === -1) {
          // 위쪽 핸들: y 이동 + height 조정
          newHeight = Math.max(MIN_SIZE, startBounds.height - rawDeltaY);
          if (newHeight > MIN_SIZE) {
            newY = startBounds.y + rawDeltaY;
          } else {
            newY = startBounds.y + startBounds.height - MIN_SIZE;
          }
        } else if (handle.dy === 1) {
          // 아래쪽 핸들: height만 조정
          newHeight = Math.max(MIN_SIZE, startBounds.height + rawDeltaY);
        }

        // 그리드 스냅 적용 (RESIZE_SNAP_SIZE 단위로)
        newX = Math.round(newX / RESIZE_SNAP_SIZE) * RESIZE_SNAP_SIZE;
        newY = Math.round(newY / RESIZE_SNAP_SIZE) * RESIZE_SNAP_SIZE;
        newWidth = Math.round(newWidth / RESIZE_SNAP_SIZE) * RESIZE_SNAP_SIZE;
        newHeight = Math.round(newHeight / RESIZE_SNAP_SIZE) * RESIZE_SNAP_SIZE;

        // 최소 크기 보장
        newWidth = Math.max(MIN_SIZE, newWidth);
        newHeight = Math.max(MIN_SIZE, newHeight);

        onResize?.({
          x: newX,
          y: newY,
          width: newWidth,
          height: newHeight,
          handle,
        });
      };

      const handleMouseUp = () => {
        resizeRef.current.isResizing = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        window.removeEventListener("blur", handleMouseUp);
        onResizeEnd?.();
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("blur", handleMouseUp);
    },
    [bounds, zoom, onResizeStart, onResize, onResizeEnd]
  );

  if (!bounds) return null;

  // 선택 테두리의 중심선 기준 좌표 (테두리 두께 2px의 중심 = 1px)
  const borderThickness = 2;
  const borderCenter = borderThickness / 2; // 테두리의 중심선까지의 거리
  const selectionLeft = bounds.x * zoom + panX - borderCenter;
  const selectionTop = bounds.y * zoom + panY - borderCenter;
  const selectionWidth = bounds.width * zoom + borderCenter * 2;
  const selectionHeight = bounds.height * zoom + borderCenter * 2;

  return (
    <>
      {HANDLES.map((handle) => {
        // 핸들 중심 위치 계산 (선택 테두리의 가장자리 중앙에 배치)
        const centerX = selectionLeft + selectionWidth * handle.x;
        const centerY = selectionTop + selectionHeight * handle.y;

        // 시각적 핸들 위치 (중심에서 반만큼 오프셋)
        const visualX = centerX - HANDLE_VISUAL_HALF;
        const visualY = centerY - HANDLE_VISUAL_HALF;

        // 히트 영역 위치 (중심에서 반만큼 오프셋)
        const hitX = centerX - HANDLE_HIT_HALF;
        const hitY = centerY - HANDLE_HIT_HALF;

        return (
          <div
            key={handle.id}
            style={{
              position: "absolute",
              // 히트 영역 (투명, 더 넓은 클릭 범위)
              left: hitX,
              top: hitY,
              width: HANDLE_HIT_SIZE,
              height: HANDLE_HIT_SIZE,
              cursor: handle.cursor,
              zIndex: 21,
              // 히트 영역은 투명
              backgroundColor: "transparent",
              // 디버깅용: 히트 영역 시각화 (필요시 주석 해제)
              // backgroundColor: "rgba(255, 0, 0, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseDown={(e) => handleMouseDown(e, handle)}
          >
            {/* 시각적 핸들 (히트 영역 중앙에 배치) */}
            <div
              style={{
                width: HANDLE_VISUAL_SIZE,
                height: HANDLE_VISUAL_SIZE,
                backgroundColor: "white",
                border: "1px solid rgba(59, 130, 246, 0.8)",
                borderRadius: "1px",
                // boxShadow: "0 0 2px rgba(0, 0, 0, 0.3)",
                pointerEvents: "none",
              }}
            />
          </div>
        );
      })}
    </>
  );
}
