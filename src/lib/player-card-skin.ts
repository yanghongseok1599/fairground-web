import type { Player, PlayerCardSkin } from "@/types";

export const STANDARD_PLAYER_CARD_SKIN: PlayerCardSkin = "standard";
export const GROUND_CHALLENGE_PLAYER_CARD_SKIN: PlayerCardSkin = "hologram";
export const GROUND_CHALLENGE_CARD_STORAGE_KEY = "fg_ground_challenge_card_skin";
export const PENDING_CARD_SKIN_SESSION_KEY = "fg_pending_card_skin_v2";
const PENDING_CARD_SKIN_TTL = 30 * 60 * 1000;
export type PlayerCardContext = "league" | "challenge";
export const GROUND_CHALLENGE_EVENT_QUERY_VALUE = "ground-challenge";

type SearchParamReader = {
  get(name: string): string | null;
};

function normalizeQueryValue(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-");
}

function isGroundChallengeQueryValue(value: string | null | undefined) {
  const normalized = normalizeQueryValue(value);
  return [
    "ground-challenge",
    "groundchallenge",
    "mangsang-ground-challenge",
    "mangsang-ground",
    "mangsang-challenge",
    "mangsang-event",
    "mangsang-wellness",
    "skill-challenge",
    "skillchallenge",
    "mangsang",
    "망상",
    "망상-이벤트",
    "망상이벤트",
    "그라운드-챌린지",
    "그라운드챌린지",
  ].includes(normalized);
}

export function getCardSkinFromSearchParams(params?: SearchParamReader | null): PlayerCardSkin | undefined {
  if (!params) return undefined;

  const explicitSkin = normalizeQueryValue(params.get("cardSkin") ?? params.get("card_skin"));
  if (explicitSkin === STANDARD_PLAYER_CARD_SKIN) return STANDARD_PLAYER_CARD_SKIN;
  if (explicitSkin === GROUND_CHALLENGE_PLAYER_CARD_SKIN) return GROUND_CHALLENGE_PLAYER_CARD_SKIN;

  const eventValues = [
    params.get("event"),
    params.get("source"),
    params.get("campaign"),
    params.get("utm_campaign"),
  ];

  return eventValues.some(isGroundChallengeQueryValue)
    ? GROUND_CHALLENGE_PLAYER_CARD_SKIN
    : undefined;
}

export function rememberPendingCardSkin(cardSkin?: PlayerCardSkin) {
  if (typeof window === "undefined") return;
  clearPendingCardSkin();
  try {
    if (cardSkin === GROUND_CHALLENGE_PLAYER_CARD_SKIN) {
      window.sessionStorage.setItem(PENDING_CARD_SKIN_SESSION_KEY, JSON.stringify({ cardSkin, expiresAt: Date.now() + PENDING_CARD_SKIN_TTL }));
    }
  } catch { /* Storage denial must not block registration. */ }
}

export function readPendingCardSkin(): PlayerCardSkin | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    // Never inherit the old, permanent event marker from another entry/account.
    window.localStorage.removeItem(GROUND_CHALLENGE_CARD_STORAGE_KEY);
    const value = JSON.parse(window.sessionStorage.getItem(PENDING_CARD_SKIN_SESSION_KEY) ?? "null");
    if (value?.cardSkin === GROUND_CHALLENGE_PLAYER_CARD_SKIN && Number.isFinite(value.expiresAt)
      && value.expiresAt > Date.now() && value.expiresAt <= Date.now() + PENDING_CARD_SKIN_TTL) return GROUND_CHALLENGE_PLAYER_CARD_SKIN;
  } catch { /* Malformed or unavailable storage is a standard-card entry. */ }
  clearPendingCardSkin();
  return undefined;
}

export function clearPendingCardSkin() {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(GROUND_CHALLENGE_CARD_STORAGE_KEY); } catch { /* private mode */ }
  try { window.sessionStorage.removeItem(PENDING_CARD_SKIN_SESSION_KEY); } catch { /* private mode */ }
}

export function getPlayerCardSkin(player?: Pick<Player, "cardSkin"> | null): PlayerCardSkin {
  return player?.cardSkin === GROUND_CHALLENGE_PLAYER_CARD_SKIN
    ? GROUND_CHALLENGE_PLAYER_CARD_SKIN
    : STANDARD_PLAYER_CARD_SKIN;
}

export function isHologramPlayerCard(player?: Pick<Player, "cardSkin"> | null) {
  return getPlayerCardSkin(player) === GROUND_CHALLENGE_PLAYER_CARD_SKIN;
}

/** Eligibility is not display. League/edit/public cards always use their rating tier. */
export function getPlayerCardDisplaySkin(player?: Pick<Player, "cardSkin"> | null, context: PlayerCardContext = "league"): PlayerCardSkin {
  return context === "challenge" ? getPlayerCardSkin(player) : STANDARD_PLAYER_CARD_SKIN;
}

// ===== 카드 스킨 선택 =====
//
// card_skin 컬럼은 "이 선수가 그라운드 챌린지 카드를 받았는가"라는 자격을
// 겸하고 있다(skill-challenge-admin 의 참가자 집계도 이 값을 본다). 그래서
// 자격은 그대로 두고, "지금 어떤 카드를 보여줄지"는 기기별 선택으로 분리한다.
//  - 기본값은 언제나 대회 선수 카드(standard).
//  - 그라운드 챌린지 카드를 받은 선수만 두 카드 중 하나를 고를 수 있다.
export const PLAYER_CARD_SKIN_PREFERENCE_KEY = "fg_player_card_skin_preference";

export const PLAYER_CARD_SKIN_LABELS: Record<
  PlayerCardSkin,
  { label: string; description: string }
> = {
  standard: { label: "리그 카드", description: "리그·대회 경기 기록 카드" },
  hologram: { label: "챌린지 카드", description: "그라운드 챌린지 참가 카드" },
};

/** 이 선수가 고를 수 있는 카드 스킨 목록. 대회 카드는 항상 포함된다. */
export function getUnlockedCardSkins(
  player?: Pick<Player, "cardSkin"> | null,
): PlayerCardSkin[] {
  return isHologramPlayerCard(player)
    ? [STANDARD_PLAYER_CARD_SKIN, GROUND_CHALLENGE_PLAYER_CARD_SKIN]
    : [STANDARD_PLAYER_CARD_SKIN];
}

/** 저장된 선택값. 보유하지 않은 스킨이면 대회 카드로 되돌린다. */
export function readCardSkinPreference(
  unlocked: PlayerCardSkin[],
): PlayerCardSkin {
  if (typeof window === "undefined") return STANDARD_PLAYER_CARD_SKIN;
  const saved = window.localStorage.getItem(PLAYER_CARD_SKIN_PREFERENCE_KEY);
  return saved && unlocked.includes(saved as PlayerCardSkin)
    ? (saved as PlayerCardSkin)
    : STANDARD_PLAYER_CARD_SKIN;
}

export function writeCardSkinPreference(skin: PlayerCardSkin) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PLAYER_CARD_SKIN_PREFERENCE_KEY, skin);
}

/** 선택한 스킨으로 카드를 그리기 위한 얕은 복제본. 저장·공유 캡처도 이 값을 따른다. */
export function withCardSkin<T extends Pick<Player, "cardSkin">>(
  player: T,
  skin: PlayerCardSkin,
): T {
  return player.cardSkin === skin ? player : { ...player, cardSkin: skin };
}
