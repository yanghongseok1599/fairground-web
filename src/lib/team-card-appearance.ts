import type { CardType, Team } from "@/types";

/** Shared artwork and coordinates for the website, gallery, and PNG exports. */
export const TEAM_CARD_SIZE = { width: 1024, height: 1536 } as const;
export const TEAM_CARD_ASPECT_RATIO = `${TEAM_CARD_SIZE.width} / ${TEAM_CARD_SIZE.height}`;
export const TEAM_CARD_TIER_ORDER: readonly CardType[] = ["bronze", "silver", "gold", "premium"];

const logo = { x: 255, y: 405, width: 513, height: 520 } as const;
const nameplate = { x: 512, y: 1204, maxWidth: 470, fontSize: 57, minFontSize: 28 } as const;

export const TEAM_CARD_APPEARANCES = {
  bronze: {
    tier: "bronze", colorIndex: 0, label: "브론즈", color: "#C88955",
    frame: "/images/team-cards/heritage-v1/bronze.webp", sparkle: false,
    logo, nameplate,
  },
  silver: {
    tier: "silver", colorIndex: 1, label: "실버", color: "#C8D4DF",
    frame: "/images/team-cards/heritage-v1/silver.webp", sparkle: false,
    logo, nameplate,
  },
  gold: {
    tier: "gold", colorIndex: 2, label: "골드", color: "#F0C25C",
    frame: "/images/team-cards/heritage-v1/gold.webp", sparkle: false,
    logo, nameplate,
  },
  premium: {
    tier: "premium", colorIndex: 3, label: "플래티넘", color: "#A9E4FF",
    frame: "/images/team-cards/heritage-v1/platinum.webp", sparkle: true,
    logo, nameplate: { ...nameplate, y: 1230 },
  },
} as const;

export function getTeamCardAppearance(tier?: CardType) {
  return TEAM_CARD_APPEARANCES[tier ?? "bronze"] ?? TEAM_CARD_APPEARANCES.bronze;
}

/** A confirmed final result changes only the card; stored league membership stays intact. */
export function resolveTeamCardTier(
  team: Pick<Team, "id" | "leagueTier">,
  finalTiers: Readonly<Record<string, CardType | undefined>>,
): CardType {
  return finalTiers[team.id] ?? team.leagueTier;
}
