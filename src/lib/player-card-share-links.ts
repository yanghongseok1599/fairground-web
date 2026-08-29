export const PLAYER_CARD_CREATE_FROM_SHARE_PATH =
  "/my/player-setup?source=player-card-share";

export function getPublicPlayerPath(playerId: string): string {
  return `/players/${encodeURIComponent(playerId)}`;
}

export function getPlayerCardShareUrls(origin: string, playerId: string) {
  return {
    playerUrl: new URL(getPublicPlayerPath(playerId), origin).toString(),
    createCardUrl: new URL(PLAYER_CARD_CREATE_FROM_SHARE_PATH, origin).toString(),
  };
}
