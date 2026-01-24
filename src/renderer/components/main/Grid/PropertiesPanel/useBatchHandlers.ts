import { useCallback } from "react";
import type {
  KeyPosition,
  NoteColor,
  KeyCounterSettings,
} from "@src/types/keys";
import { normalizeCounterSettings } from "@src/types/keys";

const DEFAULT_ACTIVE_BACKGROUND_COLOR = "rgba(121, 121, 121, 0.9)";
const DEFAULT_ACTIVE_BORDER_COLOR = "rgba(255, 255, 255, 0.9)";
const DEFAULT_ACTIVE_FONT_COLOR = "#FFFFFF";

interface SelectedElement {
  type: string;
  index?: number;
}

interface UseBatchHandlersProps {
  selectedKeyElements: SelectedElement[];
  positions: Record<string, KeyPosition[] | undefined>;
  selectedKeyType: string;
  onKeyUpdate: (data: Partial<KeyPosition> & { index: number }) => void;
  onKeyBatchUpdate?: (updates: Array<{ index: number } & Partial<KeyPosition>>) => void;
  onKeyPreview?: (index: number, updates: Partial<KeyPosition>) => void;
  onKeyBatchPreview?: (updates: Array<{ index: number } & Partial<KeyPosition>>) => void;
}

export function useBatchHandlers({
  selectedKeyElements,
  positions,
  selectedKeyType,
  onKeyUpdate,
  onKeyBatchUpdate,
  onKeyPreview,
  onKeyBatchPreview,
}: UseBatchHandlersProps) {
  // 스타일 변경 (프리뷰)
  const handleBatchStyleChange = useCallback(
    (property: keyof KeyPosition, value: any) => {
      const updates = selectedKeyElements
        .filter((el) => el.index !== undefined)
        .map((el) => ({ index: el.index!, [property]: value }));

      if (onKeyBatchPreview && updates.length > 0) {
        onKeyBatchPreview(updates);
      } else if (onKeyPreview) {
        updates.forEach((update) => {
          const { index, ...rest } = update;
          onKeyPreview(index, rest);
        });
      }
    },
    [selectedKeyElements, onKeyBatchPreview, onKeyPreview],
  );

  // 스타일 변경 완료 (저장)
  const handleBatchStyleChangeComplete = useCallback(
    (property: keyof KeyPosition, value: any) => {
      const currentPositions = positions[selectedKeyType] || [];

      const updates = selectedKeyElements
        .filter((el) => el.index !== undefined)
        .map((el) => {
          const index = el.index!;
          const pos = currentPositions[index];

          // idle 값을 바꿀 때 active 값이 비어 있으면,
          // 현재 표시되던 active 값을 함께 저장해(active가 idle로 따라가는 현상 방지)
          if (pos) {
            if (property === "backgroundColor" && pos.activeBackgroundColor == null) {
              return {
                index,
                backgroundColor: value,
                activeBackgroundColor:
                  pos.activeBackgroundColor ??
                  pos.backgroundColor ??
                  DEFAULT_ACTIVE_BACKGROUND_COLOR,
              };
            }
            if (property === "borderColor" && pos.activeBorderColor == null) {
              return {
                index,
                borderColor: value,
                activeBorderColor:
                  pos.activeBorderColor ??
                  pos.borderColor ??
                  DEFAULT_ACTIVE_BORDER_COLOR,
              };
            }
            if (property === "fontColor" && pos.activeFontColor == null) {
              return {
                index,
                fontColor: value,
                activeFontColor:
                  pos.activeFontColor ??
                  pos.fontColor ??
                  DEFAULT_ACTIVE_FONT_COLOR,
              };
            }
          }

          return { index, [property]: value } as { index: number } & Partial<KeyPosition>;
        });

      if (onKeyBatchUpdate && updates.length > 0) {
        onKeyBatchUpdate(updates);
      } else {
        updates.forEach((update) => onKeyUpdate(update));
      }
    },
    [
      onKeyBatchUpdate,
      onKeyUpdate,
      positions,
      selectedKeyElements,
      selectedKeyType,
    ],
  );

  // 정렬 핸들러
  const handleBatchAlign = useCallback(
    (direction: "left" | "centerH" | "right" | "top" | "centerV" | "bottom") => {
      const keyData = selectedKeyElements
        .filter((el) => el.index !== undefined)
        .map((el) => {
          const pos = positions[selectedKeyType]?.[el.index!];
          return pos ? { index: el.index!, x: pos.dx, y: pos.dy, width: pos.width, height: pos.height } : null;
        })
        .filter((d): d is { index: number; x: number; y: number; width: number; height: number } => d !== null);

      if (keyData.length < 2) return;

      let updates: Array<{ index: number } & Partial<KeyPosition>> = [];

      switch (direction) {
        case "left": {
          const minX = Math.min(...keyData.map((k) => k.x));
          updates = keyData.map((k) => ({ index: k.index, dx: minX }));
          break;
        }
        case "centerH": {
          const minX = Math.min(...keyData.map((k) => k.x));
          const maxX = Math.max(...keyData.map((k) => k.x + k.width));
          const centerX = (minX + maxX) / 2;
          updates = keyData.map((k) => ({ index: k.index, dx: centerX - k.width / 2 }));
          break;
        }
        case "right": {
          const maxX = Math.max(...keyData.map((k) => k.x + k.width));
          updates = keyData.map((k) => ({ index: k.index, dx: maxX - k.width }));
          break;
        }
        case "top": {
          const minY = Math.min(...keyData.map((k) => k.y));
          updates = keyData.map((k) => ({ index: k.index, dy: minY }));
          break;
        }
        case "centerV": {
          const minY = Math.min(...keyData.map((k) => k.y));
          const maxY = Math.max(...keyData.map((k) => k.y + k.height));
          const centerY = (minY + maxY) / 2;
          updates = keyData.map((k) => ({ index: k.index, dy: centerY - k.height / 2 }));
          break;
        }
        case "bottom": {
          const maxY = Math.max(...keyData.map((k) => k.y + k.height));
          updates = keyData.map((k) => ({ index: k.index, dy: maxY - k.height }));
          break;
        }
      }

      if (onKeyBatchUpdate && updates.length > 0) {
        onKeyBatchUpdate(updates);
      } else {
        updates.forEach((update) => onKeyUpdate(update));
      }
    },
    [selectedKeyElements, positions, selectedKeyType, onKeyBatchUpdate, onKeyUpdate],
  );

  // 분배 핸들러
  const handleBatchDistribute = useCallback(
    (direction: "horizontal" | "vertical") => {
      const keyData = selectedKeyElements
        .filter((el) => el.index !== undefined)
        .map((el) => {
          const pos = positions[selectedKeyType]?.[el.index!];
          return pos ? { index: el.index!, x: pos.dx, y: pos.dy, width: pos.width, height: pos.height } : null;
        })
        .filter((d): d is { index: number; x: number; y: number; width: number; height: number } => d !== null);

      if (keyData.length < 3) return;

      let updates: Array<{ index: number } & Partial<KeyPosition>> = [];

      if (direction === "horizontal") {
        const sorted = [...keyData].sort((a, b) => a.x - b.x);
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const totalSpan = (last.x + last.width) - first.x;
        const totalWidths = sorted.reduce((sum, k) => sum + k.width, 0);
        const gap = (totalSpan - totalWidths) / (sorted.length - 1);

        let currentX = first.x;
        updates = sorted.map((k) => {
          const newX = currentX;
          currentX += k.width + gap;
          return { index: k.index, dx: newX };
        });
      } else {
        const sorted = [...keyData].sort((a, b) => a.y - b.y);
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const totalSpan = (last.y + last.height) - first.y;
        const totalHeights = sorted.reduce((sum, k) => sum + k.height, 0);
        const gap = (totalSpan - totalHeights) / (sorted.length - 1);

        let currentY = first.y;
        updates = sorted.map((k) => {
          const newY = currentY;
          currentY += k.height + gap;
          return { index: k.index, dy: newY };
        });
      }

      if (onKeyBatchUpdate && updates.length > 0) {
        onKeyBatchUpdate(updates);
      } else {
        updates.forEach((update) => onKeyUpdate(update));
      }
    },
    [selectedKeyElements, positions, selectedKeyType, onKeyBatchUpdate, onKeyUpdate],
  );

  // 일괄 크기 변경 핸들러
  const handleBatchResize = useCallback(
    (dimension: "width" | "height", value: number) => {
      const updates = selectedKeyElements
        .filter((el) => el.index !== undefined)
        .map((el) => ({ index: el.index!, [dimension]: value }));

      if (onKeyBatchUpdate && updates.length > 0) {
        onKeyBatchUpdate(updates);
      } else {
        updates.forEach((update) => onKeyUpdate(update));
      }
    },
    [selectedKeyElements, onKeyBatchUpdate, onKeyUpdate],
  );

  // 카운터 업데이트 핸들러
  const handleBatchCounterUpdate = useCallback(
    (updates: Partial<KeyCounterSettings>) => {
      const batchUpdates = selectedKeyElements
        .filter((el) => el.index !== undefined)
        .map((el) => {
          const pos = positions[selectedKeyType]?.[el.index!];
          if (pos) {
            const currentSettings = normalizeCounterSettings(pos.counter);
            const newSettings = { ...currentSettings, ...updates };
            return { index: el.index!, counter: newSettings };
          }
          return null;
        })
        .filter((update): update is { index: number; counter: KeyCounterSettings } => update !== null);

      if (onKeyBatchUpdate && batchUpdates.length > 0) {
        onKeyBatchUpdate(batchUpdates);
      } else {
        batchUpdates.forEach((update) => onKeyUpdate(update));
      }
    },
    [selectedKeyElements, positions, selectedKeyType, onKeyBatchUpdate, onKeyUpdate],
  );

  // 노트 색상 변경 (프리뷰)
  const handleBatchNoteColorChange = useCallback(
    (newColor: any) => {
      let colorValue: NoteColor;
      if (
        newColor &&
        typeof newColor === "object" &&
        newColor.type === "gradient"
      ) {
        colorValue = {
          type: "gradient",
          top: newColor.top,
          bottom: newColor.bottom,
        };
      } else {
        colorValue = newColor;
      }

      const updates = selectedKeyElements
        .filter((el) => el.index !== undefined)
        .map((el) => ({ index: el.index!, noteColor: colorValue }));

      if (onKeyBatchPreview && updates.length > 0) {
        onKeyBatchPreview(updates);
      } else if (onKeyPreview) {
        updates.forEach((update) => {
          const { index, ...rest } = update;
          onKeyPreview(index, rest);
        });
      }
    },
    [selectedKeyElements, onKeyBatchPreview, onKeyPreview],
  );

  // 노트 색상 변경 완료 (저장)
  const handleBatchNoteColorChangeComplete = useCallback(
    (newColor: any) => {
      let colorValue: NoteColor;
      if (
        newColor &&
        typeof newColor === "object" &&
        newColor.type === "gradient"
      ) {
        colorValue = {
          type: "gradient",
          top: newColor.top,
          bottom: newColor.bottom,
        };
      } else {
        colorValue = newColor;
      }

      const updates = selectedKeyElements
        .filter((el) => el.index !== undefined)
        .map((el) => ({ index: el.index!, noteColor: colorValue }));

      if (onKeyBatchUpdate && updates.length > 0) {
        onKeyBatchUpdate(updates);
      } else {
        updates.forEach((update) => onKeyUpdate(update));
      }
    },
    [selectedKeyElements, onKeyBatchUpdate, onKeyUpdate],
  );

  // 글로우 색상 변경 (프리뷰)
  const handleBatchGlowColorChange = useCallback(
    (newColor: any) => {
      let colorValue: NoteColor;
      if (
        newColor &&
        typeof newColor === "object" &&
        newColor.type === "gradient"
      ) {
        colorValue = {
          type: "gradient",
          top: newColor.top,
          bottom: newColor.bottom,
        };
      } else {
        colorValue = newColor;
      }

      const updates = selectedKeyElements
        .filter((el) => el.index !== undefined)
        .map((el) => ({ index: el.index!, noteGlowColor: colorValue }));

      if (onKeyBatchPreview && updates.length > 0) {
        onKeyBatchPreview(updates);
      } else if (onKeyPreview) {
        updates.forEach((update) => {
          const { index, ...rest } = update;
          onKeyPreview(index, rest);
        });
      }
    },
    [selectedKeyElements, onKeyBatchPreview, onKeyPreview],
  );

  // 글로우 색상 변경 완료 (저장)
  const handleBatchGlowColorChangeComplete = useCallback(
    (newColor: any) => {
      let colorValue: NoteColor;
      if (
        newColor &&
        typeof newColor === "object" &&
        newColor.type === "gradient"
      ) {
        colorValue = {
          type: "gradient",
          top: newColor.top,
          bottom: newColor.bottom,
        };
      } else {
        colorValue = newColor;
      }

      const updates = selectedKeyElements
        .filter((el) => el.index !== undefined)
        .map((el) => ({ index: el.index!, noteGlowColor: colorValue }));

      if (onKeyBatchUpdate && updates.length > 0) {
        onKeyBatchUpdate(updates);
      } else {
        updates.forEach((update) => onKeyUpdate(update));
      }
    },
    [selectedKeyElements, onKeyBatchUpdate, onKeyUpdate],
  );

  return {
    handleBatchStyleChange,
    handleBatchStyleChangeComplete,
    handleBatchAlign,
    handleBatchDistribute,
    handleBatchResize,
    handleBatchCounterUpdate,
    handleBatchNoteColorChange,
    handleBatchNoteColorChangeComplete,
    handleBatchGlowColorChange,
    handleBatchGlowColorChangeComplete,
  };
}
