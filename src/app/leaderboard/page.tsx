"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Gauge, Shield } from "lucide-react";
import { GroundChallengeLeaderboard } from "@/components/ground-challenge-leaderboard";
import { useDataStore } from "@/stores/dataStore";
import { PlayerProfilePhoto } from "@/components/player-profile-photo";
import { PUBLIC_PAGE_CONTENT_CLASS, PUBLIC_PAGE_GUTTER_CLASS } from "@/lib/page-layout";
import { getPlayerProfilePhotoUrl } from "@/lib/player-profile-photo";
import type { Player } from "@/types";

type Category = "goals" | "assists" | "mom" | "games" | "streak" | "rating";
type LeaderboardView = "league" | "ground";

interface Tab {
  key: Category;
  label: string;
  // fg-mono 단축 코드 — 탭 라벨 좌측 칩에 노출. lucide 이모티콘을 stat code 로
  // 대체해 FairGround 의 데이터-스코어보드 톤(예: HUD/통계 박스)에 맞춘다.
  short: string;
  getValue: (p: Player) => number;
  unit: string;
}

const TABS: Tab[] = [
  { key: "rating",  label: "오버롤",     short: "OVR",  getValue: (p) => p.cardRating ?? 70,             unit: "" },
  { key: "goals",   label: "득점",       short: "G",    getValue: (p) => p.stats.goals,                  unit: "골" },
  { key: "assists", label: "어시스트",   short: "A",    getValue: (p) => p.stats.assists,                unit: "어시" },
  { key: "mom",     label: "MOM",        short: "MOM",  getValue: (p) => p.stats.mom,                    unit: "회" },
  { key: "games",   label: "출전",       short: "GP",   getValue: (p) => p.stats.games,                  unit: "경기" },
  { key: "streak",  label: "연속 출전",  short: "STR",  getValue: (p) => p.attendanceStreak ?? 0,        unit: "연속" },
];

