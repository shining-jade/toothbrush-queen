"use client";

import { useRef, useState, type PointerEvent } from "react";

import { constrainTimerPosition } from "@/features/brushing-session/adjustable-countdown";

import styles from "./ar-camera-preview.module.css";

export function PhotoCaptureButton({ disabled, onCapture }: { disabled: boolean; onCapture: () => void }) {
  const [position, setPosition] = useState({ x: 22, y: 65 });
  const gesture = useRef<{ id: number; x: number; y: number; offsetX: number; offsetY: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  function move(event: PointerEvent<HTMLButtonElement>) {
    const drag = gesture.current;
    if (!drag || drag.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 6) drag.moved = true;
    if (!drag.moved) return;
    const stage = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!stage || stage.width <= 0 || stage.height <= 0) return;
    const button = event.currentTarget.getBoundingClientRect();
    setPosition(constrainTimerPosition(
      { x: event.clientX - drag.offsetX, y: event.clientY - drag.offsetY },
      stage,
      { width: button.width, height: button.height },
    ));
  }

  return <button
    type="button"
    className={styles.captureButton}
    aria-label="사진 찍기"
    title="사진 찍기 · 끌어서 이동"
    disabled={disabled}
    style={{ left: `clamp(58px, ${position.x}%, calc(100% - 58px))`, top: `clamp(34px, ${position.y}%, calc(100% - 34px))` }}
    onPointerDown={(event) => {
      if (event.button !== 0) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      suppressClick.current = false;
      gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, offsetX: event.clientX - bounds.left - bounds.width / 2, offsetY: event.clientY - bounds.top - bounds.height / 2, moved: false };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }}
    onPointerMove={move}
    onPointerUp={(event) => {
      move(event);
      suppressClick.current = gesture.current?.moved ?? false;
      gesture.current = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }}
    onPointerCancel={() => { gesture.current = null; suppressClick.current = true; }}
    onLostPointerCapture={() => { gesture.current = null; }}
    onClick={(event) => {
      if (event.detail !== 0 && suppressClick.current) { suppressClick.current = false; return; }
      onCapture();
    }}
  ><span className={styles.captureDragHandle} aria-hidden="true">⠿</span><span>{disabled ? "촬영 중…" : "사진 찍기"}</span></button>;
}
