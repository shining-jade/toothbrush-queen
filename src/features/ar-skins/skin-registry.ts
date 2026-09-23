import type { PublicSkin } from "@/shared/contracts";

export type BasicSkinId = "cat" | "rabbit" | "bear";
export type ArSkinId = string;
export type ArSkin = {
  id: string;
  label: string;
  src: string;
  calibration: { anchorX: number; anchorY: number; scale: number; rotationOffset: number };
  bundled: boolean;
};

export const AR_SKINS = {
  cat: { id: "cat", label: "냥냥 볼터치", src: "/ar-skins/cat.png", calibration: { anchorX: 0, anchorY: -0.38, scale: 1.42, rotationOffset: 0 }, bundled: true },
  rabbit: { id: "rabbit", label: "반짝 토끼", src: "/ar-skins/rabbit.png", calibration: { anchorX: 0, anchorY: -0.55, scale: 1.5, rotationOffset: 0 }, bundled: true },
  bear: { id: "bear", label: "하트 곰돌이", src: "/ar-skins/bear.png", calibration: { anchorX: 0, anchorY: -0.36, scale: 1.4, rotationOffset: 0 }, bundled: true },
  crown: { id: "crown", label: "양치왕 왕관", src: "/ar-skins/crown.png", calibration: { anchorX: 0, anchorY: -0.5, scale: 1.28, rotationOffset: 0 }, bundled: true },
} as const satisfies Record<BasicSkinId | "crown", ArSkin>;

export const BASIC_SKINS: ArSkin[] = [AR_SKINS.cat, AR_SKINS.rabbit, AR_SKINS.bear];

function toArSkin(skin: PublicSkin): ArSkin {
  return {
    id: skin.skinId, label: skin.name, src: skin.imageUrl, bundled: false,
    calibration: { anchorX: skin.anchorX, anchorY: skin.anchorY, scale: skin.scale, rotationOffset: skin.rotationOffset },
  };
}

export function mergeSkinCatalog(remote: PublicSkin[] = []): ArSkin[] {
  const bundledIds = new Set(BASIC_SKINS.map((skin) => skin.id));
  return [...BASIC_SKINS, ...remote.filter((skin) => !bundledIds.has(skin.skinId)).map(toArSkin)];
}

export function resolveSessionSkin(selected: string, acceptedDays: number, targetDays: number): ArSkinId {
  return acceptedDays === targetDays - 1 ? "crown" : selected;
}
