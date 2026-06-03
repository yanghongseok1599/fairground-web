"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useDataStore } from "@/stores/dataStore";
import { useAuth } from "@/hooks/useAuth";
import { getCardTypeFromRating, PlayerCard } from "@/components/player-card";
import type { Player } from "@/types";
import { Search } from "lucide-react";

type FilterType = "all" | "bronze" | "silver" | "gold" | "premium";
type PositionFilter = "all" | "GK" | "FIXO" | "ALA" | "PIVO";

const FA_SHOWCASE_PLAYERS: Player[] = [
  {
    id: "fa-gold-1",
    uid: "fa-gold-1",
    name: "한서윤",
    number: 10,
    position: "ALA",
    teamId: "",
    teamName: "FA",
    nationality: "KOR",
    photoUrl: "/images/players/showcase-player-1.png",
    cardType: "gold",
    cardRating: 96,
    stats: { goals: 18, assists: 9, games: 16, mom: 4 },
    badges: ["golden_boot", "mvp"],
    penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 },
    isApproved: true,
    role: "player",
    gender: "female",
    createdAt: 0,
  },
  {
    id: "fa-gold-2",
    uid: "fa-gold-2",
    name: "강민재",
    number: 7,
    position: "PIVO",
    teamId: "",
    teamName: "FA",
    nationality: "KOR",
    photoUrl: "/images/players/showcase-player-2.png",
    cardType: "gold",
    cardRating: 94,
    stats: { goals: 15, assists: 6, games: 15, mom: 3 },
    badges: ["match_winner", "first_goal"],
    penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 },
    isApproved: true,
    role: "player",
    gender: "male",
    createdAt: 0,
  },
  {
    id: "fa-gold-3",
    uid: "fa-gold-3",
    name: "이채린",
    number: 11,
    position: "FIXO",
    teamId: "",
    teamName: "FA",
    nationality: "KOR",
    photoUrl: "/images/players/showcase-player-3.png",
    cardType: "gold",
    cardRating: 93,
    stats: { goals: 7, assists: 13, games: 16, mom: 2 },
    badges: ["playmaker", "fair_play"],
    penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 },
    isApproved: true,
    role: "player",
    gender: "female",
    createdAt: 0,
  },
  {
    id: "fa-gold-4",
    uid: "fa-gold-4",
    name: "오지훈",
    number: 8,
    position: "FIXO",
    teamId: "",
    teamName: "FA",
    nationality: "KOR",
    photoUrl: "/images/players/showcase-player-4.png",
    cardType: "gold",
    cardRating: 92,
    stats: { goals: 5, assists: 10, games: 14, mom: 2 },
    badges: ["iron_man", "captain"],
    penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 },
    isApproved: true,
    role: "player",
    gender: "male",
    createdAt: 0,
  },
  {
    id: "fa-gold-5",
    uid: "fa-gold-5",
    name: "박하은",
    number: 3,
    position: "GK",
    teamId: "",
    teamName: "FA",
    nationality: "KOR",
    photoUrl: "/images/players/fa-park-haeun.png",
    cardType: "gold",
    cardRating: 91,
    stats: { goals: 0, assists: 4, games: 15, mom: 5 },
    badges: ["clean_sheet", "save_king"],
    penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 },
    isApproved: true,
    role: "player",
    gender: "female",
    createdAt: 0,
  },
];

const FA_SHOWCASE_TEAM_LOGOS = [
  "/images/team-logos/ref-afc.png",
  "/images/team-logos/ref-orion.png",
  "/images/team-logos/ref-nova.png",
  "/images/team-logos/ref-rift.png",
  "/images/team-logos/ref-volt.png",
];

