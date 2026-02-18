"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useDataStore } from "@/stores/dataStore";
import { PlayerCard } from "@/components/player-card";
import type { Player } from "@/types";
import { Search } from "lucide-react";

type FilterType = "all" | "gold" | "premium";
type PositionFilter = "all" | "GK" | "FIXO" | "ALA" | "PIVO";

const DEMO_PLAYERS: Player[] = [
  { id: "dp0", uid: "dp0", name: "이감독", number: 0, position: "FIXO", teamId: "d1", nationality: "KOR", photoUrl: "https://randomuser.me/api/portraits/men/3.jpg", cardType: "gold", cardRating: 92, stats: { goals: 0, assists: 0, games: 18, mom: 0 }, badges: [], penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 }, isApproved: true, role: "admin", createdAt: 0 },
  { id: "dp1", uid: "dp1", name: "김민준", number: 10, position: "PIVO", teamId: "d1", nationality: "KOR", photoUrl: "https://randomuser.me/api/portraits/men/32.jpg", cardType: "gold", cardRating: 88, stats: { goals: 12, assists: 7, games: 18, mom: 4 }, badges: [], penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 1 }, isApproved: true, role: "captain", createdAt: 0 },
  { id: "dp2", uid: "dp2", name: "이재원", number: 7, position: "ALA", teamId: "d1", nationality: "KOR", photoUrl: "https://randomuser.me/api/portraits/men/45.jpg", cardType: "gold", cardRating: 84, stats: { goals: 8, assists: 11, games: 17, mom: 3 }, badges: [], penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 }, isApproved: true, role: "player", createdAt: 0 },
  { id: "dp3", uid: "dp3", name: "박성호", number: 1, position: "GK", teamId: "d2", nationality: "KOR", photoUrl: "https://randomuser.me/api/portraits/men/12.jpg", cardType: "gold", cardRating: 82, stats: { goals: 0, assists: 1, games: 16, mom: 5 }, badges: [], penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 }, isApproved: true, role: "player", createdAt: 0 },
  { id: "dp4", uid: "dp4", name: "최현우", number: 5, position: "FIXO", teamId: "d2", nationality: "KOR", photoUrl: "https://randomuser.me/api/portraits/men/67.jpg", cardType: "premium", cardRating: 79, stats: { goals: 3, assists: 5, games: 15, mom: 1 }, badges: [], penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 2 }, isApproved: true, role: "player", createdAt: 0 },
  { id: "dp5", uid: "dp5", name: "정태양", number: 9, position: "PIVO", teamId: "d3", nationality: "KOR", photoUrl: "https://randomuser.me/api/portraits/men/22.jpg", cardType: "premium", cardRating: 76, stats: { goals: 6, assists: 2, games: 14, mom: 2 }, badges: [], penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 1 }, isApproved: true, role: "player", createdAt: 0 },
  { id: "dp6", uid: "dp6", name: "윤준서", number: 11, position: "ALA", teamId: "d3", nationality: "BRA", photoUrl: "https://randomuser.me/api/portraits/men/78.jpg", cardType: "gold", cardRating: 86, stats: { goals: 10, assists: 9, games: 18, mom: 3 }, badges: [], penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 }, isApproved: true, role: "player", createdAt: 0 },
  { id: "dp7", uid: "dp7", name: "강도윤", number: 4, position: "FIXO", teamId: "d4", nationality: "KOR", photoUrl: "https://randomuser.me/api/portraits/men/55.jpg", cardType: "premium", cardRating: 77, stats: { goals: 2, assists: 6, games: 16, mom: 0 }, badges: [], penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 3 }, isApproved: true, role: "player", createdAt: 0 },
  { id: "dp8", uid: "dp8", name: "손영준", number: 8, position: "ALA", teamId: "d4", nationality: "JPN", photoUrl: "https://randomuser.me/api/portraits/men/91.jpg", cardType: "gold", cardRating: 83, stats: { goals: 7, assists: 8, games: 17, mom: 2 }, badges: [], penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 1 }, isApproved: true, role: "player", createdAt: 0 },
  { id: "dp9", uid: "dp9", name: "한지수", number: 3, position: "FIXO", teamId: "d5", nationality: "KOR", photoUrl: "https://randomuser.me/api/portraits/women/44.jpg", cardType: "gold", cardRating: 80, stats: { goals: 4, assists: 7, games: 15, mom: 2 }, badges: [], penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 }, isApproved: true, role: "player", createdAt: 0 },
  { id: "dp10", uid: "dp10", name: "오서준", number: 14, position: "PIVO", teamId: "d5", nationality: "KOR", photoUrl: "https://randomuser.me/api/portraits/men/37.jpg", cardType: "premium", cardRating: 75, stats: { goals: 5, assists: 3, games: 13, mom: 1 }, badges: [], penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 }, isApproved: true, role: "player", createdAt: 0 },
  { id: "dp11", uid: "dp11", name: "임채원", number: 6, position: "GK", teamId: "d6", nationality: "KOR", photoUrl: "https://randomuser.me/api/portraits/men/61.jpg", cardType: "premium", cardRating: 74, stats: { goals: 0, assists: 0, games: 12, mom: 1 }, badges: [], penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 }, isApproved: true, role: "player", createdAt: 0 },
];

