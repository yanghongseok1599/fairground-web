import type { Gender } from "@/types";

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

export const PLAYER_CARD_POSE_TEMPLATES: PlayerCardPoseTemplate[] = [
  {
    id: "red-uniform-male-01",
    gender: "male",
    label: "남자 포즈 1",
    src: "/images/player-card-poses/red-uniform-male-01.webp",
    faceTarget: { x: 37.8, y: 5.5, width: 24.2, height: 31.8 },
  },
  {
    id: "red-uniform-male-02",
    gender: "male",
    label: "남자 포즈 2",
    src: "/images/player-card-poses/red-uniform-male-02.webp",
    faceTarget: { x: 33.8, y: 4.6, width: 25.2, height: 33.5 },
  },
  {
    id: "red-uniform-female-01",
    gender: "female",
    label: "여자 포즈 1",
    src: "/images/player-card-poses/red-uniform-female-01.webp",
    faceTarget: { x: 37.8, y: 6.4, width: 24.4, height: 32.5 },
  },
  {
    id: "red-uniform-female-02",
    gender: "female",
    label: "여자 포즈 2",
    src: "/images/player-card-poses/red-uniform-female-02.webp",
    faceTarget: { x: 30.8, y: 6.8, width: 24.8, height: 33.4 },
  },
];

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
