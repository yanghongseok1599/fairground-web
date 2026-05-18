"use client";

import { useEffect, useState } from "react";
import { useDataStore } from "@/stores/dataStore";
import { MatchCard } from "@/components/match-card";
import { Section } from "@/components/section";
import { EmptyState } from "@/components/empty-state";
import type { Match } from "@/types";
import { Radio } from "lucide-react";
import { formatTime } from "@/utils/formatters";

export default function LivePage() {
  const store = useDataStore();
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [elapsed, setElapsed] = useState<Record<string, number>>({});

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
                      className="flex items-center justify-between px-6 py-4"
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
                          LIVE · {m.currentHalf === 1 ? "전반" : "후반"}
                        </span>
                      </div>
                      {/* Elapsed time updates every second — announced politely. */}
                      <span
                        role="status"
                        aria-live="polite"
                        className="tabular-nums font-bold text-lg"
                        style={{
                          color: "var(--primary)",
                          fontFamily: "var(--font-body)",
                        }}
                      >
                        <span className="sr-only">경과 시간 </span>
                        {formatTime(totalElapsed)}
                      </span>
                    </div>
                    {/* Score changes are conveyed via this status region so
                        screen readers hear updates without a page reload (A9). */}
                    <div
                      role="status"
                      aria-live="polite"
                      aria-atomic="true"
                      className="flex items-center justify-between gap-4 px-6 py-6"
                    >
                      <div className="flex-1 text-right">
                        <p
                          className="text-lg font-bold"
                          style={{
                            color: "var(--color-fg-ink)",
                            fontFamily: "var(--font-body)",
                          }}
                        >
                          {m.homeTeamName}
                        </p>
                      </div>
                      <div
                        className="flex items-center gap-2 tabular-nums"
                        style={{
                          fontFamily: "var(--font-body)",
                          fontWeight: 800,
                          fontSize: 40,
                          letterSpacing: "-0.02em",
                          color: "var(--color-fg-ink)",
                        }}
                      >
                        <span>{m.homeScore}</span>
                        <span
                          style={{ color: "var(--color-fg-ink-ghost)", fontSize: 24 }}
                          aria-hidden
                        >
                          :
                        </span>
                        <span className="sr-only"> 대 </span>
                        <span>{m.awayScore}</span>
                      </div>
                      <div className="flex-1">
                        <p
                          className="text-lg font-bold"
                          style={{
                            color: "var(--color-fg-ink)",
                            fontFamily: "var(--font-body)",
                          }}
                        >
                          {m.awayTeamName}
                        </p>
                      </div>
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
