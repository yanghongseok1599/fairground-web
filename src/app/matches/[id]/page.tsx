"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useDataStore } from "@/stores/dataStore";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ArrowLeftRight,
  Loader2,
  AlertTriangle,
  ListOrdered,
} from "lucide-react";
import { resolveMatchTrack } from "@/lib/match-operation-access";
import type { Match, MatchStatus } from "@/types";

/**
 * 공개 경기 상세 페이지.
 * - URL: /matches/[id]
 * - 경기 기본 정보 + 점수 표시.
 * - 라이브 경기 + 본인 팀 감독(coach 트랙)일 경우 "교체 관리" 버튼 표시 → /matches/[id]/coach.
 * - 출전 명단 링크 → /matches/[id]/lineup.
 */
export default function MatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = (params?.id as string) ?? "";

  const store = useDataStore();
  const { player, initialized } = useAuth();

  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!matchId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const m = await store.fetchMatch("", matchId);
        if (!alive) return;
        if (!m) {
          setError("경기를 찾을 수 없습니다");
          setMatch(null);
          return;
        }
        setMatch(m);
      } catch (err) {
        if (!alive) return;
        setError(
          err instanceof Error
            ? err.message
            : "경기 정보를 불러오지 못했습니다",
        );
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  if (!matchId) {
    return (
      <PageShell>
        <ErrorState message="경기 ID가 없습니다" onBack={() => router.back()} />
      </PageShell>
    );
  }

  if (loading || !initialized) {
    return (
      <PageShell>
        <div
          className="flex items-center justify-center py-20 text-sm"
          style={{ color: "var(--muted-foreground)" }}
        >
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          경기 정보를 불러오는 중…
        </div>
      </PageShell>
    );
  }

  if (error || !match) {
    return (
      <PageShell>
        <ErrorState
          message={error ?? "경기를 찾을 수 없습니다"}
          onBack={() => router.back()}
        />
      </PageShell>
    );
  }

  const status: MatchStatus = match.status;
  const statusLabel =
    status === "scheduled"
      ? "예정"
      : status === "live"
        ? "진행중"
        : status === "finished"
          ? "종료"
          : "취소";
  const statusClass =
    status === "scheduled"
      ? "bg-blue-100 text-blue-700"
      : status === "live"
        ? "bg-red-100 text-red-700"
        : status === "finished"
          ? "bg-gray-100 text-gray-700"
          : "bg-amber-100 text-amber-700";

  // 감독 교체 진입 버튼: 라이브 + coach 트랙인 경우만 표시
  const isCoach =
    status === "live" && resolveMatchTrack(player ?? null, match) === "coach";

  return (
    <PageShell>
      {/* 헤더 */}
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-2 inline-flex items-center gap-1 text-xs"
            style={{ color: "var(--muted-foreground)" }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            돌아가기
          </button>
          <h1
            className="leading-tight"
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 800,
              fontSize: "clamp(22px, 4vw, 32px)",
              letterSpacing: "-0.02em",
              color: "var(--color-fg-ink, var(--foreground))",
            }}
          >
            경기 상세
          </h1>
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--muted-foreground)" }}
          >
            {new Date(match.scheduledAt).toLocaleString("ko-KR", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            <span className="mx-2">·</span>R{match.round}
          </p>
        </div>
        <Badge className={`shrink-0 ${statusClass}`}>{statusLabel}</Badge>
      </div>

      {/* 스코어보드 */}
      <div
        className="mb-6 rounded-lg border p-6"
        style={{
          background: "var(--color-fg-paper, var(--background))",
          borderColor:
            status === "live"
              ? "var(--destructive)"
              : "var(--color-fg-line-soft, var(--border))",
        }}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1 text-center">
            <p
              className="truncate text-lg font-bold"
              style={{ color: "var(--color-fg-ink, var(--foreground))" }}
            >
              {match.homeTeamName}
            </p>
          </div>
          <div
            className="shrink-0 tabular-nums"
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 800,
              fontSize: "clamp(36px, 8vw, 56px)",
              letterSpacing: "-0.02em",
              color: "var(--color-fg-ink, var(--foreground))",
            }}
          >
            {match.homeScore}
            <span
              className="mx-3"
              style={{ color: "var(--muted-foreground)", fontSize: "0.6em" }}
              aria-hidden
            >
              :
            </span>
            <span className="sr-only"> 대 </span>
            {match.awayScore}
          </div>
          <div className="min-w-0 flex-1 text-center">
            <p
              className="truncate text-lg font-bold"
              style={{ color: "var(--color-fg-ink, var(--foreground))" }}
            >
              {match.awayTeamName}
            </p>
          </div>
        </div>
      </div>

      {/* CTA 버튼 영역 */}
      <div className="flex flex-wrap gap-3">
        {/* 감독 교체 관리 버튼 (라이브 + coach 트랙만) */}
        {isCoach && (
          <Link href={`/matches/${matchId}/coach`}>
            <Button
              variant="default"
              className="min-h-[44px] gap-2 bg-red-600 text-white hover:bg-red-700"
            >
              <ArrowLeftRight className="h-4 w-4" />
              교체 관리
            </Button>
          </Link>
        )}

        {/* 출전 명단 링크 */}
        <Link href={`/matches/${matchId}/lineup`}>
          <Button variant="outline" className="min-h-[44px] gap-2">
            <ListOrdered className="h-4 w-4" />
            출전 명단
          </Button>
        </Link>
      </div>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-[60px]">
      <div
        className="px-4 py-6 sm:px-6 md:px-10 md:py-10"
        style={{ background: "var(--color-fg-paper, var(--background))" }}
      >
        <div className="mx-auto max-w-3xl">{children}</div>
      </div>
    </div>
  );
}

function ErrorState({
  message,
  onBack,
}: {
  message: string;
  onBack: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center py-20 text-center"
      role="alert"
    >
      <AlertTriangle className="mb-3 h-8 w-8 text-red-500" />
      <p
        className="mb-4 text-sm"
        style={{ color: "var(--muted-foreground)" }}
      >
        {message}
      </p>
      <Button variant="outline" className="min-h-[44px]" onClick={onBack}>
        돌아가기
      </Button>
    </div>
  );
}