export default function LeaderboardPage() {
  const [view, setView] = useState<LeaderboardView>("league");
  const [active, setActive] = useState<Category>("rating");
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchLeaderboard = useDataStore((s) => s.fetchLeaderboard);

  useEffect(() => {
    if (typeof window === "undefined") return;
    queueMicrotask(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("view") === "ground") setView("ground");
    });
  }, []);

  useEffect(() => {
    if (view !== "league") return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
    });
    void (async () => {
      const r = await fetchLeaderboard(active, 20);
      if (!cancelled) {
        setPlayers(r);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [active, fetchLeaderboard, view]);

  const tab = TABS.find((t) => t.key === active)!;
  const switchView = (nextView: LeaderboardView) => {
    setView(nextView);
    if (typeof window === "undefined") return;
    const url = nextView === "ground" ? "/leaderboard?view=ground" : "/leaderboard";
    window.history.replaceState(null, "", url);
  };

  return (
    <main
      className="min-h-screen pt-[60px] pb-16"
      style={{ background: "var(--color-fg-paper-2, var(--color-fg-paper))" }}
    >
      <div className={`${PUBLIC_PAGE_GUTTER_CLASS} py-10`}>
        <div className={PUBLIC_PAGE_CONTENT_CLASS}>
        <header className="mb-6">
          <h1
            className="fg-display mb-1 text-3xl font-black"
            style={{ color: "var(--color-fg-ink)", letterSpacing: "-1px" }}
          >
            랭킹
          </h1>
          <p className="text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>
            리그 통산 기록과 망상 그라운드 챌린지 기록을 나눠서 확인합니다.
          </p>
        </header>

        <div
          className="mb-6 grid grid-cols-2 gap-2 rounded-[8px] border p-2"
          style={{
            background: "var(--color-fg-paper)",
            borderColor: "var(--color-fg-line-soft)",
          }}
          role="tablist"
          aria-label="랭킹 종류"
        >
          {[
            { key: "league" as const, label: "리그", Icon: Shield },
            { key: "ground" as const, label: "그라운드 챌린지", Icon: Gauge },
          ].map(({ key, label, Icon }) => {
            const isActive = view === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => switchView(key)}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[6px] px-4 text-sm font-black transition-colors"
                style={{
                  background: isActive ? "var(--primary)" : "transparent",
                  color: isActive ? "#fff" : "var(--color-fg-ink-muted)",
                }}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>

        {view === "ground" ? (
          <GroundChallengeLeaderboard limit={30} fetchLimit={300} showHeader={false} />
        ) : (
          <>
        {/* 탭 — 모바일 2열 그리드(좌우 라인 정렬), 태블릿 3열, 데스크탑 6열 1행.
            flex-wrap은 칩 시작 위치가 들쭉날쭉했어서 grid로 균일 정렬. */}
        <div
          className="mb-6 grid grid-cols-2 gap-2 rounded-2xl border p-2 sm:grid-cols-3 md:grid-cols-6"
          style={{
            background: "var(--color-fg-paper)",
            borderColor: "var(--color-fg-line-soft)",
          }}
          role="tablist"
        >
          {TABS.map((t) => {
            const isActive = t.key === active;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActive(t.key)}
                className="flex w-full items-center justify-start gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-bold transition-colors md:justify-center"
                style={{
                  background: isActive ? "var(--primary)" : "transparent",
                  color: isActive ? "#fff" : "var(--color-fg-ink-muted)",
                }}
              >
                <span
                  className="fg-mono inline-flex h-6 min-w-[32px] shrink-0 items-center justify-center rounded px-1.5 text-[11px] font-bold tracking-wide"
                  style={{
                    background: isActive ? "rgba(255,255,255,0.18)" : "rgba(0,71,171,0.08)",
                    color: isActive ? "rgba(255,255,255,0.95)" : "var(--primary)",
                    letterSpacing: "1px",
                  }}
                >
                  {t.short}
                </span>
                <span className="whitespace-nowrap">{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* 리스트 */}
        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>
            불러오는 중…
          </div>
        ) : players.length === 0 ? (
          <div
            className="rounded-xl border py-16 text-center text-sm"
            style={{ borderColor: "var(--color-fg-line-soft)", color: "var(--color-fg-ink-muted)" }}
          >
            아직 {tab.label} 기록이 없습니다
          </div>
        ) : (
          <ol className="space-y-2">
            {players.map((p, i) => {
              const v = tab.getValue(p);
              const rank = i + 1;
              const isTopThree = rank <= 3;
              return (
                <li key={p.id}>
                  <Link
                    href={`/players/${p.id}`}
                    className="flex items-center gap-4 rounded-xl border px-4 py-3 transition-colors hover:bg-[color:var(--color-fg-paper-3,#EEF3FF)]"
                    style={{
                      background: "var(--color-fg-paper)",
                      borderColor: "var(--color-fg-line-soft)",
                    }}
                  >
                    {/* 순위 패드 — gold/silver/bronze 원형 메달 대신 FairGround
                        스코어보드 톤의 사각 패드. 1위 primary fill, 2~3위
                        primary soft, 4위~ 라인만. 모든 숫자는 fg-display 로
                        헤더(h1 "랭킹") 와 같은 활자 체계. */}
                    <div
                      className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg"
                      style={{
                        background:
                          rank === 1
                            ? "var(--primary)"
                            : isTopThree
                              ? "rgba(0,71,171,0.10)"
                              : "transparent",
                        border:
                          rank === 1
                            ? "none"
                            : isTopThree
                              ? "1px solid rgba(0,71,171,0.22)"
                              : "1px solid var(--color-fg-line-soft)",
                        color:
                          rank === 1
                            ? "#fff"
                            : isTopThree
                              ? "var(--primary)"
                              : "var(--color-fg-ink-muted)",
                      }}
                      aria-label={`${rank}위`}
                    >
                      <span
                        className="fg-mono text-[8px] font-bold tracking-wider opacity-70 leading-none"
                        style={{ letterSpacing: "1.2px" }}
                      >
                        RANK
                      </span>
                      <span className="fg-display text-base font-black tabular-nums leading-tight">
                        {rank}
                      </span>
                    </div>

                    {/* 아바타 */}
                    <PlayerProfilePhoto
                      src={getPlayerProfilePhotoUrl(p)}
                      alt={p.name}
                      className="h-11 w-11 rounded-full"
                    />

                    {/* 이름 + 등번호 */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="truncate font-bold" style={{ color: "var(--color-fg-ink)" }}>
                          {p.name}
                        </span>
                        {p.number > 0 && (
                          <span
                            className="font-mono text-xs"
                            style={{ color: "var(--color-fg-ink-muted)" }}
                          >
                            #{p.number}
                          </span>
                        )}
                      </div>
                      <div className="text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>
                        {p.position} · 통산 {p.stats.games}경기
                      </div>
                    </div>

                    {/* 값 */}
                    <div className="text-right">
                      <div
                        className="font-black text-2xl tabular-nums leading-none"
                        style={{ color: "var(--primary)" }}
                      >
                        {v}
                      </div>
                      {tab.unit && (
                        <div className="text-[10px]" style={{ color: "var(--color-fg-ink-muted)" }}>
                          {tab.unit}
                        </div>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
          </>
        )}
        </div>
      </div>
    </main>
  );
}
