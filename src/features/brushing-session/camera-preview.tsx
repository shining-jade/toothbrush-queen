"use client";

import { useEffect, useRef } from "react";

export function CameraPreview({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <video
      ref={videoRef}
      className="camera-preview"
      aria-label="내 얼굴 카메라 미리보기"
      autoPlay
      muted
      playsInline
    />
  );
}