export default function PlayersPage() {
  const store = useDataStore();
  const { user } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cardFilter, setCardFilter] = useState<FilterType>("all");
  const [posFilter, setPosFilter] = useState<PositionFilter>("all");

  useEffect(() => {
    store.fetchPlayers().then((list) => {
      const approved = list
        .filter((p) => p.isApproved && !p.teamId && p.role === "player")
        .sort((a, b) => b.cardRating - a.cardRating);
      setPlayers([...FA_SHOWCASE_PLAYERS, ...approved]);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = players.filter((p) => {
    if (cardFilter !== "all" && getCardTypeFromRating(p.cardRating) !== cardFilter) return false;
    if (posFilter !== "all" && p.position !== posFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="pt-[60px]">
      {/* Header */}
      <div className="py-16 px-5 sm:px-8 md:px-10" style={{ background: "var(--foreground)" }}>
        <div className="max-w-6xl mx-auto">
          <p className="text-[11px] uppercase tracking-[3px] mb-4" style={{ fontFamily: "var(--font-space-mono)", color: "var(--accent-gold)" }}>
            Player Cards
          </p>
          <h1 className="font-black leading-none mb-2" style={{ fontFamily: "var(--font-outfit)", fontSize: "clamp(36px, 6vw, 64px)", letterSpacing: "-2px", color: "var(--background)" }}>
            FA선수
          </h1>
          <p className="text-sm mb-6" style={{ color: "var(--color-fg-ink-dim)" }}>{players.length}명의 등록 선수</p>
          <div className="flex flex-wrap items-center gap-4">
            <a
              href={user ? "/my/player-setup" : "/login?returnTo=/my/player-setup"}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              선수 카드 등록하기 →
            </a>
            <p className="text-xs" style={{ color: "var(--color-fg-ink-dim)", fontFamily: "var(--font-space-mono)" }}>
              팀 소속 없이 개인으로 가입해 리그에 참가할 수 있습니다
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 sm:px-8 md:px-10 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-8 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-48 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--color-fg-ink-dim)" }} />
              <input
                className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border bg-white focus:outline-none"
                style={{ borderColor: "var(--border)" }}
                placeholder="선수 이름 검색"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Card type */}
            <div className="flex gap-1.5">
              {(["all", "bronze", "silver", "gold", "premium"] as FilterType[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setCardFilter(f)}
                  className="px-4 py-2 text-xs font-semibold rounded-full border transition-all"
                  style={{
                    background: cardFilter === f ? "var(--primary)" : "var(--background)",
                    borderColor: cardFilter === f ? "var(--primary)" : "var(--border)",
                    color: cardFilter === f ? "var(--primary-foreground)" : "var(--color-fg-ink-dim)",
                  }}
                >
                  {f === "all" ? "전체" : f === "bronze" ? "브론즈" : f === "silver" ? "실버" : f === "gold" ? "골드" : "프리미엄"}
                </button>
              ))}
            </div>

            {/* Position */}
            <div className="flex gap-1.5">
              {(["all", "GK", "FIXO", "ALA", "PIVO"] as PositionFilter[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPosFilter(p)}
                  className="px-3 py-2 text-xs font-semibold rounded-full border transition-all"
                  style={{
                    background: posFilter === p ? "var(--foreground)" : "var(--background)",
                    borderColor: posFilter === p ? "var(--foreground)" : "var(--border)",
                    color: posFilter === p ? "var(--background)" : "var(--color-fg-ink-dim)",
                    fontFamily: "var(--font-space-mono)",
                  }}
                >
                  {p === "all" ? "ALL" : p}
                </button>
              ))}
            </div>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="py-16 text-center" style={{ color: "var(--color-fg-ink-dim)" }}>불러오는 중...</div>
          ) : players.length === 0 ? (
            <div className="py-16 text-center" style={{ color: "var(--color-fg-ink-dim)" }}>
              <p>아직 등록된 선수가 없습니다</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center" style={{ color: "var(--color-fg-ink-dim)" }}>
              <p>검색 결과가 없습니다</p>
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-4">
              {filtered.map((p) => {
                const showcaseIndex = FA_SHOWCASE_PLAYERS.findIndex((player) => player.id === p.id);
                const isShowcase = showcaseIndex >= 0;
                return (
                <Link key={p.id} href={isShowcase ? "/players" : `/players/${p.id}`} className="hover:scale-105 transition-transform">
                  <PlayerCard
                    player={p}
                    size="md"
                    teamLogo={isShowcase ? FA_SHOWCASE_TEAM_LOGOS[showcaseIndex % FA_SHOWCASE_TEAM_LOGOS.length] : undefined}
                  />
                </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
