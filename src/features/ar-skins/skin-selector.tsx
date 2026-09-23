import Image from "next/image";

import { BASIC_SKINS, type BasicSkinId } from "./skin-registry";
import styles from "./skin-selector.module.css";

export function SkinSelector({
  value,
  onChange,
}: {
  value: BasicSkinId;
  onChange: (skin: BasicSkinId) => void;
}) {
  return (
    <div className={styles.grid} role="radiogroup" aria-label="AR 스킨 선택">
      {BASIC_SKINS.map((skin) => (
        <button
          key={skin.id}
          type="button"
          className={styles.card}
          role="radio"
          aria-checked={value === skin.id}
          aria-label={skin.label}
          onClick={() => onChange(skin.id)}
        >
          <span className={styles.preview} aria-hidden="true">
            <Image src={skin.src} alt="" fill sizes="96px" />
          </span>
          <span>{skin.label}</span>
        </button>
      ))}
    </div>
  );
}
