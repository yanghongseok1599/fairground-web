"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, RefreshCw } from "lucide-react";
import { PlayerProfilePhoto } from "@/components/player-profile-photo";
import {
  SKILL_CHALLENGE_EVENT_NAME,
  sortSkillChallengeRecords,
  type SkillChallengeRankingMode,
} from "@/lib/skill-challenge";
import {
  fetchSkillChallengeLeaderboard,
  type SkillChallengeLeaderboardRecord,
} from "@/lib/skill-challenge-leaderboard";

interface GroundChallengeLeaderboardProps {
  limit?: number;
  fetchLimit?: number;
  compact?: boolean;
  showHeader?: boolean;
  showViewAllLink?: boolean;
  className?: string;
}

type GroundChallengeMode = Exclude<SkillChallengeRankingMode, "overall">;

const MODES: Array<{
  key: GroundChallengeMode;
  label: string;
  short: string;
  unit: string;
  getValue: (record: SkillChallengeLeaderboardRecord) => string;
}> = [
  {
    key: "speed",
    label: "슈팅 스피드",
    short: "SPD",
    unit: "km/h",
    getValue: (record) => formatDecimal(record.speedKmh),
  },
  {
    key: "target",
    label: "타겟 슈팅",
    short: "TGT",
    unit: "",
    getValue: (record) => formatTargetResult(record),
  },
  {
    key: "airTouch",
    label: "에어볼 터치",
    short: "AIR",
    unit: "점",
    getValue: (record) => formatDecimal(record.airTouchScore),
  },
];

export function GroundChallengeLeaderboard({
  limit = 10,
  fetchLimit = 100,
  compact = false,
  showHeader = true,
  showViewAllLink = false,
  className = "",
}: GroundChallengeLeaderboardProps) {
  const [mode, setMode] = useState<GroundChallengeMode>("speed");
  const [records, setRecords] = useState<SkillChallengeLeaderboardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const nextRecords = await fetchSkillChallengeLeaderboard({ limit: fetchLimit, mode: "speed" });
      setRecords(nextRecords);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "그라운드 챌린지 랭킹을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [fetchLimit]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadRecords();
    });
  }, [loadRecords]);

  const modeMeta = MODES.find((item) => item.key === mode) ?? MODES[0];
  const rankedRecords = useMemo(
    () => sortSkillChallengeRecords(records, mode).slice(0, limit),
    [limit, mode, records],
  );
  const stats = useMemo(() => {
    const completed = records.filter((record) => record.completedAt || (record.speedKmh > 0 && record.targetRecorded && record.airTouchScore > 0)).length;
    const bestSpeed = records.reduce((max, record) => Math.max(max, record.speedKmh), 0);
    return { total: records.length, completed, bestSpeed };
  }, [records]);

  return (
    <section
      className={className}
    >
      {showHeader && (
        <div className="mb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="fg-label text-[10px]" style={{ color: "var(--destructive)" }}>
                GROUND CHALLENGE
              </p>
              <h2 className="mt-2 text-2xl font-black sm:text-3xl" style={{ color: "var(--color-fg-ink)" }}>
                {SKILL_CHALLENGE_EVENT_NAME} 랭킹
              </h2>
              <p className="mt-2 text-sm font-medium" style={{ color: "var(--color-fg-ink-muted)" }}>
                슈팅 스피드·타겟 슈팅·에어볼 터치 기록을 종목별로 확인합니다.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[360px]">
              <StatCell label="참가 기록" value={stats.total} />
              <StatCell label="3종 완료" value={stats.completed} />
              <StatCell label="최고 속도" value={formatDecimal(stats.bestSpeed)} unit="km/h" />
            </div>
          </div>
        </div>
      )}

      <div
        className="mb-6 grid grid-cols-1 gap-2 rounded-2xl border p-2 sm:grid-cols-3"
        style={{
          background: "var(--color-fg-paper)",
          borderColor: "var(--color-fg-line-soft)",
        }}
        role="tablist"
        aria-label="그라운드 챌린지 랭킹 기준"
      >
          {MODES.map(({ key, label, short }) => {
            const isActive = key === mode;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setMode(key)}
                className="flex w-full items-center justify-start gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-bold transition-colors sm:justify-center"
                style={{
                  background: isActive ? "var(--primary)" : "transparent",
                  color: isActive ? "#fff" : "var(--color-fg-ink-muted)",
                }}
              >
                <span
                  className="fg-mono inline-flex h-6 min-w-[38px] shrink-0 items-center justify-center rounded px-1.5 text-[11px] font-bold tracking-wide"
                  style={{
                    background: isActive ? "rgba(255,255,255,0.18)" : "rgba(0,71,171,0.08)",
                    color: isActive ? "rgba(255,255,255,0.95)" : "var(--primary)",
                    letterSpacing: "1px",
                  }}
                >
                  {short}
                </span>
                <span className="whitespace-nowrap">{compact ? short : label}</span>
              </button>
            );
          })}
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>
          불러오는 중…
        </div>
      ) : error ? (
        <div
          className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border px-5 text-center"
          style={{
            background: "var(--color-fg-paper)",
            borderColor: "var(--color-fg-line-soft)",
          }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--color-fg-ink-muted)" }}>{error}</p>
          <button
            type="button"
            onClick={() => void loadRecords()}
            className="inline-flex min-h-10 items-center gap-2 rounded-[6px] border px-4 text-sm font-black transition-colors"
            style={{ borderColor: "var(--color-fg-line-soft)", color: "var(--color-fg-ink)" }}
          >
            <RefreshCw className="h-4 w-4" />
            다시 불러오기
          </button>
        </div>
      ) : rankedRecords.length === 0 ? (
        <div
          className="rounded-xl border py-16 text-center text-sm"
          style={{ borderColor: "var(--color-fg-line-soft)", color: "var(--color-fg-ink-muted)" }}
        >
          아직 기록된 그라운드 챌린지 랭킹이 없습니다
        </div>
      ) : (
        <ol className="space-y-2">
          {rankedRecords.map((record, index) => (
            <li key={record.id}>
              <LeaderboardRow
                record={record}
                rank={index + 1}
                mode={modeMeta}
              />
            </li>
          ))}
        </ol>
      )}

      {showViewAllLink && (
        <div className="mt-4">
          <Link
            href="/leaderboard?view=ground"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[6px] px-4 text-sm font-black transition hover:-translate-y-0.5 sm:w-auto"
            style={{ background: "var(--primary)", color: "#fff" }}
          >
            전체 랭킹 보기
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </section>
  );
}

