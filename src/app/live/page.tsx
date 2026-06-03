"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useDataStore } from "@/stores/dataStore";
import { MatchCard } from "@/components/match-card";
import { Section } from "@/components/section";
import { EmptyState } from "@/components/empty-state";
import type { Match, MatchLineupEntry } from "@/types";
import { ChevronDown, ChevronUp, Loader2, Radio, Star, Users } from "lucide-react";
import { formatTime } from "@/utils/formatters";

export default function LivePage() {
  const store = useDataStore();
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [elapsed, setElapsed] = useState<Record<string, number>>({});
  // matchId → 라인업 캐시 (lazy: 토글 펼침 시 첫 로드)
  const [lineupByMatch, setLineupByMatch] = useState<
    Record<string, MatchLineupEntry[] | "loading">
  >({});
  const [expandedLineupMatchId, setExpandedLineupMatchId] = useState<
    string | null
  >(null);

  const toggleLineup = async (matchId: string) => {
    if (expandedLineupMatchId === matchId) {
      setExpandedLineupMatchId(null);
      return;
    }
    setExpandedLineupMatchId(matchId);
    if (lineupByMatch[matchId] && lineupByMatch[matchId] !== "loading") return;
    setLineupByMatch((prev) => ({ ...prev, [matchId]: "loading" }));
    const rows = await store.fetchMatchLineup(matchId);
    setLineupByMatch((prev) => ({ ...prev, [matchId]: rows }));
  };

  useEffect(() => {
    const unsub = store.subscribeLiveMatches();
    const load = async () => {
      const tournaments = await store.fetchTournaments();
      const allMatches: Match[] = [];
      for (const t of tournaments) {
        const ms = await store.fetchMatches(t.id);
        allMatches.push(...ms.filter((m) => m.status === "finished"));
      }
      allMatches.sort((a, b) => b.scheduledAt - a.scheduledAt);
      setRecentMatches(allMatches.slice(0, 6));
    };
    load();
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Local timer tick for live matches
  useEffect(() => {
    const ids = store.liveMatches.filter((m) => m.isRunning).map((m) => m.id);
    if (ids.length === 0) return;
    const timer = setInterval(() => {
      setElapsed((prev) => {
        const next = { ...prev };
        ids.forEach((id) => { next[id] = (next[id] || 0) + 1; });
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [store.liveMatches]);

  return (
    <div className="pt-[60px]">
      {/* Hero bar */}
      <div
        className="py-16 px-6 md:px-10"
        style={{ background: "var(--color-fg-ink)" }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <Radio className="h-5 w-5" style={{ color: "var(--destructive)" }} />
            <span className="fg-label" style={{ color: "var(--destructive)" }}>
              실시간 중계
            </span>
          </div>
          <h1
            className="leading-none mb-2"
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 800,
              fontSize: "clamp(36px, 6vw, 64px)",
              letterSpacing: "-0.02em",
              color: "var(--color-fg-paper)",
            }}
          >
            라이브 스코어
          </h1>
          <p
            className="text-sm"
            style={{
              color: "var(--color-fg-ink-dim)",
              fontFamily: "var(--font-body)",
            }}
          >
            실시간 연동 · 경기 결과 자동 업데이트
          </p>
        </div>
      </div>

      {/* Live matches */}
      <div
        className="px-6 md:px-10 py-10"
        style={{ background: "var(--color-fg-paper)" }}
      >
        <div className="max-w-6xl mx-auto">
          {store.liveMatches.length === 0 ? (
            <EmptyState
              eyebrow="NO LIVE MATCHES"
              title="현재 진행 중인 경기가 없습니다"
              description="경기가 시작되면 실시간으로 업데이트됩니다. 다음 일정과 순위를 확인해 보세요."
              actions={[
                { label: "리그 순위", href: "/standings" },
                { label: "경기 일정", href: "/tournaments" },
              ]}
            />
          ) : (
            <div className="space-y-4">
              {store.liveMatches.map((m) => {
                const baseElapsed = m.elapsedSeconds;
                const extraTick = elapsed[m.id] || 0;
                const totalElapsed = m.isRunning ? baseElapsed + extraTick : baseElapsed;
                return (
                  <div
                    key={m.id}
                    className="border"
                    style={{
                      background: "var(--color-fg-paper)",
                      borderColor: "var(--destructive)",
                    }}
                  >
                    <div
                      className="flex items-center justify-center px-6 py-3"
                      style={{
                        borderBottom: "1px solid var(--color-fg-paper-3)",
                        background: "color-mix(in srgb, var(--destructive) 6%, transparent)",
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full animate-pulse-dot"
                          style={{ background: "var(--destructive)" }}
                        />
                        <span className="fg-label" style={{ color: "var(--destructive)" }}>
                          LIVE
                        </span>
                      </div>
                    </div>
                    {/* 팀명+스코어를 타이머 좌우에 배치. 점수/시간 변동은
                        status 영역으로 화면낭독기에 안내(A9). */}
                    <div
                      role="status"
                      aria-live="polite"
                      aria-atomic="true"
                      className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-6 py-6"
                    >
                      {/* HOME 팀명 + 점수 (왼쪽) */}
                      <div className="flex min-w-0 items-center justify-end gap-2 text-right">
                        <p
                          className="truncate text-lg font-bold"
                          style={{
                            color: "var(--color-fg-ink)",
                            fontFamily: "var(--font-body)",
                          }}
                        >
                          {m.homeTeamName}
                        </p>
                        <span
                          className="tabular-nums leading-none"
                          style={{
                            fontFamily: "var(--font-body)",
                            fontWeight: 800,
                            fontSize: 36,
                            letterSpacing: "-0.02em",
                            color: "var(--color-fg-ink)",
                          }}
                        >
                          {m.homeScore}
                        </span>
                      </div>
                      {/* CENTER: 타이머 (단일 15분) */}
                      <div className="flex flex-col items-center px-1">
                        {/* Elapsed time updates every second — announced politely. */}
                        <span
                          className="tabular-nums font-bold text-lg"
                          style={{
                            color: "var(--primary)",
                            fontFamily: "var(--font-body)",
                          }}
                        >
                          <span className="sr-only">경과 시간 </span>
                          {formatTime(totalElapsed)}
                        </span>
                        <span className="fg-label" style={{ color: "var(--destructive)" }}>
                          LIVE
                        </span>
                      </div>
                      {/* AWAY 점수 + 팀명 (오른쪽) */}
                      <div className="flex min-w-0 items-center justify-start gap-2 text-left">
                        <span
                          className="tabular-nums leading-none"
                          style={{
                            fontFamily: "var(--font-body)",
                            fontWeight: 800,
                            fontSize: 36,
                            letterSpacing: "-0.02em",
                            color: "var(--color-fg-ink)",
                          }}
                        >
                          {m.awayScore}
                        </span>
                        <p
                          className="truncate text-lg font-bold"
                          style={{
                            color: "var(--color-fg-ink)",
                            fontFamily: "var(--font-body)",
                          }}
                        >
                          {m.awayTeamName}
                        </p>
                      </div>
                    </div>
                    {/* 라인업 토글 — lazy 로드. 양 팀 명단 readonly 표시. */}
                    <div
                      className="border-t"
                      style={{ borderColor: "var(--color-fg-paper-3)" }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleLineup(m.id)}
                        aria-expanded={expandedLineupMatchId === m.id}
                        aria-controls={`lineup-panel-${m.id}`}
                        className="flex w-full items-center justify-between px-6 py-3 text-xs font-medium"
                        style={{ color: "var(--color-fg-ink-dim)" }}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" />
                          출전 명단
                        </span>
                        {expandedLineupMatchId === m.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                      {expandedLineupMatchId === m.id && (
                        <div
                          id={`lineup-panel-${m.id}`}
                          className="px-6 pb-4"
                        >
                          <LiveLineupPanel
                            match={m}
                            data={lineupByMatch[m.id]}
                          />
                          <div className="mt-2 text-right">
                            <Link
                              href={`/matches/${m.id}/lineup`}
                              className="text-[11px] underline-offset-2 hover:underline"
                              style={{ color: "var(--muted-foreground)" }}
                            >
                              전체 보기 →
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent results */}
      {recentMatches.length > 0 && (
        <Section label="RECENT RESULTS" title="최근 경기 결과">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentMatches.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

/** 라이브 카드용 라인업 readonly 패널. lazy 데이터 (undefined=미로드, "loading"=로딩중). */
function LiveLineupPanel({
  match,
  data,
}: {
  match: Match;
  data: MatchLineupEntry[] | "loading" | undefined;
}) {
  if (data === undefined || data === "loading") {
    return (
      <div
        className="flex items-center justify-center py-4 text-xs"
        style={{ color: "var(--muted-foreground)" }}
      >
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        명단을 불러오는 중…
      </div>
    );
  }
  if (data.length === 0) {
    return (
      <p
        className="py-3 text-center text-xs"
        style={{ color: "var(--muted-foreground)" }}
      >
        제출된 라인업이 없습니다
      </p>
    );
  }
  const homeEntries = data.filter((e) => e.teamId === match.homeTeamId);
  const awayEntries = data.filter((e) => e.teamId === match.awayTeamId);
  return (
    <div className="grid grid-cols-2 gap-3">
      <LiveLineupColumn name={match.homeTeamName} entries={homeEntries} />
      <LiveLineupColumn name={match.awayTeamName} entries={awayEntries} />
    </div>
  );
}

function LiveLineupColumn({
  name,
  entries,
}: {
  name: string;
  entries: MatchLineupEntry[];
}) {
  const starters = entries.filter((e) => e.isStarter);
  const subs = entries.filter((e) => !e.isStarter);
  return (
    <div>
      <div className="mb-1.5 truncate text-[11px] font-semibold">{name}</div>
      {entries.length === 0 ? (
        <p
          className="text-[10px]"
          style={{ color: "var(--muted-foreground)" }}
        >
          (미제출)
        </p>
      ) : (
        <>
          {starters.length > 0 && (
            <ul className="mb-1.5 space-y-0.5">
              {starters.map((e) => (
                <li
                  key={e.playerId}
                  className="flex items-center gap-1 text-[11px]"
                >
                  <Star
                    className="h-2.5 w-2.5 shrink-0"
                    style={{
                      color: "var(--accent-gold, var(--primary))",
                      fill: "currentColor",
                    }}
                    aria-hidden
                  />
                  {e.jerseyNumber != null && (
                    <span className="font-bold tabular-nums">
                      #{e.jerseyNumber}
                    </span>
                  )}
                  <span className="truncate">
                    {e.playerName ?? e.playerId.slice(0, 8)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {subs.length > 0 && (
            <>
              <div
                className="mt-1 text-[9px] uppercase tracking-wide"
                style={{ color: "var(--muted-foreground)" }}
              >
                교체
              </div>
              <ul className="space-y-0.5">
                {subs.map((e) => (
                  <li
                    key={e.playerId}
                    className="flex items-center gap-1 text-[10px]"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {e.jerseyNumber != null && (
                      <span className="font-bold tabular-nums">
                        #{e.jerseyNumber}
                      </span>
                    )}
                    <span className="truncate">
                      {e.playerName ?? e.playerId.slice(0, 8)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
