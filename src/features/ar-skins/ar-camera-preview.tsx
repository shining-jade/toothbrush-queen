"use client";

import { useEffect, useRef, useState } from "react";

import { CameraPreview } from "@/features/brushing-session/camera-preview";
import type { FaceTracker } from "@/lib/face-tracking/face-tracker";
import type { ToothbrushLikeDetector } from "@/features/brushing-session/toothbrush-like-detector";

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
  preparing = false,
  readinessDetector,
  onReady,
}: {
  stream: MediaStream;
  skin: ArSkin;
  tracker: FaceTracker;
  elapsedSec: number;
  onFaceDetectedSecChange: (seconds: number | null) => void;
  preparing?: boolean;
  readinessDetector?: ToothbrushLikeDetector;
  onReady?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const elapsedRef = useRef(elapsedSec);
  const preparingRef = useRef(preparing);
  const readinessDetectorRef = useRef(readinessDetector);
  const onReadyRef = useRef(onReady);
  const readinessCompleteRef = useRef(false);
  const faceClockRef = useRef(new FacePresenceClock());
  const [pose, setPose] = useState<FacePose | null>(null);
  const [detected, setDetected] = useState(false);
  const [hasTrackingResult, setHasTrackingResult] = useState(false);
  const [hasDetectedFace, setHasDetectedFace] = useState(false);
  const [failed, setFailed] = useState(false);
  const [stageSize, setStageSize] = useState<PixelSize | null>(null);
  const [imageMeasurement, setImageMeasurement] = useState<(PixelSize & { src: string }) | null>(null);

  useEffect(() => { elapsedRef.current = elapsedSec; }, [elapsedSec]);

  useEffect(() => {
    preparingRef.current = preparing;
    readinessDetectorRef.current = readinessDetector;
    onReadyRef.current = onReady;
    readinessCompleteRef.current = false;
    readinessDetector?.reset();
    faceClockRef.current = new FacePresenceClock();
    if (preparing) onFaceDetectedSecChange(0);
  }, [onFaceDetectedSecChange, onReady, preparing, readinessDetector]);

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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let active = true;
    void tracker.start(video, (result) => {
      if (!active) return;
      const visible = result.detected && result.pose !== null;
      setHasTrackingResult(true);
      if (!preparingRef.current) {
        faceClockRef.current.update({ nowMs: result.nowMs, visible, documentVisible: !document.hidden });
      }
      setDetected(visible);
      if (result.pose) {
        setHasDetectedFace(true);
        const mirrored = mirrorPose(result.pose);
        setPose((previous) => smoothFacePose(previous, mirrored));
      } else {
        setPose(null);
      }
      if (preparingRef.current) {
        if (!visible || !result.pose) {
          readinessDetectorRef.current?.reset();
        } else if (!readinessCompleteRef.current && videoRef.current && readinessDetectorRef.current) {
          try {
            if (readinessDetectorRef.current.observe(videoRef.current, result.pose, result.nowMs)) {
              readinessCompleteRef.current = true;
              onReadyRef.current?.();
            }
          } catch {
            readinessDetectorRef.current.reset();
          }
        }
      } else {
        onFaceDetectedSecChange(faceClockRef.current.seconds(elapsedRef.current));
      }
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

  const imageSize = imageMeasurement?.src === skin.src ? imageMeasurement : null;
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
          onLoad={(event) => setImageMeasurement({
            src: skin.src,
            width: event.currentTarget.naturalWidth,
            height: event.currentTarget.naturalHeight,
          })}
        />
      )}
      {failed ? <p className={styles.message}>AR 효과 없이 계속 진행해요.</p>
        : preparing ? (
          <p className={styles.message}>
            {detected ? "칫솔을 입 가까이 가져와 주세요." : "얼굴을 먼저 화면에 보여주세요."}
          </p>
        ) : !detected && (
          <p className={styles.message}>
            {hasDetectedFace || hasTrackingResult
              ? "얼굴이 화면에 보이도록 해주세요!"
              : "얼굴을 인식하고 있어요."}
          </p>
        )}
    </div>
  );
}
