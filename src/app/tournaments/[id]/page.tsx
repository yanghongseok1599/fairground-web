"use client";

import { HomeKnockoutSchedule } from "@/features/knockout-schedule/home-knockout-schedule";
import { TournamentActions } from "@/features/kakao-tools/components/tournament-actions";
import { EventShareButton } from "@/features/kakao-tools/components/share-button";
import { getMatchShareLinks } from "@/features/match-share/links";
import { SITE_URL } from "@/lib/site-config";

import { compareScheduledMatches } from "@/lib/match-schedule";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useDataStore } from "@/stores/dataStore";
import { useMatchResults } from "@/features/match-results/use-match-results";
import { fetchResultMatches, fetchResultTournaments, fetchTeamResults } from "@/features/match-results/api";
import { resultStandings, tournamentResultStandings } from "@/features/match-results/model";
import { MatchCard } from "@/components/match-card";
import { finalPlacements } from "@/features/standings/final-placements";
import { ShootoutResultBadge } from "@/features/match-shootout/result-badge";
import { shootoutResultText } from "@/features/match-shootout/model";
import { GroupedStandingsTable } from "@/features/standings/grouped-standings-table";
import type { Tournament, Match, LiveMatch } from "@/types";
import { Calendar, MapPin, Trophy, Radio } from "lucide-react";
import { formatTime } from "@/utils/formatters";
import { getTournamentDisplayName, isTournamentFixturesPublic } from "@/features/tournaments/public-fixtures";

/**
 * 대회 상세 — 진행 중 대회는 라이브 페이지처럼 실시간 동작.
 *  - 실시간 경기 스코어: 대회 범위 직렬 서버 조회 + 1초 타이머 틱
 *  - 경기 결과 / 예정: 이 대회 matches
 *  - 대회 승점표: 이 대회의 종료 경기로 클라이언트 집계(경기 종료 시 자동 갱신)
 */

export default function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const store = useDataStore();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState<Record<string, number>>({});

  useMatchResults({
    key: `tournament:${id}`, tournamentId: id, finalOnly: false, enabled: !loading,
    load: () => Promise.all([fetchResultTournaments(id), fetchResultMatches({ tournamentId: id }), fetchTeamResults()]),
    publish: ([tournaments, latest, teams]) => {
      if (tournaments[0]) setTournament(tournaments[0]);
      setMatches(latest.sort(compareScheduledMatches));
      setElapsed({});
      useDataStore.setState(state => ({ standings: resultStandings(teams, state.standings) }));
    },
  });

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [t, ms] = await Promise.all([
        store.fetchTournament(id),
        store.fetchMatches(id),
      ]);
      if (!alive) return;
      setTournament(t);
      setMatches(ms.sort(compareScheduledMatches));
      await store.fetchStandings();
      if (alive) setLoading(false);
    };
    void load();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // 같은 서버 스냅샷으로 진행·종료·예정 상태를 함께 전환한다.
  const liveMatches = useMemo(
    () => matches.filter((match): match is LiveMatch => match.status === "live" && "elapsedSeconds" in match),
    [matches],
  );

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
  const tournamentStandings = tournamentResultStandings(matches.filter(m => m.groupId && tournament.groups.some(g => g.id === m.groupId) && m.round <= 12));
  const finalRanks = finalPlacements(tournament, matches);
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
            {getTournamentDisplayName(tournament)}
          </h1>
          <div className="flex flex-wrap gap-4 text-sm" style={{ color: "#627D98" }}>
            <div className="flex items-center gap-1.5"><Calendar className="h-4 w-4" />{tournament.date}</div>
            <div className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{tournament.location}</div>
            {tournament.winningTeamName && (
              <div className="flex items-center gap-1.5"><Trophy className="h-4 w-4 text-fg-gold" /><span className="text-fg-gold font-semibold">{tournament.winningTeamName}</span></div>
            )}
          </div>
          <TournamentActions tournament={tournament} />
          {isTournamentFixturesPublic(tournament) && scheduledMatches.length > 0 && (
            <a href="#fixtures" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-bold text-[#0D1B2A]">
              경기 대진표 보기 <span className="text-xs font-medium text-[#627D98]">{scheduledMatches.length}경기</span>
              <span aria-hidden="true">→</span>
            </a>
          )}
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
                      <ShootoutResultBadge match={m} className="px-6 pb-5 text-center" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tournament.id === "5ff73034-1747-4b9e-874a-6fe19fa68ac1" && <HomeKnockoutSchedule />}

          {/* 대회 승점표 — 종료 경기 기준 실시간 집계 */}
          {(tournamentStandings.length > 0 || finalRanks.length > 0) && (
            <div>
              <h2 className="text-lg font-bold mb-4" style={{ fontFamily: "var(--font-outfit)", color: "#0D1B2A" }}>{finalRanks.length ? "최종 순위" : "조별 순위"}</h2>
              <GroupedStandingsTable key={tournament.id} standings={tournamentStandings} groups={tournament.groups} finalRanks={finalRanks} />
            </div>
          )}

          {/* 경기 결과 */}
          {finishedMatches.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-4" style={{ fontFamily: "var(--font-outfit)", color: "#0D1B2A" }}>경기 결과</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {finishedMatches.map((m) => <div key={m.id} id={`match-${m.id}`} className="scroll-mt-24 space-y-3">
                  <MatchCard match={m} />
                  <EventShareButton label="결과 공유" content={{
                    title: `${m.homeTeamName} ${m.homeScore} : ${m.awayScore} ${m.awayTeamName}`,
                    description: `${getTournamentDisplayName(tournament)} · R${m.round} · 경기 종료${shootoutResultText(m) ? ` · ${shootoutResultText(m)}` : ""}`,
                    ...getMatchShareLinks(SITE_URL, m.id, m.homeScore, m.awayScore, m.homeShootoutScore, m.awayShootoutScore),
                  }} />
                </div>)}
              </div>
            </div>
          )}

          {/* 예정 경기 — 운영진이 대진을 확정해 공개하기 전에는 숨긴다.
              대진 초안이 참가팀에게 먼저 새어 나가면 조정할 때마다 혼선이 생긴다. */}
          {isTournamentFixturesPublic(tournament) && scheduledMatches.length > 0 && (
            <div id="fixtures" className="scroll-mt-24">
              <h2 className="text-lg font-bold mb-4" style={{ fontFamily: "var(--font-outfit)", color: "#0D1B2A" }}>경기 대진표 <span className="ml-1 text-sm font-medium text-[#627D98]">{scheduledMatches.length}경기</span></h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {scheduledMatches.map((m) => <MatchCard key={m.id} match={m} />)}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
