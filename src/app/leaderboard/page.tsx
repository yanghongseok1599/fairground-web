"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Target, Sparkles, Star, Gamepad2, Flame, Award } from "lucide-react";
import { useDataStore } from "@/stores/dataStore";
import type { Player } from "@/types";

type Category = "goals" | "assists" | "mom" | "games" | "streak" | "rating";

interface Tab {
  key: Category;
  label: string;
  short: string;
  icon: typeof Target;
  getValue: (p: Player) => number;
  unit: string;
}

const TABS: Tab[] = [
  { key: "rating",  label: "오버롤",     short: "OVR",   icon: Award,     getValue: (p) => p.cardRating ?? 70, unit: "" },
  { key: "goals",   label: "득점",       short: "G",     icon: Target,    getValue: (p) => p.stats.goals,  unit: "골" },
  { key: "assists", label: "어시스트",   short: "A",     icon: Sparkles,  getValue: (p) => p.stats.assists, unit: "어시" },
  { key: "mom",     label: "MOM",        short: "MOM",   icon: Star,      getValue: (p) => p.stats.mom,    unit: "회" },
  { key: "games",   label: "출전",       short: "GP",    icon: Gamepad2,  getValue: (p) => p.stats.games,  unit: "경기" },
  { key: "streak",  label: "연속 출전",  short: "🔥",    icon: Flame,     getValue: (p) => p.attendanceStreak ?? 0, unit: "연속" },
];

export default function LeaderboardPage() {
  const [active, setActive] = useState<Category>("rating");
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchLeaderboard = useDataStore((s) => s.fetchLeaderboard);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const r = await fetchLeaderboard(active, 20);
      if (!cancelled) {
        setPlayers(r);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [active, fetchLeaderboard]);

  const tab = TABS.find((t) => t.key === active)!;

  return (
    <main
      className="min-h-screen pt-[60px] pb-16"
      style={{ background: "var(--color-fg-paper-2, var(--color-fg-paper))" }}
    >
      <div className="mx-auto max-w-3xl px-5 py-10 md:px-8">
        <header className="mb-8">
          <h1
            className="fg-display mb-1 text-3xl font-black"
            style={{ color: "var(--color-fg-ink)", letterSpacing: "-1px" }}
          >
            랭킹
          </h1>
          <p className="text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>
            누가 가장 잘 뛰고 있나? FairGround 통산 기록 기반
          </p>
        </header>

        {/* 탭 */}
        <div
          className="mb-6 flex flex-wrap gap-2 rounded-2xl border p-2"
          style={{
            background: "var(--color-fg-paper)",
            borderColor: "var(--color-fg-line-soft)",
          }}
          role="tablist"
        >
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = t.key === active;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActive(t.key)}
                className="flex flex-1 min-w-[100px] items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors"
                style={{
                  background: isActive ? "var(--primary)" : "transparent",
                  color: isActive ? "var(--primary-foreground, #fff)" : "var(--color-fg-ink-muted)",
                }}
              >
                <Icon width={14} height={14} />
                <span>{t.label}</span>
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
                    {/* 순위 */}
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black tabular-nums"
                      style={{
                        background: isTopThree
                          ? rank === 1 ? "#FFD700" : rank === 2 ? "#C0C0C0" : "#CD7F32"
                          : "var(--color-fg-paper-3, #EEF3FF)",
                        color: isTopThree ? "#0D1B2A" : "var(--color-fg-ink-muted)",
                      }}
                    >
                      {rank}
                    </div>

                    {/* 아바타 */}
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full"
                      style={{
                        background: "var(--color-fg-paper-3, #EEF3FF)",
                        border: "1px solid var(--color-fg-line-soft)",
                      }}
                    >
                      {p.profilePhotoUrl || p.photoUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={p.profilePhotoUrl || p.photoUrl}
                          alt={p.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-bold" style={{ color: "var(--color-fg-ink-muted)" }}>
                          {p.name.slice(0, 1)}
                        </span>
                      )}
                    </div>

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
      </div>
    </main>
  );
}
