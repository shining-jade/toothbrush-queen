"use client";

import { useRef, useState, type PointerEvent } from "react";

type Position = { x: number; y: number };

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export function AdjustableCountdown({ value }: { value: string }) {
  const [compact, setCompact] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 86, y: 11 });
  const activePointer = useRef<number | null>(null);

  function move(event: PointerEvent<HTMLDivElement>) {
    if (activePointer.current !== event.pointerId) return;
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;
    setPosition({
      x: clamp(((event.clientX - bounds.left) / bounds.width) * 100, 8, 92),
      y: clamp(((event.clientY - bounds.top) / bounds.height) * 100, 8, 92),
    });
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
