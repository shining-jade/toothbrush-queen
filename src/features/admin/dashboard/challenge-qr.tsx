"use client";

import QRCode from "qrcode";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { LoadingIndicator } from "@/components/loading-indicator";

import styles from "./teacher-dashboard.module.css";

type ChallengeQrProps = {
  challengeId: string;
  origin?: string;
  createQr?: (url: string) => Promise<string>;
};

export function ChallengeQr({ challengeId, origin, createQr = defaultCreateQr }: ChallengeQrProps) {
  const [qrImage, setQrImage] = useState("");
  const [copied, setCopied] = useState(false);
  const studentUrl = useMemo(() => {
    const currentOrigin = origin ?? (typeof window === "undefined" ? "" : window.location.origin);
    return currentOrigin ? `${currentOrigin}/?challenge=${encodeURIComponent(challengeId)}` : "";
  }, [challengeId, origin]);

  useEffect(() => {
    let active = true;
    if (!studentUrl) return;
    void createQr(studentUrl).then((image) => {
      if (active) setQrImage(image);
    });
    return () => { active = false; };
  }, [createQr, studentUrl]);

  async function copyUrl() {
    await navigator.clipboard.writeText(studentUrl);
    setCopied(true);
  }

  return (
    <section className={`${styles.panel} ${styles.qrPanel}`} aria-labelledby="challenge-qr-heading">
      <div className={styles.sectionHeading}>
        <div>
          <h2 id="challenge-qr-heading">학생 참여 QR</h2>
          <p>학생이 개인 휴대폰으로 스캔하면 이 챌린지에 바로 참여해요.</p>
        </div>
        <span className={styles.challengeId}>{challengeId}</span>
      </div>
      <div className={styles.qrContent}>
        <div className={styles.qrImageWrap}>
          {qrImage
            ? <Image className={styles.qrImage} src={qrImage} alt="학생 참여 QR 코드" width={360} height={360} unoptimized />
            : <LoadingIndicator label="QR 코드를 만들고 있어요." />}
        </div>
        <div className={styles.qrActions}>
          <label>
            <span>학생 참여 링크</span>
            <input value={studentUrl} readOnly />
          </label>
          <div className={styles.qrButtons}>
            <button className={styles.secondaryButton} type="button" onClick={() => void copyUrl()}>
              {copied ? "복사 완료" : "링크 복사"}
            </button>
            {qrImage && (
              <a
                className={styles.primaryButton}
                href={qrImage}
                download={`양치의-여왕-${challengeId}-학생용-QR.png`}
              >
                QR 이미지 저장
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function defaultCreateQr(url: string) {
  return QRCode.toDataURL(url, {
    width: 360,
    margin: 2,
    color: { dark: "#17295b", light: "#ffffff" },
  });
}
