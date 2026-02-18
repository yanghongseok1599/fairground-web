"use client";

import { useEffect, useState } from "react";
import { useDataStore } from "@/stores/dataStore";
import { MatchCard } from "@/components/match-card";
import { Section } from "@/components/section";
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
        style={{ background: "#0D1B2A" }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <Radio className="h-5 w-5" style={{ color: "#FF6B6B" }} />
            <span
              className="text-[11px] uppercase tracking-[3px]"
              style={{ fontFamily: "var(--font-space-mono)", color: "#FF6B6B" }}
            >
              실시간 중계
            </span>
          </div>
          <h1
            className="font-black leading-none mb-2"
            style={{
              fontFamily: "var(--font-outfit)",
              fontSize: "clamp(36px, 6vw, 64px)",
              letterSpacing: "-2px",
              color: "#FAFCFF",
            }}
          >
            라이브 스코어
          </h1>
          <p className="text-sm" style={{ color: "#627D98" }}>
            Firebase 실시간 연동 · 경기 결과 자동 업데이트
          </p>
        </div>
      </div>

      {/* Live matches */}
      <div className="px-6 md:px-10 py-10" style={{ background: "#0D1B2A" }}>
        <div className="max-w-6xl mx-auto">
          {store.liveMatches.length === 0 ? (
            <div
              className="rounded-2xl p-16 text-center border"
              style={{ borderColor: "rgba(0,200,83,0.2)", background: "rgba(0,200,83,0.03)" }}
            >
              <div className="text-4xl mb-4">⚽</div>
              <h3
                className="text-xl font-bold mb-2"
                style={{ fontFamily: "var(--font-outfit)", color: "#FAFCFF" }}
              >
                현재 진행 중인 경기가 없습니다
              </h3>
              <p className="text-sm" style={{ color: "#627D98" }}>
                경기가 시작되면 실시간으로 업데이트됩니다
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {store.liveMatches.map((m) => {
                const baseElapsed = m.elapsedSeconds;
                const extraTick = elapsed[m.id] || 0;
                const totalElapsed = m.isRunning ? baseElapsed + extraTick : baseElapsed;
                return (
                  <div
                    key={m.id}
                    className="rounded-2xl p-6 border"
                    style={{
                      background: "rgba(0,200,83,0.04)",
                      borderColor: "rgba(0,200,83,0.3)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-fg-coral animate-pulse-dot" />
                        <span
                          className="text-[10px] uppercase tracking-[2px]"
                          style={{ fontFamily: "var(--font-space-mono)", color: "#FF6B6B" }}
                        >
                          LIVE · {m.currentHalf === 1 ? "전반" : "후반"}
                        </span>
                      </div>
                      <span
                        className="font-black tabular-nums text-lg"
                        style={{ fontFamily: "var(--font-outfit)", color: "#00C853" }}
                      >
                        {formatTime(totalElapsed)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 text-right">
                        <p
                          className="text-lg font-bold"
                          style={{ color: "#FAFCFF", fontFamily: "var(--font-outfit)" }}
                        >
                          {m.homeTeamName}
                        </p>
                      </div>
                      <div
                        className="flex items-center gap-2 tabular-nums"
                        style={{
                          fontFamily: "var(--font-outfit)",
                          fontWeight: 900,
                          fontSize: 40,
                          letterSpacing: "-2px",
                          color: "#FAFCFF",
                        }}
                      >
                        <span>{m.homeScore}</span>
                        <span style={{ color: "#627D98", fontSize: 24 }}>:</span>
                        <span>{m.awayScore}</span>
                      </div>
                      <div className="flex-1">
                        <p
                          className="text-lg font-bold"
                          style={{ color: "#FAFCFF", fontFamily: "var(--font-outfit)" }}
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
