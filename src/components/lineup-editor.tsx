"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDataStore } from "@/stores/dataStore";
import type { MatchLineupEntry, MatchStatus, Player } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Star,
  StarOff,
  Trash2,
  UserPlus,
  Loader2,
  Lock,
} from "lucide-react";

const MAX_REGISTERED = 20;
const MAX_STARTERS = 5;

interface LineupEditorProps {
  matchId: string;
  teamId: string;
  matchStatus: MatchStatus;
  /** 편집 가능 여부. false 면 모든 액션 숨김(관전자 시점 readonly). */
  canEdit: boolean;
  /** 헤더 상단에 표시할 팀명 (없으면 표시 안 함). */
  teamName?: string;
  /** 팀 로고 URL (있으면 헤더 좌측에 작게 표시). */
  teamLogo?: string;
}

/**
 * 출전 명단 편집기.
 * - 좌: 팀 멤버, 라인업에 없는 선수만 "추가" 버튼 노출
 * - 우: 현재 라인업(선발/교체) — 선발 토글, 등번호, 제거
 * - matchStatus !== 'scheduled' 이면 잠금 (서버 트리거와 동일한 제약을 클라이언트에서도 표시)
 * - 정원/RLS 위반은 throw → catch 후 인라인 alert
 */
export function LineupEditor({
  matchId,
  teamId,
  matchStatus,
  canEdit,
  teamName,
  teamLogo,
}: LineupEditorProps) {
  const store = useDataStore();

  const [members, setMembers] = useState<Player[]>([]);
  const [lineup, setLineup] = useState<MatchLineupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const isLocked = matchStatus !== "scheduled";
  const isReadonly = !canEdit || isLocked;

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [mem, lu] = await Promise.all([
        store.fetchTeamPlayers(teamId),
        store.fetchMatchLineup(matchId),
      ]);
      setMembers(mem);
      setLineup(lu.filter((e) => e.teamId === teamId));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, teamId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const memberById = useMemo(() => {
    const m: Record<string, Player> = {};
    for (const p of members) m[p.id] = p;
    return m;
  }, [members]);

  const lineupIds = useMemo(() => new Set(lineup.map((e) => e.playerId)), [lineup]);
  const starters = useMemo(() => lineup.filter((e) => e.isStarter), [lineup]);
  const subs = useMemo(() => lineup.filter((e) => !e.isStarter), [lineup]);
  const availableMembers = useMemo(
    () => members.filter((p) => !lineupIds.has(p.id)),
    [members, lineupIds]
  );

  const startersFull = starters.length >= MAX_STARTERS;
  const rosterFull = lineup.length >= MAX_REGISTERED;

  // 성비 검증 — 대회 규정 제21조: 선발 출전은 남자 3명·여자 2명 고정.
  const genderCount = useMemo(() => {
    let male = 0, female = 0, unknown = 0;
    for (const e of starters) {
      const g = memberById[e.playerId]?.gender;
      if (g === "male") male += 1;
      else if (g === "female") female += 1;
      else unknown += 1; // other / prefer_not_to_say / 미입력
    }
    return { male, female, unknown };
  }, [starters, memberById]);
  const genderOk =
    starters.length === MAX_STARTERS &&
    genderCount.male === 3 &&
    genderCount.female === 2;

  const runAction = async (key: string, fn: () => Promise<void>) => {
    setActionError(null);
    setPendingId(key);
    try {
      await fn();
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "처리에 실패했습니다.");
    } finally {
      setPendingId(null);
    }
  };

  const handleAdd = (playerId: string, asStarter: boolean) => {
    const p = memberById[playerId];
    runAction(`add:${playerId}`, () =>
      store.upsertLineupEntry(matchId, teamId, playerId, {
        isStarter: asStarter,
        jerseyNumber: p?.number ?? undefined,
      })
    );
  };

  const handleRemove = (playerId: string) => {
    runAction(`rm:${playerId}`, () =>
      store.removeLineupEntry(matchId, teamId, playerId)
    );
  };

  const handleToggleStarter = (playerId: string, next: boolean) => {
    runAction(`star:${playerId}`, () =>
      store.setLineupStarter(matchId, teamId, playerId, next)
    );
  };

  // 한 줄짜리 선수 표기. 라인업/멤버 양쪽에서 공용.
  const renderName = (entry: MatchLineupEntry) => {
    const m = memberById[entry.playerId];
    return entry.playerName ?? m?.name ?? entry.playerId.slice(0, 8);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-2 pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex min-w-0 items-center gap-2 text-base">
            {teamLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={teamLogo}
                alt=""
                aria-hidden
                className="h-6 w-6 shrink-0 rounded-full object-cover"
              />
            )}
            <span className="truncate">{teamName ?? "팀 라인업"}</span>
          </CardTitle>
          <div
            className="shrink-0 text-xs"
            style={{ color: "var(--muted-foreground)" }}
            aria-live="polite"
          >
            등록 <span className="font-bold tabular-nums">{lineup.length}</span>
            /{MAX_REGISTERED} · 선발{" "}
            <span className="font-bold tabular-nums">{starters.length}</span>/
            {MAX_STARTERS}
          </div>
        </div>
        {isLocked && (
          <div
            className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs"
            style={{
              borderColor: "var(--muted)",
              background: "var(--secondary)",
              color: "var(--muted-foreground)",
            }}
            role="status"
          >
            <Lock className="h-3.5 w-3.5" />
            <span>
              {matchStatus === "cancelled"
                ? "취소된 경기 — 변경 불가"
                : "경기가 시작됐어요 — 라인업은 변경할 수 없습니다"}
            </span>
          </div>
        )}
        {!isLocked && !canEdit && (
          <div
            className="rounded-md border px-3 py-2 text-xs"
            style={{
              borderColor: "var(--muted)",
              background: "var(--secondary)",
              color: "var(--muted-foreground)",
            }}
          >
            보기 전용 — 라인업 편집 권한이 없습니다
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4 pb-4">
        {actionError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-2.5 text-xs text-red-700"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex-1">{actionError}</span>
            <button
              className="text-red-600 underline-offset-2 hover:underline"
              onClick={() => setActionError(null)}
              aria-label="에러 메시지 닫기"
              type="button"
            >
              닫기
            </button>
          </div>
        )}

        {loading ? (
          <div
            className="flex items-center justify-center py-8 text-sm"
            style={{ color: "var(--muted-foreground)" }}
          >
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            라인업을 불러오는 중…
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* ===== 좌: 팀 멤버 ===== */}
            <section aria-labelledby={`members-${teamId}`} className="space-y-2">
              <div className="flex items-center justify-between">
                <h3
                  id={`members-${teamId}`}
                  className="fg-label"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  팀 멤버 ({members.length})
                </h3>
              </div>
              {members.length === 0 ? (
                <p
                  className="rounded-md border border-dashed py-6 text-center text-xs"
                  style={{
                    borderColor: "var(--muted)",
                    color: "var(--muted-foreground)",
                  }}
                >
                  등록된 팀 멤버가 없습니다
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {members.map((p) => {
                    const inLineup = lineupIds.has(p.id);
                    const addKey = `add:${p.id}`;
                    const isPending = pendingId === addKey;
                    return (
                      <li
                        key={p.id}
                        className="flex items-center gap-2 rounded-md border px-2.5 py-2"
                        style={{
                          borderColor: "var(--color-fg-line-soft, var(--muted))",
                          background: inLineup
                            ? "var(--secondary)"
                            : "var(--background)",
                          opacity: inLineup ? 0.65 : 1,
                        }}
                      >
                        <span
                          className="inline-flex h-6 min-w-[28px] items-center justify-center rounded bg-black/5 px-1 text-[11px] font-bold tabular-nums"
                          aria-label={`등번호 ${p.number}`}
                        >
                          {p.number}
                        </span>
                        <span className="flex-1 truncate text-sm">{p.name}</span>
                        <span
                          className="hidden text-[10px] sm:inline"
                          style={{ color: "var(--muted-foreground)" }}
                        >
                          {p.position}
                        </span>
                        {!isReadonly && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="min-h-[36px] px-2 text-xs"
                            onClick={() =>
                              handleAdd(p.id, !startersFull && !inLineup)
                            }
                            disabled={
                              inLineup || rosterFull || pendingId !== null
                            }
                            aria-label={
                              inLineup
                                ? `${p.name} 이미 라인업`
                                : `${p.name} 라인업에 추가`
                            }
                          >
                            {isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <UserPlus className="h-3.5 w-3.5" />
                            )}
                            <span className="ml-1 hidden sm:inline">
                              {inLineup ? "추가됨" : "추가"}
                            </span>
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {!isReadonly && rosterFull && (
                <p
                  className="text-[11px]"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  정원 {MAX_REGISTERED}명에 도달했어요. 더 추가하려면 다른 선수를
                  제거하세요.
                </p>
              )}
            </section>

            {/* ===== 우: 현재 라인업 ===== */}
            <section aria-labelledby={`lineup-${teamId}`} className="space-y-3">
              <div>
                <h3
                  id={`lineup-${teamId}`}
                  className="fg-label mb-1.5 flex items-center gap-2"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  선발{" "}
                  <Badge
                    className="ml-1 bg-amber-100 text-amber-700"
                    aria-label={`선발 ${starters.length} 명 중 ${MAX_STARTERS}명`}
                  >
                    {starters.length}/{MAX_STARTERS}
                  </Badge>
                  {/* 성비(남3·여2) 배지 — 규정 제21조 */}
                  <Badge
                    className={`ml-1 ${genderOk ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}
                    aria-label={`성비 남 ${genderCount.male} 여 ${genderCount.female}`}
                  >
                    남 {genderCount.male} · 여 {genderCount.female}
                    {genderOk ? " ✓" : ""}
                  </Badge>
                </h3>
                {/* 성비 경고 — 선발 5인 구성됐는데 남3·여2 아니면 안내 (제21조). */}
                {starters.length === MAX_STARTERS && !genderOk && (
                  <p
                    role="alert"
                    className="mb-2 flex items-start gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] leading-relaxed"
                    style={{ borderColor: "rgba(255,59,48,0.35)", background: "rgba(255,59,48,0.06)", color: "var(--destructive)" }}
                  >
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>
                      성별 구성은 <b>남자 3명 · 여자 2명</b>으로 고정입니다(제21조).
                      {genderCount.unknown > 0 && " 성별 미입력 선수가 있어 정확한 검증이 어렵습니다."}
                    </span>
                  </p>
                )}
                <ul className="space-y-1.5">
                  {Array.from({ length: MAX_STARTERS }).map((_, idx) => {
                    const entry = starters[idx];
                    if (!entry) {
                      return (
                        <li
                          key={`slot-${idx}`}
                          className="flex h-[44px] items-center justify-center rounded-md border border-dashed text-[11px]"
                          style={{
                            borderColor: "var(--muted)",
                            color: "var(--muted-foreground)",
                          }}
                        >
                          빈 슬롯 #{idx + 1}
                        </li>
                      );
                    }
                    const starKey = `star:${entry.playerId}`;
                    const rmKey = `rm:${entry.playerId}`;
                    const pendingStar = pendingId === starKey;
                    const pendingRm = pendingId === rmKey;
                    return (
                      <li
                        key={entry.playerId}
                        className="flex items-center gap-2 rounded-md border px-2.5 py-2"
                        style={{
                          borderColor: "var(--accent-gold, var(--primary))",
                          background:
                            "color-mix(in srgb, var(--accent-gold, #d4a017) 8%, var(--background))",
                        }}
                      >
                        <Star
                          className="h-4 w-4 shrink-0"
                          style={{
                            color: "var(--accent-gold, var(--primary))",
                            fill: "currentColor",
                          }}
                          aria-hidden
                        />
                        {entry.jerseyNumber != null && (
                          <span className="inline-flex h-6 min-w-[28px] items-center justify-center rounded bg-black/10 px-1 text-[11px] font-bold tabular-nums">
                            {entry.jerseyNumber}
                          </span>
                        )}
                        <span className="flex-1 truncate text-sm font-medium">
                          {renderName(entry)}
                        </span>
                        {!isReadonly && (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="min-h-[36px] px-2 text-[11px]"
                              onClick={() =>
                                handleToggleStarter(entry.playerId, false)
                              }
                              disabled={pendingId !== null}
                              aria-label={`${renderName(entry)} 교체로 이동`}
                            >
                              {pendingStar ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <StarOff className="h-3.5 w-3.5" />
                              )}
                              <span className="ml-1 hidden sm:inline">교체로</span>
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-9 w-9 text-red-500 hover:bg-red-50"
                              onClick={() => handleRemove(entry.playerId)}
                              disabled={pendingId !== null}
                              aria-label={`${renderName(entry)} 라인업에서 제거`}
                            >
                              {pendingRm ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div>
                <h3
                  className="fg-label mb-1.5 flex items-center gap-2"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  교체{" "}
                  <Badge className="ml-1 bg-blue-100 text-blue-700">
                    {subs.length}
                  </Badge>
                </h3>
                {subs.length === 0 ? (
                  <p
                    className="rounded-md border border-dashed py-4 text-center text-[11px]"
                    style={{
                      borderColor: "var(--muted)",
                      color: "var(--muted-foreground)",
                    }}
                  >
                    교체 선수가 없습니다
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {subs.map((entry) => {
                      const starKey = `star:${entry.playerId}`;
                      const rmKey = `rm:${entry.playerId}`;
                      const pendingStar = pendingId === starKey;
                      const pendingRm = pendingId === rmKey;
                      return (
                        <li
                          key={entry.playerId}
                          className="flex items-center gap-2 rounded-md border px-2.5 py-2"
                          style={{
                            borderColor: "var(--color-fg-line-soft, var(--muted))",
                            background: "var(--background)",
                          }}
                        >
                          {entry.jerseyNumber != null && (
                            <span className="inline-flex h-6 min-w-[28px] items-center justify-center rounded bg-black/5 px-1 text-[11px] font-bold tabular-nums">
                              {entry.jerseyNumber}
                            </span>
                          )}
                          <span className="flex-1 truncate text-sm">
                            {renderName(entry)}
                          </span>
                          {!isReadonly && (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="min-h-[36px] px-2 text-[11px]"
                                onClick={() =>
                                  handleToggleStarter(entry.playerId, true)
                                }
                                disabled={pendingId !== null || startersFull}
                                aria-label={`${renderName(entry)} 선발로 이동`}
                                title={
                                  startersFull
                                    ? "선발 정원 초과"
                                    : "선발로 이동"
                                }
                              >
                                {pendingStar ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Star className="h-3.5 w-3.5" />
                                )}
                                <span className="ml-1 hidden sm:inline">
                                  선발로
                                </span>
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-9 w-9 text-red-500 hover:bg-red-50"
                                onClick={() => handleRemove(entry.playerId)}
                                disabled={pendingId !== null}
                                aria-label={`${renderName(entry)} 라인업에서 제거`}
                              >
                                {pendingRm ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {!isReadonly && availableMembers.length === 0 && members.length > 0 && (
                <p
                  className="text-[11px]"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  모든 멤버가 라인업에 등록되었습니다
                </p>
              )}
            </section>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
