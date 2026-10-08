"use client";

import { useState, useEffect, useMemo } from "react";
import { useDataStore } from "@/stores/dataStore";
import { getClubLogoPreset } from "@/components/club-emblem";
import { type TeamGalleryItem } from "@/components/team-circular-gallery";
import { TeamCardLink } from "@/components/team-card-link";
import { useReducedMotion } from "framer-motion";
import { TeamMarquee } from "@/components/team-marquee";
import type { Team } from "@/types";
import { getTeamCardAppearance, resolveTeamCardTier } from "@/lib/team-card-appearance";
import { useFinalCardTiers } from "@/features/standings/use-final-card-tier";

export default function TeamsPage() {
  const store = useDataStore();
  const finalCardTiers = useFinalCardTiers();
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
        const tier = resolveTeamCardTier(team, finalCardTiers);
        const appearance = getTeamCardAppearance(tier);
        return {
          id: team.id,
          name: team.name,
          logo: team.logo || getClubLogoPreset(team.name, index).asset,
          frame: appearance.frame,
          colorIndex: appearance.colorIndex,
          tier,
        };
      }),
    [teams, finalCardTiers],
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
              renderItem={(item, key) => <TeamCardLink key={key} item={item} width={210} />}
            />
          )}
        </div>
      </div>
    </div>
  );
}
