"use client";

import type { ReactNode } from "react";
import { PlayerCard } from "@/components/player-card";
import { ANONYMOUS_PLAYER_CARD_POSE_SOURCES } from "@/lib/player-card-pose-templates";
import type { CardType, Player, PlayerStats } from "@/types";

export const DEFAULT_PLAYER_CARD_PHOTO = ANONYMOUS_PLAYER_CARD_POSE_SOURCES.male01;

type TierPreview = {
  type: CardType;
  label: string;
  rating: number;
  photoUrl: string;
  stats: PlayerStats;
  badges: string[];
};

const CARD_TIER_PREVIEWS: TierPreview[] = [
  {
    type: "bronze",
    label: "브론즈",
    rating: 72,
    photoUrl: ANONYMOUS_PLAYER_CARD_POSE_SOURCES.female02,
    stats: { goals: 2, assists: 3, games: 8, mom: 0 },
    badges: ["fair_play"],
  },
  {
    type: "silver",
    label: "실버",
    rating: 84,
    photoUrl: ANONYMOUS_PLAYER_CARD_POSE_SOURCES.male02,
    stats: { goals: 6, assists: 5, games: 12, mom: 1 },
    badges: ["playmaker", "iron_man"],
  },
  {
    type: "gold",
    label: "골드",
    rating: 90,
    photoUrl: ANONYMOUS_PLAYER_CARD_POSE_SOURCES.female01,
    stats: { goals: 9, assists: 6, games: 14, mom: 2 },
    badges: ["first_goal", "match_winner"],
  },
  {
    type: "premium",
    label: "플래티넘",
    rating: 104,
    photoUrl: DEFAULT_PLAYER_CARD_PHOTO,
    stats: { goals: 14, assists: 7, games: 14, mom: 5 },
    badges: ["champion", "golden_boot", "mvp"],
  },
];

function hasVisibleStats(stats: PlayerStats) {
  return stats.goals > 0 || stats.assists > 0 || stats.games > 0 || stats.mom > 0;
}

function buildTierPlayer(basePlayer: Player, tier: TierPreview, customPhotoUrl?: string): Player {
  return {
    ...basePlayer,
    id: `${basePlayer.id}-${tier.type}-preview`,
    uid: `${basePlayer.uid}-${tier.type}-preview`,
    photoUrl: customPhotoUrl || tier.photoUrl,
    cardType: tier.type,
    cardRating: tier.rating,
    stats: hasVisibleStats(basePlayer.stats) ? basePlayer.stats : tier.stats,
    badges: basePlayer.badges.length > 0 ? basePlayer.badges : tier.badges,
  };
}

interface PlayerCardTierPreviewGridProps {
  player: Player;
  teamLogo?: string;
  customPhotoUrl?: string;
  className?: string;
  renderPhotoOverlay?: (cardType: CardType) => ReactNode;
}

export function PlayerCardTierPreviewGrid({
  player,
  teamLogo,
  customPhotoUrl,
  className = "",
  renderPhotoOverlay,
}: PlayerCardTierPreviewGridProps) {
  return (
    <section className={className} aria-label="카드 등급 미리보기">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p
            className="text-[10px] uppercase tracking-[2px]"
            style={{ color: "var(--color-fg-ink-muted)", fontFamily: "var(--font-space-mono)" }}
          >
            카드 등급
          </p>
          <h2
            className="mt-1 text-lg font-black"
            style={{ color: "var(--color-fg-ink)", fontFamily: "var(--font-pretendard)" }}
          >
            브론즈 · 실버 · 골드 · 플래티넘
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-5">
        {CARD_TIER_PREVIEWS.map((tier) => {
          const tierPlayer = buildTierPlayer(player, tier, customPhotoUrl);
          return (
            <div key={tier.type} className="flex min-w-0 flex-col items-center">
              <div
                className="mb-2 flex w-[130px] items-center justify-between text-[11px] font-black"
                style={{ color: "var(--color-fg-ink-muted)", fontFamily: "var(--font-pretendard)" }}
              >
                <span>{tier.label}</span>
                <span className="tabular-nums">{tier.rating}</span>
              </div>
              <div className="relative w-fit">
                <PlayerCard player={tierPlayer} size="sm" teamLogo={teamLogo} disableHoverScale />
                {renderPhotoOverlay?.(tier.type)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
