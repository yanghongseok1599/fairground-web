"use client";

import { useState, useEffect, useMemo } from "react";
import { useDataStore } from "@/stores/dataStore";
import { useAuthStore } from "@/stores/authStore";
import { PlayerCard } from "@/components/player-card";
import { ClubEmblem, getClubLogoPreset } from "@/components/club-emblem";
import { type TeamGalleryItem } from "@/components/team-circular-gallery";
import { createTeamCardCanvas } from "@/lib/team-card-canvas";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { TeamMarquee } from "@/components/team-marquee";
import Link from "next/link";
import type { Team, Player } from "@/types";
import { X } from "lucide-react";
import { leagueTierCardIndex } from "@/lib/team-home";

const TEAM_CARD_VARIANTS = [
  {
    name: "bronze",
    image: "/images/team-cards/team-card-bronze.png?v=17",
    glow: "#D9825D",
    text: "#071523",
  },
  {
    name: "silver",
    image: "/images/team-cards/team-card-silver.png?v=17",
    glow: "#BFD1DF",
    text: "#071523",
  },
  {
    name: "gold",
    image: "/images/team-cards/team-card-gold.png?v=18",
    glow: "#F2C85D",
    text: "#071523",
  },
  {
    name: "emerald",
    image: "/images/team-cards/team-card-emerald.png?v=25",
    glow: "#25E0B0",
    text: "#07322D",
  },
];

const FALLBACK_TEAM_LOGOS = [
  "/images/team-logos/ref-afc.png",
  "/images/team-logos/ref-blue7.png",
  "/images/team-logos/ref-bulls.png",
  "/images/team-logos/ref-nova.png",
  "/images/team-logos/ref-orion.png",
  "/images/team-logos/ref-rift.png",
  "/images/team-logos/ref-volt.png",
];

