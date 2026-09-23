import { skinOverlayStyle, type SkinCalibration } from "./skin-calibration";
import styles from "./skin-upload.module.css";

const PREVIEW_POSE = { centerX: 0.5, centerY: 0.48, width: 0.42, rotationDeg: 0 };

export function SkinPreview({ imageUrl, calibration }: {
  imageUrl?: string;
  calibration: SkinCalibration;
}) {
  return (
    <section className={styles.previewCard} aria-label="스킨 미리보기">
      <div className={styles.previewStage}>
        <div className={styles.faceGuide} aria-hidden="true">
          <span className={styles.eyeLeft} />
          <span className={styles.eyeRight} />
          <span className={styles.smile} />
        </div>
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.previewSkin} src={imageUrl} alt="업로드한 스킨 미리보기" style={skinOverlayStyle(PREVIEW_POSE, calibration)} />
        )}
      </div>
      <p>얼굴 안내선에 맞춰 위치와 크기를 조정해 보세요.</p>
    </section>
  );
}