export default function PlayersPage() {
  const store = useDataStore();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cardFilter, setCardFilter] = useState<FilterType>("all");
  const [posFilter, setPosFilter] = useState<PositionFilter>("all");

  useEffect(() => {
    store.fetchPlayers().then((list) => {
      const approved = list.filter((p) => p.isApproved).sort((a, b) => b.cardRating - a.cardRating);
      setPlayers(approved.length > 0 ? approved : DEMO_PLAYERS);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = players.filter((p) => {
    if (cardFilter !== "all" && p.cardType !== cardFilter) return false;
    if (posFilter !== "all" && p.position !== posFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="pt-[60px]">
      {/* Header */}
      <div className="py-16 px-6 md:px-10" style={{ background: "#0D1B2A" }}>
        <div className="max-w-6xl mx-auto">
          <p className="text-[11px] uppercase tracking-[3px] mb-4" style={{ fontFamily: "var(--font-space-mono)", color: "#FFD700" }}>
            Player Cards
          </p>
          <h1 className="font-black leading-none mb-2" style={{ fontFamily: "var(--font-outfit)", fontSize: "clamp(36px, 6vw, 64px)", letterSpacing: "-2px", color: "#FAFCFF" }}>
            FA선수
          </h1>
          <p className="text-sm mb-6" style={{ color: "#627D98" }}>{players.length}명의 등록 선수</p>
          <div className="flex flex-wrap items-center gap-4">
            <a
              href="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: "#00C853", color: "#0D1B2A" }}
            >
              개인 가입 후 선수 등록 →
            </a>
            <p className="text-xs" style={{ color: "#627D98", fontFamily: "var(--font-space-mono)" }}>
              팀 소속 없이 개인으로 가입해 리그에 참가할 수 있습니다
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 md:px-10 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-8 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-48 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-gray-500" />
              <input
                className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-fg-gray-200 bg-white focus:outline-none focus:border-fg-green"
                placeholder="선수 이름 검색"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Card type */}
            <div className="flex gap-1.5">
              {(["all", "gold", "premium"] as FilterType[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setCardFilter(f)}
                  className="px-4 py-2 text-xs font-semibold rounded-full border transition-all"
                  style={{
                    background: cardFilter === f ? "#00C853" : "#ffffff",
                    borderColor: cardFilter === f ? "#00C853" : "#D9E2EC",
                    color: cardFilter === f ? "#ffffff" : "#627D98",
                  }}
                >
                  {f === "all" ? "전체" : f === "gold" ? "골드" : "프리미엄"}
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
                    background: posFilter === p ? "#0D1B2A" : "#ffffff",
                    borderColor: posFilter === p ? "#0D1B2A" : "#D9E2EC",
                    color: posFilter === p ? "#FAFCFF" : "#627D98",
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
            <div className="py-16 text-center text-fg-gray-500">불러오는 중...</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-fg-gray-500">
              <p>검색 결과가 없습니다</p>
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-4">
              {filtered.map((p) => (
                <Link key={p.id} href={`/players/${p.id}`} className="hover:scale-105 transition-transform">
                  <PlayerCard player={p} size="md" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
