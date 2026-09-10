import type { Gender } from "@/types";

export type PlayerCardPhotoMode = "face" | "uniform";

export const PLAYER_CARD_PHOTO_OPTIONS = [
  { mode: "face", label: "내 얼굴 등록하기", description: "내 머리카락·얼굴 전체를 준타스 유니폼에 합성해요" },
  { mode: "uniform", label: "내 유니폼프로필 등록하기", description: "내 유니폼과 모습을 그대로 사용해요" },
] as const;

export const JUNTAS_CARD_POSES = Object.freeze({
  male: "/images/player-card-poses/juntas-male-02.png",
  female: "/images/player-card-poses/juntas-female-02.png",
});

export function getJuntasCardPose(gender?: Gender | null): string {
  return gender === "female" ? JUNTAS_CARD_POSES.female : JUNTAS_CARD_POSES.male;
}

export async function preparePlayerCardPhoto(sourcePhoto: Blob, mode: PlayerCardPhotoMode, gender?: Gender | null): Promise<Blob> {
  if (mode === "face") {
    const { composeTeamlessPoseCardPhoto } = await import("@/lib/player-card-photo-composer");
    return composeTeamlessPoseCardPhoto({ sourcePhoto, gender, templateSrc: getJuntasCardPose(gender) });
  }
  const { removeBackgroundAndCompress } = await import("@/lib/image-compression");
  return removeBackgroundAndCompress(sourcePhoto, { maxPx: 1400, mimeType: "image/webp", quality: 0.92 });
}
