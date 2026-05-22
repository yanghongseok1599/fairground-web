"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useDataStore } from "@/stores/dataStore";
import { useAuth } from "@/hooks/useAuth";
import { LineupEditor } from "@/components/lineup-editor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import type { Match, MatchStatus, Player, Team } from "@/types";

/**
 * 출전 명단 제출 페이지.
 * - URL: /matches/[id]/lineup
 * - 양 팀(home/away)에 대해 LineupEditor 2개 (모바일 세로 스택, 데스크톱 2열).
 * - canEdit 판정:
 *    - admin → 양 팀 가능
 *    - player.teamId === team.id && teamRole in [captain, manager, coach] → 해당 팀만
 *    - 그 외 → readonly (관전자)
 */
export default function MatchLineupPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = (params?.id as string) ?? "";

  const store = useDataStore();
  const { player, initialized } = useAuth();

  const [match, setMatch] = useState<Match | null>(null);
  const [homeTeam, setHomeTeam] = useState<Team | null>(null);
  const [awayTeam, setAwayTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!matchId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // tournamentId 는 fetchMatch 의 non-demo 경로에서 사용되지 않음
        const m = await store.fetchMatch("", matchId);
        if (!alive) return;
        if (!m) {
          setError("경기를 찾을 수 없습니다");
          setMatch(null);
          return;
        }
        setMatch(m);
        const [h, a] = await Promise.all([
          store.fetchTeam(m.homeTeamId),
          store.fetchTeam(m.awayTeamId),
        ]);
        if (!alive) return;
        setHomeTeam(h);
        setAwayTeam(a);
      } catch (err) {
        if (!alive) return;
        setError(
          err instanceof Error
            ? err.message
            : "경기 정보를 불러오지 못했습니다"
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

  const isStaffOf = (teamId: string, p: Player | null): boolean => {
    if (!p) return false;
    if (p.role === "admin") return true;
    if (p.teamId !== teamId) return false;
    return (
      p.teamRole === "captain" ||
      p.teamRole === "manager" ||
      p.teamRole === "coach"
    );
  };

  const canEditHome = useMemo(
    () => (match ? isStaffOf(match.homeTeamId, player ?? null) : false),
    [match, player]
  );
  const canEditAway = useMemo(
    () => (match ? isStaffOf(match.awayTeamId, player ?? null) : false),
    [match, player]
  );

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

  const needsLogin = !player;
  const cannotEditEither = !canEditHome && !canEditAway;

  return (
    <PageShell>
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
            출전 명단
          </h1>
          <p
            className="mt-1 truncate text-sm"
            style={{ color: "var(--muted-foreground)" }}
          >
            <span className="font-medium">
              {match.homeTeamName}
            </span>{" "}
            vs{" "}
            <span className="font-medium">{match.awayTeamName}</span>
            <span className="mx-2">·</span>
            {new Date(match.scheduledAt).toLocaleString("ko-KR", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <Badge className={`shrink-0 ${statusClass}`}>{statusLabel}</Badge>
      </div>

      {needsLogin && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">로그인이 필요합니다</p>
            <p className="mt-0.5 text-xs">
              라인업을 편집하려면 로그인해야 해요. 비로그인 상태에서는 라인업을
              관전자 시점으로만 볼 수 있습니다.
            </p>
            <Link
              href="/login"
              className="mt-2 inline-flex"
              aria-label="로그인 페이지로 이동"
            >
              <Button size="sm" variant="outline" className="min-h-[40px]">
                로그인
              </Button>
            </Link>
          </div>
        </div>
      )}

      {!needsLogin && cannotEditEither && status === "scheduled" && (
        <div
          className="mb-4 rounded-md border px-3 py-2 text-xs"
          style={{
            borderColor: "var(--muted)",
            background: "var(--secondary)",
            color: "var(--muted-foreground)",
          }}
        >
          편집 권한이 없어 라인업을 보기 전용으로 표시합니다. 감독·매니저·주장만
          제출할 수 있어요.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <LineupEditor
          matchId={match.id}
          teamId={match.homeTeamId}
          matchStatus={status}
          canEdit={canEditHome}
          teamName={homeTeam?.name ?? match.homeTeamName}
          teamLogo={homeTeam?.logo}
        />
        <LineupEditor
          matchId={match.id}
          teamId={match.awayTeamId}
          matchStatus={status}
          canEdit={canEditAway}
          teamName={awayTeam?.name ?? match.awayTeamName}
          teamLogo={awayTeam?.logo}
        />
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
        <div className="mx-auto max-w-6xl">{children}</div>
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
