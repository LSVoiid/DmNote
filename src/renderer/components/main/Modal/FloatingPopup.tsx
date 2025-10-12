import React, { useEffect } from "react";
import {
  useFloating,
  offset as fuiOffset,
  shift,
  flip,
  autoUpdate,
} from "@floating-ui/react";

type FloatingPopupProps = {
  open: boolean;
  referenceRef?: React.RefObject<HTMLElement>;
  placement?: any;
  offset?: number;
  offsetX?: number;
  offsetY?: number;
  fixedX?: number;
  fixedY?: number;
  interactiveRefs?: Array<React.RefObject<HTMLElement>>;
  onClose?: () => void;
  className?: string;
  children?: React.ReactNode;
  autoClose?: boolean;
};

const FloatingPopup = ({
  open,
  referenceRef,
  placement = "top",
  offset = 20,
  offsetX = 0,
  offsetY = 0,
  fixedX,
  fixedY,
  interactiveRefs = [],
  onClose,
  className = "",
  children,
  autoClose = true,
}: FloatingPopupProps) => {
  const { x, y, refs, strategy, update } = useFloating({
    placement,
    middleware: [fuiOffset(offset), shift(), flip()],
    whileElementsMounted: autoUpdate,
  });

  useEffect(() => {
    if (referenceRef && referenceRef.current)
      refs.setReference(referenceRef.current);
  }, [referenceRef, refs.setReference]);

  useEffect(() => {
    if (open && autoClose) {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose?.();
      };

      const onClickAway = (e: MouseEvent) => {
        const target = e.target as Node;
        if (!refs.floating.current) return;
        if (
          refs.floating.current.contains(target) ||
          (referenceRef &&
            referenceRef.current &&
            referenceRef.current.contains(target))
        )
          return;
        onClose?.();
      };

      document.addEventListener("keydown", onKey);
      document.addEventListener("mousedown", onClickAway);
      return () => {
        document.removeEventListener("keydown", onKey);
        document.removeEventListener("mousedown", onClickAway);
      };
    }
  }, [open, autoClose, onClose, referenceRef, refs.floating]);

  useEffect(() => {
    if (open) update?.();
  }, [open, update]);

  useEffect(() => {
    if (!open || autoClose) return;

    let pointerCapturedInside = false;

    const floatingEl = refs.floating.current;
    const referenceEl = referenceRef?.current ?? null;

    const handlePointerDownInside = () => {
      pointerCapturedInside = true;
    };

    const handlePointerUp = () => {
      pointerCapturedInside = false;
    };

    const handleDocumentDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const interactiveEls = interactiveRefs
        .map((r) => r?.current)
        .filter(Boolean) as HTMLElement[];
      if (!floatingEl) return;

      const isInsideFloating = floatingEl.contains(target);
      const isInsideReference = referenceEl?.contains(target) ?? false;
      const isInsideInteractive = interactiveEls.some((el) => el.contains(target as Node));

      if (isInsideFloating) {
        pointerCapturedInside = true;
        return;
      }

      if (
        pointerCapturedInside &&
        (event.type === "pointerdown" || event.type === "mousedown")
      ) {
        pointerCapturedInside = false;
      }

      if (isInsideReference || isInsideInteractive) {
        pointerCapturedInside = false;
        return;
      }

      if (pointerCapturedInside) {
        return;
      }

      onClose?.();
    };

    floatingEl?.addEventListener("pointerdown", handlePointerDownInside);
    document.addEventListener("pointerup", handlePointerUp, true);
    document.addEventListener("pointerdown", handleDocumentDown, true);
    document.addEventListener("mousedown", handleDocumentDown, true);

    return () => {
      floatingEl?.removeEventListener("pointerdown", handlePointerDownInside);
      document.removeEventListener("pointerup", handlePointerUp, true);
      document.removeEventListener("pointerdown", handleDocumentDown, true);
      document.removeEventListener("mousedown", handleDocumentDown, true);
    };
  }, [open, autoClose, onClose, referenceRef, refs.floating]);

  if (!open) return null;

  const isFixed = typeof fixedX === "number" && typeof fixedY === "number";
  const left = (isFixed ? (fixedX as number) : x ?? 0) + offsetX;
  const top = (isFixed ? (fixedY as number) : y ?? 0) + offsetY;

  return (
    <div
      ref={refs.setFloating as any}
      style={{
        position: isFixed ? "fixed" : (strategy as any),
        left,
        top,
      }}
      className={`${className} tooltip-fade-in`}
      role="dialog"
      aria-modal="false"
    >
      {children}
    </div>
  );
};

export default FloatingPopup;