function LeaderboardRow({
  record,
  rank,
  mode,
}: {
  record: SkillChallengeLeaderboardRecord;
  rank: number;
  mode: (typeof MODES)[number];
}) {
  const href = record.playerId ? `/players/${record.playerId}` : "";
  const isTopThree = rank <= 3;
  const content = (
    <div
      className="flex items-center gap-4 rounded-xl border px-4 py-3 transition-colors hover:bg-[color:var(--color-fg-paper-3,#EEF3FF)]"
      style={{
        background: "var(--color-fg-paper)",
        borderColor: "var(--color-fg-line-soft)",
      }}
    >
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
        <span className="fg-mono text-[8px] font-bold tracking-wider opacity-70 leading-none" style={{ letterSpacing: "1.2px" }}>RANK</span>
        <span className="fg-display text-base font-black tabular-nums leading-tight">{rank}</span>
      </div>

      <PlayerProfilePhoto
        src={record.profilePhotoUrl || record.photoUrl || undefined}
        alt={record.participantName}
        className="h-11 w-11 rounded-full"
      />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate font-bold" style={{ color: "var(--color-fg-ink)" }}>
            {record.participantName}
          </span>
          {record.playerNumber !== null && record.playerNumber > 0 && (
            <span className="font-mono text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>#{record.playerNumber}</span>
          )}
        </div>
        <div className="text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>
          {record.playerPosition || "PLAYER"} · {formatDate(record.eventDate)} · {formatDetail(record)}
        </div>
      </div>

      <div className="min-w-[68px] text-right">
        <div
          className="font-black text-2xl tabular-nums leading-none"
          style={{ color: "var(--primary)" }}
        >
          {mode.getValue(record)}
        </div>
        {mode.unit && (
          <div className="text-[10px]" style={{ color: "var(--color-fg-ink-muted)" }}>
            {mode.unit}
          </div>
        )}
      </div>
    </div>
  );

  if (!href) return content;
  return (
    <Link href={href} className="block">
      {content}
    </Link>
  );
}

function StatCell({ label, value, unit }: { label: string; value: number | string; unit?: string }) {
  return (
    <div
      className="rounded-[6px] border px-3 py-2"
      style={{
        background: "var(--color-fg-paper)",
        borderColor: "var(--color-fg-line-soft)",
      }}
    >
      <div className="fg-display text-xl font-black tabular-nums" style={{ color: "var(--color-fg-ink)" }}>
        {value}
        {unit && <span className="ml-1 text-[10px] font-bold" style={{ color: "var(--color-fg-ink-muted)" }}>{unit}</span>}
      </div>
      <div className="mt-1 text-[10px] font-bold" style={{ color: "var(--color-fg-ink-muted)" }}>{label}</div>
    </div>
  );
}

function formatDecimal(value: number) {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDate(value: string) {
  if (!value) return "날짜 미정";
  const [, month, day] = value.split("-");
  return month && day ? `${Number(month)}.${Number(day)}` : value;
}

function formatDetail(record: SkillChallengeLeaderboardRecord) {
  return `스피드 ${formatDecimal(record.speedKmh)}km/h · 타겟 ${formatTargetResult(record)} · 터치 ${formatDecimal(record.airTouchScore)}점`;
}

function formatTargetResult(record: SkillChallengeLeaderboardRecord) {
  if (record.targetHit) {
    return record.targetAttemptCount ? `3/${record.targetAttemptCount}` : "성공";
  }
  if (record.targetRecorded) return "실패";
  return "-";
}
