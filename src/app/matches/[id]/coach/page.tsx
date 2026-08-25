"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useDataStore } from "@/stores/dataStore";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, AlertTriangle, ArrowLeftRight } from "lucide-react";
import { resolveMatchTrack } from "@/lib/match-operation-access";
import { validateSubstitution } from "@/lib/match-substitution";
import { matchMinuteFromElapsed } from "@/lib/match-config";
import type { Match, MatchLineupEntry } from "@/types";

/**
 * 감독 전체화면 교체 페이지.
 * - URL: /matches/[id]/coach
 * - 라이브 경기 중 본인 팀 선수를 두 번 탭으로 교체:
 *     1탭) 출전 중(선발) 선수 선택(OUT) → 2탭) 교체 대기(벤치) 선수 선택(IN) → 교체 등록.
 * - 본인 팀만. resolveMatchTrack 이 "coach" 일 때만 사용 가능.
 * - 실제 검증/스왑/이벤트 삽입은 substitute_player RPC(서버) 가 트랜잭션으로 처리.
 */
export default function CoachSubstitutionPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = (params?.id as string) ?? "";

  const store = useDataStore();
  const { player, initialized } = useAuth();
  const liveMatches = store.liveMatches;

  const [match, setMatch] = useState<Match | null>(null);
  const [lineup, setLineup] = useState<MatchLineupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 두 번 탭 상태: 선택된 OUT 선수(코트)
  const [outId, setOutId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);
  const [subDone, setSubDone] = useState<string | null>(null);

  const loadLineup = useCallback(async () => {
    const entries = await store.fetchMatchLineup(matchId);
    setLineup(entries);
  }, [matchId, store]);

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
        const entries = await store.fetchMatchLineup(matchId);
        if (!alive) return;
        setLineup(entries);
      } catch (err) {
        if (!alive) return;
        setError(
          err instanceof Error ? err.message : "경기 정보를 불러오지 못했습니다",
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

  // 라이브 타이머(minute/half) 를 얻기 위해 라이브 매치 구독.
  useEffect(() => {
    const unsub = store.subscribeLiveMatches();
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const teamId = player?.teamId ?? "";

  const onCourt = useMemo(
    () => lineup.filter((e) => e.teamId === teamId && e.isStarter),
    [lineup, teamId],
  );
  const bench = useMemo(
    () => lineup.filter((e) => e.teamId === teamId && !e.isStarter),
    [lineup, teamId],
  );

  // 라이브 매치에서 minute/half 도출. 없으면 RPC 기본값(0, 1) 사용.
  const live = useMemo(
    () => liveMatches.find((m) => m.id === matchId) ?? null,
    [liveMatches, matchId],
  );
  const minute = live ? matchMinuteFromElapsed(live.elapsedSeconds ?? 0) : 0;
  const half = live ? live.currentHalf : 1;

  const handleBenchTap = useCallback(
    async (inEntry: MatchLineupEntry) => {
      if (!outId || !player) return;
      const inId = inEntry.playerId;
      setSubError(null);
      setSubDone(null);

      const check = validateSubstitution({ outId, inId, onCourt, bench });
      if (!check.ok) {
        setSubError(`교체할 수 없습니다: ${check.reason}`);
        return;
      }

      const outEntry = onCourt.find((e) => e.playerId === outId);
      setSubmitting(true);
      try {
        await store.substitutePlayer(
          matchId,
          player.teamId,
          outId,
          inId,
          inEntry.playerName ?? "",
          minute,
          half,
        );
        await loadLineup();
        setOutId(null);
        setSubDone(
          `${outEntry?.playerName ?? "선수"} ↔ ${inEntry.playerName ?? "선수"} 교체 완료`,
        );
      } catch (err) {
        setSubError(
          err instanceof Error ? err.message : "교체 등록에 실패했습니다",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [outId, player, onCourt, bench, store, matchId, minute, half, loadLineup],
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

  // 로그인 가드
  if (!player) {
    return (
      <PageShell>
        <div
          role="alert"
          className="flex flex-col items-center justify-center gap-3 py-20 text-center"
        >
          <AlertTriangle className="h-8 w-8 text-amber-500" />
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            교체 기능을 사용하려면 로그인이 필요합니다.
          </p>
          <Link href="/login">
            <Button variant="outline" className="min-h-[44px]">
              로그인
            </Button>
          </Link>
        </div>
      </PageShell>
    );
  }

  // 권한 가드: 본 경기의 감독(coach 트랙)만
  const track = resolveMatchTrack(player, match);
  if (track !== "coach") {
    return (
      <PageShell>
        <ErrorState
          message="이 경기의 감독만 사용할 수 있어요"
          onBack={() => router.back()}
        />
      </PageShell>
    );
  }

  // 상태 가드: 라이브 경기만
  if (match.status !== "live") {
    return (
      <PageShell>
        <ErrorState
          message="경기 진행 중에만 교체할 수 있어요"
          onBack={() => router.back()}
        />
      </PageShell>
    );
  }

  const ownTeamName =
    match.homeTeamId === player.teamId ? match.homeTeamName : match.awayTeamName;

  return (
    <PageShell>
      <div className="mb-5 flex items-start justify-between gap-3">
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
            선수 교체
          </h1>
          <p
            className="mt-1 truncate text-sm"
            style={{ color: "var(--muted-foreground)" }}
          >
            <span className="font-medium">{ownTeamName}</span>
            <span className="mx-2">·</span>
            {live ? `${minute}'` : "진행중"}
          </p>
        </div>
        <Badge className="shrink-0 bg-red-100 text-red-700">진행중</Badge>
      </div>

      {/* 안내 */}
      <div
        className="mb-4 flex items-center gap-2 rounded-md border px-3 py-2 text-xs"
        style={{
          borderColor: "var(--muted)",
          background: "var(--secondary)",
          color: "var(--muted-foreground)",
        }}
      >
        <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" />
        {outId
          ? "교체 대기 선수를 탭하면 교체됩니다. (선택한 출전 선수를 다시 탭하면 취소)"
          : "먼저 빼낼 출전 선수를 탭한 뒤, 투입할 대기 선수를 탭하세요."}
      </div>

      {subError && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{subError}</span>
        </div>
      )}
      {subDone && (
        <div className="mb-4 rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-700">
          {subDone}
        </div>
      )}

      {/* 출전 중 (선발) */}
      <section className="mb-6">
        <h2
          className="mb-2 text-sm font-semibold"
          style={{ color: "var(--color-fg-ink, var(--foreground))" }}
        >
          출전 중{" "}
          <span style={{ color: "var(--muted-foreground)" }}>
            ({onCourt.length})
          </span>
        </h2>
        {onCourt.length === 0 ? (
          <EmptyHint text="출전 중인 선수가 없습니다." />
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {onCourt.map((e) => {
              const selected = outId === e.playerId;
              return (
                <button
                  key={e.playerId}
                  type="button"
                  disabled={submitting}
                  onClick={() =>
                    setOutId(selected ? null : e.playerId)
                  }
                  aria-pressed={selected}
                  className={`flex min-h-[44px] items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition disabled:opacity-50 ${
                    selected
                      ? "border-red-500 bg-red-50 ring-2 ring-red-400"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <JerseyNumber n={e.jerseyNumber} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">
                    {e.playerName ?? "선수"}
                  </span>
                  {selected && (
                    <span className="shrink-0 text-xs font-semibold text-red-600">
                      OUT
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 교체 대기 (벤치) */}
      <section>
        <h2
          className="mb-2 text-sm font-semibold"
          style={{ color: "var(--color-fg-ink, var(--foreground))" }}
        >
          교체 대기{" "}
          <span style={{ color: "var(--muted-foreground)" }}>
            ({bench.length})
          </span>
        </h2>
        {bench.length === 0 ? (
          <EmptyHint text="대기 중인 선수가 없습니다." />
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {bench.map((e) => {
              const armed = !!outId && !submitting;
              return (
                <button
                  key={e.playerId}
                  type="button"
                  disabled={!armed}
                  onClick={() => void handleBenchTap(e)}
                  className={`flex min-h-[44px] items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition ${
                    armed
                      ? "border-green-400 bg-green-50 hover:border-green-500 hover:bg-green-100"
                      : "border-gray-200 bg-white opacity-60"
                  }`}
                >
                  <JerseyNumber n={e.jerseyNumber} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">
                    {e.playerName ?? "선수"}
                  </span>
                  {armed && (
                    <span className="shrink-0 text-xs font-semibold text-green-700">
                      IN
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {submitting && (
        <div
          className="mt-4 flex items-center gap-2 text-xs"
          style={{ color: "var(--muted-foreground)" }}
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          교체 등록 중…
        </div>
      )}
    </PageShell>
  );
}

function JerseyNumber({ n }: { n?: number }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">
      {typeof n === "number" ? n : "–"}
    </span>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div
      className="rounded-md border border-dashed px-3 py-6 text-center text-xs"
      style={{
        borderColor: "var(--muted)",
        color: "var(--muted-foreground)",
      }}
    >
      {text}
    </div>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-[60px]">
      <div
        className="min-h-screen px-4 py-6 sm:px-6 md:px-10 md:py-10"
        style={{ background: "var(--color-fg-paper, var(--background))" }}
      >
        <div className="mx-auto max-w-2xl">{children}</div>
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
      <p className="mb-4 text-sm" style={{ color: "var(--muted-foreground)" }}>
        {message}
      </p>
      <Button variant="outline" className="min-h-[44px]" onClick={onBack}>
        돌아가기
      </Button>
    </div>
  );
}
