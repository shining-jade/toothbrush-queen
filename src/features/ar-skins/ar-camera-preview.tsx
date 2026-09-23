"use client";

import { useEffect, useRef, useState } from "react";

import { CameraPreview } from "@/features/brushing-session/camera-preview";
import type { FaceTracker } from "@/lib/face-tracking/face-tracker";

import { FacePresenceClock } from "./face-presence-clock";
import { mirrorPose, smoothFacePose, type FacePose } from "./face-pose";
import { boundedOverlayStyle, type PixelSize } from "./bounded-overlay";
import type { ArSkin } from "./skin-registry";
import styles from "./ar-camera-preview.module.css";

export function ArCameraPreview({
  stream,
  skin,
  tracker,
  elapsedSec,
  onFaceDetectedSecChange,
}: {
  stream: MediaStream;
  skin: ArSkin;
  tracker: FaceTracker;
  elapsedSec: number;
  onFaceDetectedSecChange: (seconds: number | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const elapsedRef = useRef(elapsedSec);
  const [pose, setPose] = useState<FacePose | null>(null);
  const [detected, setDetected] = useState(false);
  const [hasTrackingResult, setHasTrackingResult] = useState(false);
  const [hasDetectedFace, setHasDetectedFace] = useState(false);
  const [failed, setFailed] = useState(false);
  const [stageSize, setStageSize] = useState<PixelSize | null>(null);
  const [imageSize, setImageSize] = useState<PixelSize | null>(null);

  useEffect(() => { elapsedRef.current = elapsedSec; }, [elapsedSec]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const bounds = stage.getBoundingClientRect();
      setStageSize({ width: bounds.width, height: bounds.height });
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => { setImageSize(null); }, [skin.src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const clock = new FacePresenceClock();
    let active = true;
    void tracker.start(video, (result) => {
      if (!active) return;
      const visible = result.detected && result.pose !== null;
      setHasTrackingResult(true);
      clock.update({ nowMs: result.nowMs, visible, documentVisible: !document.hidden });
      setDetected(visible);
      if (result.pose) {
        setHasDetectedFace(true);
        const mirrored = mirrorPose(result.pose);
        setPose((previous) => smoothFacePose(previous, mirrored));
      } else {
        setPose(null);
      }
      onFaceDetectedSecChange(clock.seconds(elapsedRef.current));
    }, () => {
      if (!active) return;
      setFailed(true);
      setPose(null);
      onFaceDetectedSecChange(null);
    }).catch(() => {
      if (!active) return;
      setFailed(true);
      onFaceDetectedSecChange(null);
    });
    return () => {
      active = false;
      tracker.stop();
    };
  }, [onFaceDetectedSecChange, tracker]);

  const style = pose && stageSize && imageSize
    ? boundedOverlayStyle(pose, skin.calibration, stageSize, imageSize, 8)
    : null;

  return (
    <div ref={stageRef} className={styles.stage}>
      <CameraPreview ref={videoRef} stream={stream} />
      {!failed && detected && pose && (
        // A plain image avoids optimizer latency while the overlay moves every frame.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          data-testid="ar-skin-overlay"
          className={styles.overlay}
          src={skin.src}
          alt=""
          style={style ?? { visibility: "hidden" }}
          onLoad={(event) => setImageSize({
            width: event.currentTarget.naturalWidth,
            height: event.currentTarget.naturalHeight,
          })}
        />
      )}
      {failed ? <p className={styles.message}>AR 효과 없이 계속 진행해요.</p>
        : !detected && (
          <p className={styles.message}>
            {hasDetectedFace || hasTrackingResult
              ? "얼굴이 화면에 보이도록 해주세요!"
              : "얼굴을 인식하고 있어요."}
          </p>
        )}
    </div>
  );
}
