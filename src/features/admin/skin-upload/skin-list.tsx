import type { AdminSkin } from "@/shared/contracts";

import styles from "./skin-upload.module.css";

export function SkinList({ skins, busyId, onToggle }: {
  skins: AdminSkin[];
  busyId?: string;
  onToggle: (skin: AdminSkin) => void;
}) {
  return (
    <section className={styles.listCard}>
      <div className={styles.sectionHeading}>
        <h2>등록된 스킨</h2>
        <span>{skins.length}개</span>
      </div>
      {skins.length === 0 ? <p className={styles.empty}>아직 등록한 스킨이 없어요.</p> : (
        <ul className={styles.skinList}>
          {skins.map((skin) => (
            <li key={skin.skinId}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={skin.imageUrl} alt="" />
              <div><strong>{skin.name}</strong><small>{skin.enabled ? "학생에게 공개 중" : "비공개"}</small></div>
              <button type="button" disabled={busyId === skin.skinId} onClick={() => onToggle(skin)}>
                {skin.enabled ? "비활성화" : "활성화"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
