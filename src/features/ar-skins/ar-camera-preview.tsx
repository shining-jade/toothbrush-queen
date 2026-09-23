"use client";

import { useEffect, useRef, useState } from "react";

import { CameraPreview } from "@/features/brushing-session/camera-preview";
import type { FaceTracker } from "@/lib/face-tracking/face-tracker";

import { FacePresenceClock } from "./face-presence-clock";
import { mirrorPose, smoothFacePose, type FacePose } from "./face-pose";
import { skinOverlayStyle } from "@/features/admin/skin-upload/skin-calibration";
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
  const elapsedRef = useRef(elapsedSec);
  const [pose, setPose] = useState<FacePose | null>(null);
  const [detected, setDetected] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => { elapsedRef.current = elapsedSec; }, [elapsedSec]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const clock = new FacePresenceClock();
    let active = true;
    void tracker.start(video, (result) => {
      if (!active) return;
      const visible = result.detected && result.pose !== null;
      clock.update({ nowMs: result.nowMs, visible, documentVisible: !document.hidden });
      setDetected(visible);
      if (result.pose) {
        const mirrored = mirrorPose(result.pose);
        setPose((previous) => smoothFacePose(previous, mirrored));
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

  const style = pose ? skinOverlayStyle(pose, skin.calibration) : undefined;

  return (
    <div className={styles.stage}>
      <CameraPreview ref={videoRef} stream={stream} />
      {!failed && pose && (
        // A plain image avoids optimizer latency while the overlay moves every frame.
        // eslint-disable-next-line @next/next/no-img-element
        <img data-testid="ar-skin-overlay" className={styles.overlay} src={skin.src} alt="" style={style} />
      )}
      {failed ? <p className={styles.message}>AR 효과 없이 계속 진행해요.</p>
        : !detected && <p className={styles.message}>얼굴이 화면에 보이도록 해주세요!</p>}
    </div>
  );
}
