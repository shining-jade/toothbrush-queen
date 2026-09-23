export type BasicSkinId = "cat" | "rabbit" | "bear";
export type ArSkinId = BasicSkinId | "crown";

export type ArSkin = {
  id: ArSkinId;
  label: string;
  src: string;
  widthScale: number;
  yOffset: number;
};

export const AR_SKINS = {
  cat: {
    id: "cat",
    label: "냥냥 볼터치",
    src: "/ar-skins/cat.png",
    widthScale: 1.42,
    yOffset: -0.38,
  },
  rabbit: {
    id: "rabbit",
    label: "반짝 토끼",
    src: "/ar-skins/rabbit.png",
    widthScale: 1.5,
    yOffset: -0.55,
  },
  bear: {
    id: "bear",
    label: "하트 곰돌이",
    src: "/ar-skins/bear.png",
    widthScale: 1.4,
    yOffset: -0.36,
  },
  crown: {
    id: "crown",
    label: "양치왕 왕관",
    src: "/ar-skins/crown.png",
    widthScale: 1.28,
    yOffset: -0.5,
  },
} as const satisfies Record<ArSkinId, ArSkin>;

export const BASIC_SKINS = [AR_SKINS.cat, AR_SKINS.rabbit, AR_SKINS.bear] as const;

export function resolveSessionSkin(
  selected: BasicSkinId,
  acceptedDays: number,
  targetDays: number,
): ArSkinId {
  return acceptedDays === targetDays - 1 ? "crown" : selected;
}
