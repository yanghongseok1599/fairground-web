"use client";

import { useState, useEffect, useMemo } from "react";
import { useDataStore } from "@/stores/dataStore";
import { getClubLogoPreset } from "@/components/club-emblem";
import { type TeamGalleryItem } from "@/components/team-circular-gallery";
import { TeamCardLink } from "@/components/team-card-link";
import { useReducedMotion } from "framer-motion";
import { TeamMarquee } from "@/components/team-marquee";
import type { Team } from "@/types";
import { isFieldChampionTeam, leagueTierCardIndex } from "@/lib/team-home";

const TEAM_CARD_VARIANTS = [
  {
    name: "bronze",
    image: "/images/team-cards/team-card-bronze.webp?v=26",
    glow: "#D9825D",
    text: "#071523",
  },
  {
    name: "silver",
    image: "/images/team-cards/team-card-silver.webp?v=26",
    glow: "#BFD1DF",
    text: "#071523",
  },
  {
    name: "gold",
    image: "/images/team-cards/team-card-gold.webp?v=26",
    glow: "#F2C85D",
    text: "#071523",
  },
  {
    name: "emerald",
    image: "/images/team-cards/team-card-emerald.webp?v=26",
    glow: "#25E0B0",
    text: "#07322D",
  },
];

export default function TeamsPage() {
  const store = useDataStore();
  const prefersReducedMotion = useReducedMotion();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    store.fetchTeams().then((list) => {
      // 공개 팀 목록도 승인된 팀만. 승인 대기 팀 홈은 대표가 직접 링크를
      // 열 때만 보이고(/teams/[id]), 목록에는 오르지 않는다.
      const sorted = list
        .filter((team) => team.isApproved)
        .sort(
          (a, b) =>
            (b.seasonStats?.points || 0) - (a.seasonStats?.points || 0) ||
            b.createdAt - a.createdAt
        );
      setTeams(sorted);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const galleryItems: TeamGalleryItem[] = useMemo(
    () =>
      teams.map((team, index) => {
        // 카드 프레임 = 리그 등급(브론즈/실버/골드/플래티넘). 팀 상세의
        // TeamEmblem 과 동일 매핑이라 같은 팀이 두 surface 에서 같은 프레임.
        // logo preset 은 캐러셀 fallback 용이라 정렬 index 그대로 유지.
        const cardIndex = leagueTierCardIndex(team.leagueTier);
        return {
          id: team.id,
          name: team.name,
          logo: team.logo || getClubLogoPreset(team.name, index).asset,
          frame: TEAM_CARD_VARIANTS[cardIndex].image,
          colorIndex: cardIndex,
          isFieldChampion: isFieldChampionTeam(team),
        };
      }),
    [teams],
  );

  return (
    <div className="pt-[60px] min-h-screen" style={{ background: "var(--foreground)" }}>
      {/* Header */}
      <div className="pt-6 pb-8 px-6 md:px-10" style={{ background: "var(--foreground)" }}>
        <div className="max-w-6xl mx-auto">
          <p className="text-[11px] uppercase tracking-[3px] mb-4" style={{ fontFamily: "var(--font-space-mono)", color: "var(--primary)" }}>Teams</p>
          <h1 className="font-black leading-none mb-2" style={{ fontFamily: "var(--font-outfit)", fontSize: "clamp(36px, 6vw, 64px)", letterSpacing: "-2px", color: "var(--background)" }}>
            참가 팀
          </h1>
          <p className="text-sm" style={{ color: "var(--color-fg-ink-dim)" }}>팀을 클릭하면 선수 카드를 확인할 수 있습니다</p>
        </div>
      </div>

      <div className="px-6 md:px-10 pb-36" style={{ background: "var(--foreground)" }}>
        <div className="max-w-6xl mx-auto space-y-8">
          {loading ? (
            <div className="py-16 text-center" style={{ color: "var(--color-fg-ink-dim)" }}>불러오는 중...</div>
          ) : teams.length === 0 ? (
            <div className="py-20 text-center" style={{ color: "var(--color-fg-ink-dim)" }}>아직 등록된 팀이 없습니다</div>
          ) : (
            <TeamMarquee
              items={galleryItems}
              reducedMotion={!!prefersReducedMotion}
              edgeClassName="-mx-6 px-6 md:-mx-10 md:px-10"
              ariaLabel="참가 팀 카드 슬라이더"
              renderItem={(item, key) => <TeamCardLink key={key} item={item} width={180} />}
            />
          )}
        </div>
      </div>
    </div>
  );
}
