import type { Player } from "@/types";

type PlayerPhotoSource = Pick<Player, "photoUrl" | "profilePhotoUrl" | "profilePhotoLocked">;

export const DEFAULT_CARD_PHOTO_SCALE = 0.92;

export function getPlayerProfilePhotoUrl(player?: PlayerPhotoSource | null): string {
  if (!player) return "";
  if (player.profilePhotoLocked && player.profilePhotoUrl) return player.profilePhotoUrl;
  return player.photoUrl || player.profilePhotoUrl || "";
}
