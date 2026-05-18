"use client";

import { useEffect, useState } from "react";
import { useDataStore } from "@/stores/dataStore";
import { StandingsTable } from "@/components/standings-table";
import { EmptyState } from "@/components/empty-state";
import type { TeamStanding } from "@/types";
import { Trophy } from "lucide-react";

export default function StandingsPage() {
  const store = useDataStore();
  const [displayStandings, setDisplayStandings] = useState<TeamStanding[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    store.fetchStandings().then(() => {
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loaded) {
      setDisplayStandings(store.standings);
    }
  }, [loaded, store.standings]);

  return (
    <div className="pt-[60px]">
      {/* Header */}
      <div className="py-16 px-6 md:px-10" style={{ background: "var(--foreground)" }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="h-5 w-5" style={{ color: "var(--accent-gold)" }} />
            <span
              className="text-[11px] uppercase tracking-[3px]"
              style={{ fontFamily: "var(--font-space-mono)", color: "var(--accent-gold)" }}
            >
              League Table
            </span>
          </div>
          <h1
            className="font-black leading-none mb-2"
            style={{
              fontFamily: "var(--font-outfit)",
              fontSize: "clamp(36px, 6vw, 64px)",
              letterSpacing: "-2px",
              color: "var(--background)",
            }}
          >
            리그 순위
          </h1>
          {store.currentSeason && (
            <p className="text-sm" style={{ color: "var(--color-fg-ink-dim)" }}>
              {store.currentSeason.name} · {store.currentSeason.startDate} ~ {store.currentSeason.endDate}
            </p>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="px-6 md:px-10 py-10">
        <div className="max-w-6xl mx-auto">
          {!loaded ? (
            <div
              className="py-16 text-center"
              style={{ color: "var(--color-fg-ink-dim)", fontFamily: "var(--font-body)" }}
              role="status"
              aria-live="polite"
            >
              불러오는 중...
            </div>
          ) : displayStandings.length === 0 ? (
            <EmptyState
              eyebrow="STANDINGS"
              title="아직 집계된 순위가 없습니다"
              description="시즌 경기가 진행되면 순위가 자동으로 집계됩니다."
              actions={[
                { label: "라이브 보기", href: "/live" },
                { label: "경기 일정", href: "/tournaments" },
              ]}
            />
          ) : (
            <StandingsTable standings={displayStandings} showPromotionSplit />
          )}

          {/* Legend — color is paired with a text label (WCAG 1.4.1) */}
          {loaded && displayStandings.length > 1 && (
            <div
              className="mt-6 flex flex-wrap gap-5 text-xs"
              style={{ color: "var(--color-fg-ink-muted)", fontFamily: "var(--font-body)" }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="fg-label text-[9px] px-1.5 py-0.5"
                  style={{
                    color: "var(--primary)",
                    border: "1px solid color-mix(in srgb, var(--primary) 40%, transparent)",
                    background: "color-mix(in srgb, var(--primary) 6%, transparent)",
                  }}
                >
                  상위
                </span>
                <span>상위 절반 — 다음 시즌 상위 리그 배정</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="fg-label text-[9px] px-1.5 py-0.5"
                  style={{
                    color: "var(--color-fg-ink-dim)",
                    border: "1px solid var(--color-fg-line-soft)",
                  }}
                >
                  하위
                </span>
                <span>하위 절반 — 다음 시즌 하위 리그 배정</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
