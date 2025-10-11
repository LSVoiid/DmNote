import React, { memo } from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { getKeyCounterSignal } from "@stores/keyCounterSignals";
import CountDisplay from "@components/overlay/CountDisplay";

const KeyCounter = memo(({ globalKey, position, mode }) => {
  useSignals();
  const counterSignal = getKeyCounterSignal(mode ?? "", globalKey);
  const count = counterSignal?.value ?? 0;

  const dx = Number.isFinite(position?.dx) ? position.dx : 0;
  const dy = Number.isFinite(position?.dy) ? position.dy : 0;
  const width = Number.isFinite(position?.width) ? position.width : 0;
  const height = Number.isFinite(position?.height) ? position.height : 0;

  return (
    <div
      className="absolute flex justify-center pointer-events-none"
      style={{
        top: `${dy - 16}px`,
        left: `${dx}px`,
        width: `${width}px`,
        height: `${height}px`,
      }}
    >
      <CountDisplay count={count} />
    </div>
  );
});

export default function KeyCounterLayer({ keys, positions, mode }) {
  if (!keys?.length || !positions?.length) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 12 }}
    >
      {keys.map((key, index) => {
        const position = positions[index];
        if (!position) return null;
        return (
          <KeyCounter
            key={`${mode}-${key}-${index}`}
            globalKey={key}
            position={position}
            mode={mode}
          />
        );
      })}
    </div>
  );
}
