"use client";

import { useRef, useState, type PointerEvent } from "react";

type Position = { x: number; y: number };
type Bounds = { left: number; top: number; width: number; height: number };
type Size = { width: number; height: number };

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export function constrainTimerPosition(
  pointer: Position,
  stage: Bounds,
  timer: Size,
  margin = 12,
): Position {
  const halfWidth = timer.width / 2;
  const halfHeight = timer.height / 2;
  const minimumX = halfWidth + margin;
  const maximumX = Math.max(minimumX, stage.width - halfWidth - margin);
  const minimumY = halfHeight + margin;
  const maximumY = Math.max(minimumY, stage.height - halfHeight - margin);
  return {
    x: clamp(pointer.x - stage.left, minimumX, maximumX) / stage.width * 100,
    y: clamp(pointer.y - stage.top, minimumY, maximumY) / stage.height * 100,
  };
}

export function AdjustableCountdown({ value }: { value: string }) {
  const [compact, setCompact] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 76, y: 9 });
  const activePointer = useRef<number | null>(null);

  function move(event: PointerEvent<HTMLDivElement>) {
    if (activePointer.current !== event.pointerId) return;
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;
    const timer = event.currentTarget.getBoundingClientRect();
    setPosition(constrainTimerPosition(
      { x: event.clientX, y: event.clientY },
      bounds,
      { width: timer.width, height: timer.height },
    ));
  }

  return (
    <div
      className="adjustable-countdown"
      aria-label="양치 초시계"
      aria-live="polite"
      data-size={compact ? "compact" : "normal"}
      style={{ left: `${position.x}%`, top: `${position.y}%` }}
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest("button")) return;
        activePointer.current = event.pointerId;
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerMove={move}
      onPointerUp={(event) => {
        move(event);
        activePointer.current = null;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      }}
      onPointerCancel={() => { activePointer.current = null; }}
    >
      <span className="timer-drag-handle" aria-hidden="true">⠿</span>
      <strong>{value}</strong>
      <button
        type="button"
        aria-label={compact ? "초시계 크게 보기" : "초시계 작게 보기"}
        onClick={() => setCompact((current) => !current)}
      >
        {compact ? "+" : "−"}
      </button>
    </div>
  );
}
