"use client";

import Image from "next/image";
import { useState } from "react";

import { AR_SKINS, type ArSkin } from "./skin-registry";
import styles from "./skin-selector.module.css";

export function SkinSelector({ skins, value, onChange }: { skins: ArSkin[]; value: string; onChange: (skin: string) => void }) {
  const [unavailable, setUnavailable] = useState<Set<string>>(() => new Set());
  function markUnavailable(skinId: string) {
    setUnavailable((current) => new Set(current).add(skinId));
    if (value === skinId) onChange("cat");
  }
  return (
    <div className={styles.grid} role="radiogroup" aria-label="AR 스킨 선택">
      <button type="button" className={styles.card} role="radio" aria-checked={value === "none"} aria-label={AR_SKINS.none.label} onClick={() => onChange("none")}>
        <span className={styles.preview} aria-hidden="true">기본</span>
        <span>{AR_SKINS.none.label}</span>
      </button>
      {skins.filter((skin) => !unavailable.has(skin.id)).map((skin) => (
        <button key={skin.id} type="button" className={styles.card} role="radio" aria-checked={value === skin.id} aria-label={skin.label} onClick={() => onChange(skin.id)}>
          <span className={styles.preview} aria-hidden="true">
            {skin.bundled ? <Image src={skin.src} alt="" fill sizes="96px" /> : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={skin.src} alt={skin.label} onError={() => markUnavailable(skin.id)} />
            )}
          </span>
          <span>{skin.label}</span>
        </button>
      ))}
    </div>
  );
}
