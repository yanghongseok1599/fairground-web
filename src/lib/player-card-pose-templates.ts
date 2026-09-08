import type { Gender, Player } from "@/types";

export type PlayerCardPoseGender = Extract<Gender, "male" | "female">;

export interface PlayerCardPoseTemplate {
  id: string;
  gender: PlayerCardPoseGender;
  label: string;
  src: string;
  faceTarget: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * 현재 승인된 선수카드 기본 인물 세트. 파일·매핑을 바꿀 때는 ID를 올리고
 * tests/player-card-assets.test.ts의 해시를 명시적으로 갱신해야 한다.
 */
export const PLAYER_CARD_IMAGE_SET_ID = "fairground-fictional-korean-players-v1";

export const FICTIONAL_PLAYER_CARD_POSE_SOURCES = Object.freeze({
  male01: "/images/player-card-poses/fictional-korean-male-navy-01.png",
  male02: "/images/player-card-poses/fictional-korean-male-ivory-02.png",
  male03: "/images/player-card-poses/fictional-korean-male-charcoal-03.png",
  male04: "/images/player-card-poses/fictional-korean-male-blue-04.png",
  female01: "/images/player-card-poses/fictional-korean-female-burgundy-01.png",
  female02: "/images/player-card-poses/fictional-korean-female-ivory-02.png",
} as const);

export const PLAYER_CARD_IMAGE_SHA256 = Object.freeze({
  male01: "4a525f1ae9a5497e5106bd29426efe3b790829bc7e0aebf0c3bf338b453631cf",
  male02: "8e8964650efbfb8ff60be83ad66d04091f80006a469e1ff03b3bc1a4c0950e81",
  male03: "0d57a86acc327752afe1ab5c3a059e3508da69c1fa2d1f28d1e42ed5a119daa4",
  male04: "b6ad6e25da4bcb03cf680bfef682d8cc68a2bb9f8c3d834185e764f0bcf42220",
  female01: "49ff8c1e81d6d143e09641e4d4a9744867b622b749b38e681eeb61e002158686",
  female02: "29000af43e7b23ed263e4f3f780d918c852f366828fd0b9cc192acfaaa44aa5e",
} as const);

// 기본 포즈는 특정 실존 인물이나 유명인을 참조하지 않고 생성한 가상 선수다.
// 실제 사용자가 사진을 업로드하면 동의한 사용자 사진을 같은 고정 포즈에 합성한다.
const PLAYER_CARD_POSE_TEMPLATE_VALUES = [
  {
    id: "fictional-korean-male-navy-01",
    gender: "male",
    label: "남자 포즈 1",
    src: FICTIONAL_PLAYER_CARD_POSE_SOURCES.male01,
    faceTarget: Object.freeze({ x: 37.8, y: 5.5, width: 24.2, height: 31.8 }),
  },
  {
    id: "fictional-korean-male-ivory-02",
    gender: "male",
    label: "남자 포즈 2",
    src: FICTIONAL_PLAYER_CARD_POSE_SOURCES.male02,
    faceTarget: Object.freeze({ x: 33.8, y: 4.6, width: 25.2, height: 33.5 }),
  },
  {
    id: "fictional-korean-male-charcoal-03",
    gender: "male",
    label: "남자 포즈 3",
    src: FICTIONAL_PLAYER_CARD_POSE_SOURCES.male03,
    faceTarget: Object.freeze({ x: 37.8, y: 6.4, width: 24.4, height: 32.5 }),
  },
  {
    id: "fictional-korean-male-blue-04",
    gender: "male",
    label: "남자 포즈 4",
    src: FICTIONAL_PLAYER_CARD_POSE_SOURCES.male04,
    faceTarget: Object.freeze({ x: 30.8, y: 6.8, width: 24.8, height: 33.4 }),
  },
  {
    id: "fictional-korean-female-burgundy-01",
    gender: "female",
    label: "여자 포즈 1",
    src: FICTIONAL_PLAYER_CARD_POSE_SOURCES.female01,
    faceTarget: Object.freeze({ x: 37.8, y: 6.4, width: 24.4, height: 32.5 }),
  },
  {
    id: "fictional-korean-female-ivory-02",
    gender: "female",
    label: "여자 포즈 2",
    src: FICTIONAL_PLAYER_CARD_POSE_SOURCES.female02,
    faceTarget: Object.freeze({ x: 30.8, y: 6.8, width: 24.8, height: 33.4 }),
  },
] satisfies PlayerCardPoseTemplate[];

export const PLAYER_CARD_POSE_TEMPLATES: readonly PlayerCardPoseTemplate[] = Object.freeze(
  PLAYER_CARD_POSE_TEMPLATE_VALUES.map((template) => Object.freeze(template)),
);

function stableHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function normalizePoseGender(gender?: Gender | null): PlayerCardPoseGender {
  return gender === "female" ? "female" : "male";
}

export function getTeamlessPlayerCardPose(
  gender?: Gender | null,
  seed = "",
): PlayerCardPoseTemplate {
  const normalizedGender = normalizePoseGender(gender);
  const candidates = PLAYER_CARD_POSE_TEMPLATES.filter((template) => template.gender === normalizedGender);
  const safeCandidates = candidates.length > 0 ? candidates : PLAYER_CARD_POSE_TEMPLATES;
  return safeCandidates[stableHash(seed || normalizedGender) % safeCandidates.length];
}

type PlayerCardPhotoSource = Pick<Player, "photoUrl" | "gender" | "id" | "uid">;

/**
 * 모든 선수카드의 사진 슬롯을 완성형 상태로 유지한다.
 * 사용자가 등록한 카드 사진이 있으면 그대로 쓰고, 비어 있으면 특정 실존 인물을
 * 참조하지 않은 가상 선수 포즈를 안정적으로 배정한다.
 */
export function resolvePlayerCardPhoto(player: PlayerCardPhotoSource): string {
  const photoUrl = player.photoUrl?.trim();
  if (photoUrl) return photoUrl;

  return getTeamlessPlayerCardPose(player.gender, player.id || player.uid).src;
}
