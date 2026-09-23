"use client";

import { forwardRef, useEffect, useRef } from "react";

export const CameraPreview = forwardRef<HTMLVideoElement, { stream: MediaStream }>(
function CameraPreview({ stream }, forwardedRef) {
  const localRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localRef.current) localRef.current.srcObject = stream;
  }, [stream]);

  function setRef(node: HTMLVideoElement | null) {
    localRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }

  return (
    <video
      ref={setRef}
      className="camera-preview"
      aria-label="내 얼굴 카메라 미리보기"
      autoPlay
      muted
      playsInline
    />
  );
});
