import type { PublicSkin } from "@/shared/contracts";

export type BasicSkinId =
  | "cat"
  | "rabbit"
  | "bear"
  | "bubble-crown"
  | "toothpaste-hat"
  | "detective-glasses"
  | "tooth-fairy"
  | "frog-hood"
  | "photo-booth"
  | "puppy-hood"
  | "hamster-hood"
  | "fox-hood"
  | "panda-hood"
  | "chick-hat"
  | "penguin-hood";
export type ArSkinId = string;
export type ArSkin = {
  id: string;
  label: string;
  src: string;
  calibration: { anchorX: number; anchorY: number; scale: number; rotationOffset: number };
  bundled: boolean;
};

export const AR_SKINS = {
  cat: { id: "cat", label: "냥냥 볼터치", src: "/ar-skins/cat.png", calibration: { anchorX: 0, anchorY: -0.1, scale: 1.42, rotationOffset: 0 }, bundled: true },
  rabbit: { id: "rabbit", label: "반짝 토끼", src: "/ar-skins/rabbit.png", calibration: { anchorX: 0, anchorY: -0.1, scale: 1.5, rotationOffset: 0 }, bundled: true },
  bear: { id: "bear", label: "하트 곰돌이", src: "/ar-skins/bear.png", calibration: { anchorX: 0, anchorY: -0.08, scale: 1.4, rotationOffset: 0 }, bundled: true },
  "bubble-crown": { id: "bubble-crown", label: "몽글 거품 왕관", src: "/ar-skins/bubble-crown.png", calibration: { anchorX: 0, anchorY: -0.33, scale: 1.42, rotationOffset: 0 }, bundled: true },
  "toothpaste-hat": { id: "toothpaste-hat", label: "치약 크림 모자", src: "/ar-skins/toothpaste-hat.png", calibration: { anchorX: 0, anchorY: -0.42, scale: 1.22, rotationOffset: 0 }, bundled: true },
  "detective-glasses": { id: "detective-glasses", label: "동글 안경 탐정", src: "/ar-skins/detective-glasses.png", calibration: { anchorX: 0, anchorY: -0.02, scale: 1.2, rotationOffset: 0 }, bundled: true },
  "tooth-fairy": { id: "tooth-fairy", label: "반짝 치아 요정", src: "/ar-skins/tooth-fairy.png", calibration: { anchorX: 0, anchorY: -0.08, scale: 1.58, rotationOffset: 0 }, bundled: true },
  "frog-hood": { id: "frog-hood", label: "말랑 개구리 머리띠", src: "/ar-skins/frog-headband.png", calibration: { anchorX: 0, anchorY: -0.33, scale: 1.28, rotationOffset: 0 }, bundled: true },
  "photo-booth": { id: "photo-booth", label: "반짝 치아 티아라", src: "/ar-skins/tooth-tiara.png", calibration: { anchorX: 0, anchorY: -0.36, scale: 1.3, rotationOffset: 0 }, bundled: true },
  "puppy-hood": { id: "puppy-hood", label: "복슬 강아지 머리띠", src: "/ar-skins/puppy-headband.png", calibration: { anchorX: 0, anchorY: -0.32, scale: 1.3, rotationOffset: 0 }, bundled: true },
  "hamster-hood": { id: "hamster-hood", label: "볼빵빵 햄스터 머리띠", src: "/ar-skins/hamster-headband.png", calibration: { anchorX: 0, anchorY: -0.33, scale: 1.28, rotationOffset: 0 }, bundled: true },
  "fox-hood": { id: "fox-hood", label: "새침 여우 머리띠", src: "/ar-skins/fox-headband.png", calibration: { anchorX: 0, anchorY: -0.34, scale: 1.28, rotationOffset: 0 }, bundled: true },
  "panda-hood": { id: "panda-hood", label: "말랑 판다 머리띠", src: "/ar-skins/panda-headband.png", calibration: { anchorX: 0, anchorY: -0.33, scale: 1.28, rotationOffset: 0 }, bundled: true },
  "chick-hat": { id: "chick-hat", label: "노랑 병아리 머리띠", src: "/ar-skins/chick-headband.png", calibration: { anchorX: 0, anchorY: -0.31, scale: 1.3, rotationOffset: 0 }, bundled: true },
  "penguin-hood": { id: "penguin-hood", label: "포근 펭귄 머리띠", src: "/ar-skins/penguin-headband.png", calibration: { anchorX: 0, anchorY: -0.32, scale: 1.3, rotationOffset: 0 }, bundled: true },
  crown: { id: "crown", label: "양치왕 왕관", src: "/ar-skins/crown.png", calibration: { anchorX: 0, anchorY: -0.5, scale: 1.28, rotationOffset: 0 }, bundled: true },
} as const satisfies Record<BasicSkinId | "crown", ArSkin>;

export const BASIC_SKINS: ArSkin[] = [
  AR_SKINS.cat,
  AR_SKINS.rabbit,
  AR_SKINS.bear,
  AR_SKINS["bubble-crown"],
  AR_SKINS["toothpaste-hat"],
  AR_SKINS["detective-glasses"],
  AR_SKINS["tooth-fairy"],
  AR_SKINS["frog-hood"],
  AR_SKINS["photo-booth"],
  AR_SKINS["puppy-hood"],
  AR_SKINS["hamster-hood"],
  AR_SKINS["fox-hood"],
  AR_SKINS["panda-hood"],
  AR_SKINS["chick-hat"],
  AR_SKINS["penguin-hood"],
];

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
