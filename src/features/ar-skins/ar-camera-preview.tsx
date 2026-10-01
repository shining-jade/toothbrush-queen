"use client";

import { useEffect, useRef, useState } from "react";

import { CameraPreview } from "@/features/brushing-session/camera-preview";
import type { FaceTracker } from "@/lib/face-tracking/face-tracker";

import { FacePresenceClock } from "./face-presence-clock";
import { mapFacePoseToCover, mirrorPose, smoothFacePose, type FacePose } from "./face-pose";
import { boundedOverlayStyle, type PixelSize } from "./bounded-overlay";
import type { ArSkin } from "./skin-registry";
import styles from "./ar-camera-preview.module.css";
import { PhotoCaptureButton } from "./photo-capture-button";

export function ArCameraPreview({
  stream,
  skin,
  tracker,
  elapsedSec,
  onFaceDetectedSecChange,
  preparing = false,
  onReady,
  allowPhoto = false,
  completed = false,
  onPhotoPauseChange,
}: {
  stream: MediaStream;
  skin: ArSkin;
  tracker: FaceTracker;
  elapsedSec: number;
  onFaceDetectedSecChange: (seconds: number | null) => void;
  preparing?: boolean;
  onReady?: () => void;
  allowPhoto?: boolean;
  completed?: boolean;
  onPhotoPauseChange?: (paused: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLImageElement>(null);
  const photoDialogRef = useRef<HTMLDialogElement>(null);
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [photoMessage, setPhotoMessage] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [saveRequested, setSaveRequested] = useState(false);
  const photoPausedRef = useRef(false);

  function closePhoto() {
    setPhoto(null);
    setPhotoMessage("");
    setSaveRequested(false);
    photoPausedRef.current = false;
    onPhotoPauseChange?.(false);
  }

  useEffect(() => {
    if (!photo) return;
    photoDialogRef.current?.showModal();
    return () => URL.revokeObjectURL(photo.url);
  }, [photo]);
  const elapsedRef = useRef(elapsedSec);
  const preparingRef = useRef(preparing);
  const onReadyRef = useRef(onReady);
  const readinessCompleteRef = useRef(false);
  const faceClockRef = useRef(new FacePresenceClock());
  const [pose, setPose] = useState<FacePose | null>(null);
  const [detected, setDetected] = useState(false);
  const [hasTrackingResult, setHasTrackingResult] = useState(false);
  const [hasDetectedFace, setHasDetectedFace] = useState(false);
  const [failed, setFailed] = useState(false);
  const [stageSize, setStageSize] = useState<PixelSize | null>(null);
  const [videoSize, setVideoSize] = useState<PixelSize | null>(null);
  const [imageMeasurement, setImageMeasurement] = useState<(PixelSize & { src: string }) | null>(null);

  useEffect(() => { elapsedRef.current = elapsedSec; }, [elapsedSec]);

  useEffect(() => {
    preparingRef.current = preparing;
    onReadyRef.current = onReady;
    readinessCompleteRef.current = false;
    faceClockRef.current = new FacePresenceClock();
    if (preparing) onFaceDetectedSecChange(0);
  }, [onFaceDetectedSecChange, onReady, preparing]);

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
        faceClockRef.current.update({ nowMs: result.nowMs, visible, documentVisible: !document.hidden && !photoPausedRef.current });
      }
      setDetected(visible);
      if (result.pose) {
        setHasDetectedFace(true);
        const currentVideo = videoRef.current;
        if (currentVideo?.videoWidth && currentVideo.videoHeight) {
          setVideoSize((current) => (
            current?.width === currentVideo.videoWidth && current.height === currentVideo.videoHeight
              ? current
              : { width: currentVideo.videoWidth, height: currentVideo.videoHeight }
          ));
        }
        const mirrored = mirrorPose(result.pose);
        setPose((previous) => smoothFacePose(previous, mirrored));
      } else {
        setPose(null);
      }
      if (preparingRef.current) {
        if (visible && !readinessCompleteRef.current) {
          readinessCompleteRef.current = true;
          onReadyRef.current?.();
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
  const displayPose = pose && stageSize && videoSize
    ? mapFacePoseToCover(pose, stageSize, videoSize)
    : pose;
  const style = displayPose && stageSize && imageSize
    ? boundedOverlayStyle(displayPose, skin.calibration, stageSize, imageSize, 8, skin.placement)
    : null;

  async function takePhoto() {
    const video = videoRef.current;
    const stage = stageRef.current;
    if (!video || !stage || !video.videoWidth || video.readyState < 2) {
      setPhotoMessage("카메라가 준비되면 다시 촬영해주세요.");
      return;
    }
    setCapturing(true);
    photoPausedRef.current = true;
    onPhotoPauseChange?.(true);
    setSaveRequested(false);
    setPhotoMessage("");
    try {
      const bounds = stage.getBoundingClientRect();
      if (!bounds.width || !bounds.height) throw new Error("Empty stage");
      const canvas = document.createElement("canvas");
      const resolution = Math.min(2, 2048 / Math.max(bounds.width, bounds.height));
      canvas.width = Math.round(bounds.width * resolution);
      canvas.height = Math.round(bounds.height * resolution);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      context.scale(resolution, resolution);
      // Match the mirrored object-fit: cover preview, including its crop.
      const cover = Math.max(bounds.width / video.videoWidth, bounds.height / video.videoHeight);
      context.save();
      context.translate(bounds.width, 0);
      context.scale(-1, 1);
      context.drawImage(video, (bounds.width - video.videoWidth * cover) / 2, (bounds.height - video.videoHeight * cover) / 2, video.videoWidth * cover, video.videoHeight * cover);
      context.restore();
      const overlay = overlayRef.current;
      if (overlay && style?.visibility === "visible" && overlay.complete && overlay.naturalWidth) {
        const width = Number.parseFloat(String(style.width));
        const height = width * overlay.naturalHeight / overlay.naturalWidth;
        let photoOverlay = overlay;
        if (!skin.bundled) {
          photoOverlay = new window.Image();
          photoOverlay.crossOrigin = "anonymous";
          photoOverlay.src = skin.src;
          await photoOverlay.decode();
        }
        context.save();
        context.translate(Number.parseFloat(String(style.left)), Number.parseFloat(String(style.top)));
        context.rotate(((displayPose?.rotationDeg ?? 0) + skin.calibration.rotationOffset) * Math.PI / 180);
        context.drawImage(photoOverlay, -width / 2, -height / 2, width, height);
        context.restore();
      }
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Photo unavailable")), "image/png"));
      const file = new File([blob], `brush-king-${Date.now()}.png`, { type: "image/png" });
      setPhoto({ file, url: URL.createObjectURL(file) });
    } catch {
      photoPausedRef.current = false;
      onPhotoPauseChange?.(false);
      setPhotoMessage("사진을 만들지 못했어요. 기본 또는 다른 스킨으로 다시 시도해주세요.");
    } finally {
      setCapturing(false);
    }
  }

  async function savePhoto() {
    if (!photo) return;
    setSharing(true);
    try {
      if (navigator.share && navigator.canShare?.({ files: [photo.file] })) {
        await navigator.share({ files: [photo.file], title: "양치왕 사진" });
      } else {
        setPhotoMessage("이 브라우저에서는 공유를 지원하지 않아요. 사진 저장을 눌러주세요.");
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setPhotoMessage("공유 창을 열지 못했어요. 사진 저장을 눌러주세요.");
      }
    } finally {
      setSharing(false);
    }
  }

  function downloadPhoto() {
    if (!photo) return;
    const link = document.createElement("a");
    link.href = photo.url;
    link.download = photo.file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setSaveRequested(true);
    setPhotoMessage("저장을 요청했어요. 브라우저의 다운로드 목록에서 확인해주세요.");
  }

  return (
    <div ref={stageRef} className={styles.stage}>
      <CameraPreview ref={videoRef} stream={stream} />
      {skin.id !== "none" && !failed && detected && pose && (
        // A plain image avoids optimizer latency while the overlay moves every frame.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={overlayRef}
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
      {!completed && (failed ? <p className={styles.message}>AR 효과 없이 계속 진행해요.</p>
        : preparing ? (
          <p className={styles.message}>
            얼굴을 화면에 맞추면 자동으로 시작해요.
          </p>
        ) : !detected && (
          <p className={styles.message}>
            {hasDetectedFace || hasTrackingResult
              ? "얼굴이 화면에 보이도록 해주세요!"
              : "얼굴을 인식하고 있어요."}
          </p>
        ))}
      {allowPhoto && <PhotoCaptureButton disabled={capturing} onCapture={() => void takePhoto()} />}
      {allowPhoto && !photo && photoMessage && <p className={styles.captureError} role="status">{photoMessage}</p>}
      <dialog ref={photoDialogRef} className={styles.photoDialog} onCancel={closePhoto} onClose={closePhoto}>
        {photo && <>
          <h2>양치 사진</h2>
          <p className={styles.pauseNotice}>양치 시간 일시정지 중</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.photoPreview} src={photo.url} alt="촬영한 양치 사진" />
          <div className={styles.photoActions}>
            <button type="button" className="primary-action" disabled={sharing} onClick={() => void savePhoto()}>{sharing ? "공유 중…" : "사진 공유"}</button>
            <button type="button" className="secondary-action" disabled={sharing || saveRequested} onClick={downloadPhoto}>{saveRequested ? "저장 요청됨" : "사진 저장"}</button>
            <button type="button" className="secondary-action" disabled={sharing} onClick={() => photoDialogRef.current?.close()}>양치 계속하기</button>
          </div>
          {photoMessage && <p role="status">{photoMessage}</p>}
        </>}
      </dialog>
    </div>
  );
}