export default function TeamsPage() {
  const store = useDataStore();
  const { player: currentPlayer } = useAuthStore();
  const prefersReducedMotion = useReducedMotion();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamPlayers, setTeamPlayers] = useState<Player[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [joinRequesting, setJoinRequesting] = useState(false);
  const [joinFeedback, setJoinFeedback] = useState<{
    teamId: string;
    state: "ok" | "err";
    msg?: string;
  } | null>(null);

  useEffect(() => {
    store.fetchTeams().then((list) => {
      const sorted = [...list].sort(
        (a, b) =>
          Number(b.isApproved) - Number(a.isApproved) ||
          (b.seasonStats?.points || 0) - (a.seasonStats?.points || 0) ||
          b.createdAt - a.createdAt
      );
      setTeams(sorted);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 탭하면 즉시 선택 토글(선수 fetch 없음 → 모바일에서도 즉각 반응). 선수 목록은
  // CTA 버튼으로 팀 페이지(/teams/[id])에서 확인.
  const handleSelect = (team: Team) => {
    setSelectedTeam((prev) => (prev?.id === team.id ? null : team));
  };

  // Memoize so the array reference is stable across renders. Without this,
  // every state update (e.g. setSelectedTeam) creates a new array, which would
  // re-trigger the gallery's useEffect and destroy/rebuild the WebGL canvas —
  // visible as a stutter that resets the carousel position.
  const galleryItems: TeamGalleryItem[] = useMemo(
    () =>
      teams.map((team, index) => {
        // 카드 프레임 = 리그 등급(브론즈/실버/골드/프리미엄). 팀 상세의
        // TeamEmblem 과 동일 매핑이라 같은 팀이 두 surface 에서 같은 프레임.
        // logo preset 은 캐러셀 fallback 용이라 정렬 index 그대로 유지.
        const cardIndex = leagueTierCardIndex(team.leagueTier);
        return {
          id: team.id,
          name: team.name,
          logo: team.logo || getClubLogoPreset(team.name, index).asset,
          frame: TEAM_CARD_VARIANTS[cardIndex].image,
          colorIndex: cardIndex,
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

      <div className="px-6 md:px-10 pb-10" style={{ background: "var(--foreground)" }}>
        <div className="max-w-6xl mx-auto space-y-8">
          {loading ? (
            <div className="py-16 text-center" style={{ color: "var(--color-fg-ink-dim)" }}>불러오는 중...</div>
          ) : teams.length === 0 ? (
            <div className="py-20 text-center" style={{ color: "var(--color-fg-ink-dim)" }}>아직 등록된 팀이 없습니다</div>
          ) : (
            <>
              {/* 자동 회전 카드 슬라이더(TeamMarquee) — WebGL 없이 실제 HTML 버튼이라
                  모바일 탭/드래그 100% 동작. 호버/포커스/드래그/선택 시 일시정지. */}
              <TeamMarquee
                items={galleryItems}
                paused={!!selectedTeam}
                reducedMotion={!!prefersReducedMotion}
                edgeClassName="-mx-6 px-6 md:-mx-10 md:px-10"
                ariaLabel="참가 팀 카드 슬라이더"
                renderItem={(item, key) => (
                  <TeamCardButton
                    key={key}
                    item={item}
                    active={selectedTeam?.id === item.id}
                    onSelect={() => {
                      const team = teams.find((entry) => entry.id === item.id);
                      if (team) handleSelect(team);
                    }}
                  />
                )}
              />

              {/* Player cards panel */}
              <AnimatePresence>
                {selectedTeam && (
                  <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 24 }}
                    transition={{ type: "spring", stiffness: 260, damping: 26 }}
                    className="overflow-hidden rounded-2xl"
                    style={{ background: "var(--foreground)", border: "1px solid rgba(0,71,171,0.2)" }}
                  >
                    <div
                      className="flex items-center justify-between px-6 py-4"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-11 w-11 flex-shrink-0">
                          <ClubEmblem
                            name={selectedTeam.name}
                            logoSrc={selectedTeam.logo}
                            index={Math.max(0, teams.findIndex((team) => team.id === selectedTeam.id))}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate" style={{ color: "var(--color-fg-paper)" }}>
                            {selectedTeam.name}
                          </p>
                          <p className="text-xs" style={{ color: "var(--color-fg-blue-soft)" }}>선수 카드</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {/* 가입 신청 — 로그인 + 본인이 팀 미소속이고 본인 팀이
                            아닌 다른 팀을 선택했을 때만 노출. RLS가 최종 강제. */}
                        {currentPlayer &&
                          !currentPlayer.teamId &&
                          selectedTeam.isApproved && (
                            <button
                              onClick={async () => {
                                if (joinRequesting) return;
                                setJoinRequesting(true);
                                try {
                                  await store.requestJoinTeam(selectedTeam.id);
                                  setJoinFeedback({ teamId: selectedTeam.id, state: "ok" });
                                } catch (err) {
                                  console.error("requestJoinTeam:", err);
                                  setJoinFeedback({
                                    teamId: selectedTeam.id,
                                    state: "err",
                                    msg: err instanceof Error ? err.message : "신청 실패",
                                  });
                                } finally {
                                  setJoinRequesting(false);
                                }
                              }}
                              disabled={
                                joinRequesting ||
                                joinFeedback?.teamId === selectedTeam.id
                              }
                              className="rounded-md px-4 py-2.5 min-h-[44px] text-xs font-bold transition-colors disabled:opacity-60"
                              style={{
                                background: "var(--primary)",
                                color: "var(--color-fg-paper)",
                              }}
                            >
                              {joinFeedback?.teamId === selectedTeam.id
                                ? joinFeedback.state === "ok"
                                  ? "신청 완료"
                                  : "신청 실패"
                                : joinRequesting
                                  ? "신청 중…"
                                  : "가입 신청"}
                            </button>
                          )}
                        <button
                          onClick={() => { setSelectedTeam(null); setTeamPlayers([]); }}
                          aria-label="패널 닫기"
                          className="opacity-60 hover:opacity-100 transition-opacity"
                          style={{ color: "var(--color-fg-paper)" }}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* 팀 페이지로 이동 CTA — 인라인 선수목록 대신 명확한 이동 버튼.
                        선수 카드/명단은 팀 페이지(/teams/[id])에서 확인. */}
                    <div className="flex justify-center px-6 py-6">
                      <Link
                        href={`/teams/${selectedTeam.id}`}
                        className="inline-flex min-h-[48px] items-center gap-2 px-6 text-[14px] font-bold transition-transform hover:-translate-y-0.5"
                        style={{
                          background: "var(--primary)",
                          color: "var(--color-fg-paper)",
                          boxShadow: "0 12px 26px rgba(0,71,171,0.3)",
                        }}
                      >
                        {selectedTeam.name} 팀 페이지로 이동 →
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** 네이티브 팀 카드 버튼 — createTeamCardCanvas 로 카드 이미지를 만들어 표시.
    실제 <button> 이라 모바일 탭이 확실히 동작한다. 탭하면 onSelect 로 선택. */
function TeamCardButton({
  item,
  active,
  onSelect,
}: {
  item: TeamGalleryItem;
  active: boolean;
  onSelect: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void createTeamCardCanvas({
      name: item.name,
      logo: item.logo,
      frame: item.frame,
      colorIndex: item.colorIndex,
    })
      .then((canvas) => {
        if (!cancelled) setSrc(canvas.toDataURL("image/png"));
      })
      .catch((err) => console.error("[TeamCardButton] canvas failed:", err));
    return () => {
      cancelled = true;
    };
  }, [item]);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${item.name} 선택`}
      className="shrink-0 snap-center transition-transform active:scale-95"
      style={{
        width: 180,
        borderRadius: 14,
        outline: active ? "2px solid var(--primary)" : "none",
        outlineOffset: 3,
      }}
    >
      {src ? (
        <img src={src} alt={item.name} className="w-full" draggable={false} />
      ) : (
        <div
          className="w-full animate-pulse"
          style={{ aspectRatio: "1080 / 1240", background: "rgba(255,255,255,0.06)", borderRadius: 14 }}
        />
      )}
    </button>
  );
}
