"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useDataStore } from "@/stores/dataStore";
import { MatchCard } from "@/components/match-card";
import { StandingsTable } from "@/components/standings-table";
import type { Tournament, Match, TeamStanding } from "@/types";
import { Calendar, MapPin, Trophy, Radio } from "lucide-react";
import { formatTime } from "@/utils/formatters";

/**
 * 대회 상세 — 진행 중 대회는 라이브 페이지처럼 실시간 동작.
 *  - 실시간 경기 스코어: subscribeLiveMatches 구독 + 1초 타이머 틱
 *  - 경기 결과 / 예정: 이 대회 matches
 *  - 대회 승점표: 이 대회의 종료 경기로 클라이언트 집계(경기 종료 시 자동 갱신)
 *  - 리그 순위: store.standings(시즌 전체) — 경기 종료 시 재조회로 실시간 반영
 */

// 종료 경기로 대회 승점표 집계 (승 3 · 무 1 · 패 0).
function computeStandings(matches: Match[]): TeamStanding[] {
  const acc = new Map<string, TeamStanding>();
  const ensure = (teamId: string, teamName: string): TeamStanding => {
    let s = acc.get(teamId);
    if (!s) {
      s = {
        teamId,
        teamName,
        teamLogo: "",
        points: 0,
        matchPoints: 0,
        participationBonus: 0,
        rank: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        gamesPlayed: 0,
      };
      acc.set(teamId, s);
    } else if (teamName && s.teamName !== teamName) {
      s.teamName = teamName;
    }
    return s;
  };

  for (const m of matches) {
    if (m.status !== "finished") continue;
    const home = ensure(m.homeTeamId, m.homeTeamName);
    const away = ensure(m.awayTeamId, m.awayTeamName);
    home.gamesPlayed += 1;
    away.gamesPlayed += 1;
    home.goalsFor += m.homeScore;
    home.goalsAgainst += m.awayScore;
    away.goalsFor += m.awayScore;
    away.goalsAgainst += m.homeScore;
    if (m.homeScore > m.awayScore) {
      home.wins += 1; away.losses += 1; home.matchPoints += 3;
    } else if (m.homeScore < m.awayScore) {
      away.wins += 1; home.losses += 1; away.matchPoints += 3;
    } else {
      home.draws += 1; away.draws += 1; home.matchPoints += 1; away.matchPoints += 1;
    }
  }

  const rows = [...acc.values()].map((s) => ({
    ...s,
    goalDifference: s.goalsFor - s.goalsAgainst,
    points: s.matchPoints,
  }));
  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDifference - a.goalDifference ||
      b.goalsFor - a.goalsFor ||
      a.teamName.localeCompare(b.teamName),
  );
  rows.forEach((s, i) => { s.rank = i + 1; });
  return rows;
}

export default function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const store = useDataStore();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState<Record<string, number>>({});

  // 이 대회 경기 + 시즌 순위 재조회 (경기 종료 등으로 결과·순위가 바뀔 때).
  const refresh = useMemo(
    () => async () => {
      const ms = await store.fetchMatches(id);
      setMatches(ms.sort((a, b) => a.round - b.round));
      await store.fetchStandings();
    },
    [id, store],
  );

  useEffect(() => {
    const unsub = store.subscribeLiveMatches();
    const load = async () => {
      const [t, ms] = await Promise.all([
        store.fetchTournament(id),
        store.fetchMatches(id),
      ]);
      setTournament(t);
      setMatches(ms.sort((a, b) => a.round - b.round));
      void store.fetchStandings();
      setLoading(false);
    };
    void load();
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // 이 대회에 속한 라이브 경기 (matchId 기준 필터).
  const matchIds = useMemo(() => new Set(matches.map((m) => m.id)), [matches]);
  const liveMatches = useMemo(
    () => store.liveMatches.filter((m) => matchIds.has(m.id)),
    [store.liveMatches, matchIds],
  );

  // 라이브 경기 집합(시작/종료)이 바뀌면 결과·승점표·리그순위 재조회.
  const liveKey = liveMatches.map((m) => m.id).sort().join(",");
  const prevLiveKey = useRef<string | null>(null);
  useEffect(() => {
    if (prevLiveKey.current === null) { prevLiveKey.current = liveKey; return; }
    if (prevLiveKey.current !== liveKey) {
      prevLiveKey.current = liveKey;
      void refresh();
    }
  }, [liveKey, refresh]);

  // 라이브 경기 1초 타이머 틱.
  useEffect(() => {
    const ids = liveMatches.filter((m) => m.isRunning).map((m) => m.id);
    if (ids.length === 0) return;
    const timer = setInterval(() => {
      setElapsed((prev) => {
        const next = { ...prev };
        ids.forEach((mid) => { next[mid] = (next[mid] || 0) + 1; });
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [liveMatches]);

  if (loading) return <div className="pt-[60px] py-20 text-center text-fg-gray-500">불러오는 중...</div>;
  if (!tournament) return <div className="pt-[60px] py-20 text-center text-fg-gray-500">대회를 찾을 수 없습니다</div>;

  const finishedMatches = matches.filter((m) => m.status === "finished");
  const scheduledMatches = matches.filter((m) => m.status === "scheduled");
  const tournamentStandings = computeStandings(matches);
  const isOngoing = tournament.status === "ongoing" || liveMatches.length > 0;

  return (
    <div className="pt-[60px]">
      {/* Header */}
      <div className="py-16 px-6 md:px-10" style={{ background: "#0D1B2A" }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 mb-4">
            {isOngoing && (
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "rgba(255,59,48,0.16)", color: "#FF5A52" }}>
                <Radio className="h-3 w-3" /> LIVE
              </span>
            )}
            <p className="text-[11px] uppercase tracking-[3px]" style={{ fontFamily: "var(--font-space-mono)", color: "#00C853" }}>
              Tournament
            </p>
          </div>
          <h1 className="font-black leading-none mb-4" style={{ fontFamily: "var(--font-outfit)", fontSize: "clamp(28px, 5vw, 56px)", letterSpacing: "-2px", color: "#FAFCFF" }}>
            {tournament.name}
          </h1>
          <div className="flex flex-wrap gap-4 text-sm" style={{ color: "#627D98" }}>
            <div className="flex items-center gap-1.5"><Calendar className="h-4 w-4" />{tournament.date}</div>
            <div className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{tournament.location}</div>
            {tournament.winningTeamName && (
              <div className="flex items-center gap-1.5"><Trophy className="h-4 w-4 text-fg-gold" /><span className="text-fg-gold font-semibold">{tournament.winningTeamName}</span></div>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 md:px-10 py-10">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* Live — 라이브 페이지와 동일한 실시간 스코어 카드 */}
          {liveMatches.length > 0 && (
            <div>
              <div className="mb-4 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full animate-pulse-dot" style={{ background: "var(--destructive)" }} />
                <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-outfit)", color: "#0D1B2A" }}>실시간 경기</h2>
              </div>
              <div className="space-y-4">
                {liveMatches.map((m) => {
                  const base = m.elapsedSeconds;
                  const tick = elapsed[m.id] || 0;
                  const total = m.isRunning ? base + tick : base;
                  return (
                    <div key={m.id} className="border" style={{ background: "var(--color-fg-paper)", borderColor: "var(--destructive)" }}>
                      <div className="flex items-center justify-center px-6 py-3" style={{ borderBottom: "1px solid var(--color-fg-paper-3)", background: "color-mix(in srgb, var(--destructive) 6%, transparent)" }}>
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full animate-pulse-dot" style={{ background: "var(--destructive)" }} />
                          <span className="fg-label" style={{ color: "var(--destructive)" }}>LIVE</span>
                        </div>
                      </div>
                      <div role="status" aria-live="polite" aria-atomic="true" className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-6 py-6">
                        <div className="flex min-w-0 items-center justify-end gap-2 text-right">
                          <p className="truncate text-lg font-bold" style={{ color: "var(--color-fg-ink)", fontFamily: "var(--font-body)" }}>{m.homeTeamName}</p>
                          <span className="tabular-nums leading-none" style={{ fontFamily: "var(--font-body)", fontWeight: 800, fontSize: 36, letterSpacing: "-0.02em", color: "var(--color-fg-ink)" }}>{m.homeScore}</span>
                        </div>
                        <div className="flex flex-col items-center px-1">
                          <span className="tabular-nums font-bold text-lg" style={{ color: "var(--primary)", fontFamily: "var(--font-body)" }}>
                            <span className="sr-only">경과 시간 </span>{formatTime(total)}
                          </span>
                          <span className="fg-label" style={{ color: "var(--destructive)" }}>LIVE</span>
                        </div>
                        <div className="flex min-w-0 items-center justify-start gap-2 text-left">
                          <span className="tabular-nums leading-none" style={{ fontFamily: "var(--font-body)", fontWeight: 800, fontSize: 36, letterSpacing: "-0.02em", color: "var(--color-fg-ink)" }}>{m.awayScore}</span>
                          <p className="truncate text-lg font-bold" style={{ color: "var(--color-fg-ink)", fontFamily: "var(--font-body)" }}>{m.awayTeamName}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 대회 승점표 — 종료 경기 기준 실시간 집계 */}
          {tournamentStandings.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-4" style={{ fontFamily: "var(--font-outfit)", color: "#0D1B2A" }}>대회 승점표</h2>
              <StandingsTable standings={tournamentStandings} />
            </div>
          )}

          {/* 경기 결과 */}
          {finishedMatches.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-4" style={{ fontFamily: "var(--font-outfit)", color: "#0D1B2A" }}>경기 결과</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {finishedMatches.map((m) => <MatchCard key={m.id} match={m} />)}
              </div>
            </div>
          )}

          {/* 예정 경기 */}
          {scheduledMatches.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-4" style={{ fontFamily: "var(--font-outfit)", color: "#0D1B2A" }}>예정 경기</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {scheduledMatches.map((m) => <MatchCard key={m.id} match={m} />)}
              </div>
            </div>
          )}

          {/* 리그 순위 — 시즌 전체 (실시간 반영) */}
          {store.standings.length > 0 && (
            <div>
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-outfit)", color: "#0D1B2A" }}>리그 순위</h2>
                {store.currentSeason && (
                  <span className="text-xs" style={{ color: "#627D98" }}>{store.currentSeason.name}</span>
                )}
              </div>
              <StandingsTable standings={store.standings} showPromotionSplit />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
