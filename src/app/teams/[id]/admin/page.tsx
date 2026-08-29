"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDataStore } from "@/stores/dataStore";
import { setPlayerApproval } from "@/lib/admin-actions";
import {
  canManageTeamAsDirector,
  getDirectorRoleLabel,
  getTeamAdminMemberBuckets,
} from "@/lib/team-admin";
import { TEAM_ROLE_LABELS } from "@/lib/team-role-policy";
import type { Player, Team, TeamJoinRequest } from "@/types";

const GENDER_LABELS: Record<string, string> = {
  male: "남성",
  female: "여성",
  other: "기타",
  prefer_not_to_say: "응답 안 함",
};

function formatJoinRequestedAt(timestamp: number) {
  return new Date(timestamp).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value?: string) {
  if (!value) return "미입력";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatAge(value?: string) {
  if (!value) return "미입력";
  const birth = new Date(`${value}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return "미입력";
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const birthdayThisYear = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
  if (today < birthdayThisYear) age -= 1;
  return age >= 0 ? `만 ${age}세` : "미입력";
}

function JoinRequestInfoItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: string | number;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-2xl px-3 py-2" style={{ background: "rgba(0,71,171,0.045)" }}>
      <p className="text-[10px] font-bold tracking-[0.12em]" style={{ color: "var(--color-fg-ink-muted)" }}>
        {label}
      </p>
      <p
        className={`mt-1 truncate text-xs font-black ${mono ? "font-mono" : ""}`}
        style={{ color: "var(--color-fg-ink)" }}
        title={value === undefined || value === null || value === "" ? "미입력" : String(value)}
      >
        {value === undefined || value === null || value === "" ? "미입력" : value}
      </p>
    </div>
  );
}

function ApplicantProfileCard({
  request,
}: {
  request: TeamJoinRequest;
}) {
  const genderLabel = request.playerGender
    ? GENDER_LABELS[request.playerGender] ?? request.playerGender
    : "미입력";

  return (
    <div
      className="mt-3 rounded-2xl border p-3"
      style={{
        borderColor: "rgba(0,71,171,0.12)",
        background: "rgba(248,250,255,0.88)",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-black"
            style={{
              background: "rgba(0,71,171,0.10)",
              color: "var(--primary)",
            }}
          >
            {(request.playerName ?? "?").slice(0, 1)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-black" style={{ color: "var(--color-fg-ink)" }}>
              {request.playerName ?? "이름 미기재"}
            </p>
            <p className="mt-1 text-xs font-bold" style={{ color: "var(--color-fg-ink-muted)" }}>
              {request.playerPosition ?? "-"} · #{request.playerNumber ?? "-"}
            </p>
          </div>
        </div>
        <Link
          href={`/players/${request.playerId}`}
          className="inline-flex min-h-[34px] shrink-0 items-center justify-center rounded-md border px-3 text-xs font-black"
          style={{
            borderColor: "rgba(0,71,171,0.18)",
            color: "var(--primary)",
            background: "rgba(255,255,255,0.86)",
          }}
        >
          프로필 카드 보기
        </Link>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <JoinRequestInfoItem label="신청일" value={formatJoinRequestedAt(request.createdAt)} />
        <JoinRequestInfoItem label="전화번호" value={request.playerPhone} />
        <JoinRequestInfoItem label="이메일" value={request.playerEmail} />
        <JoinRequestInfoItem label="성별" value={genderLabel} />
        <JoinRequestInfoItem label="나이" value={formatAge(request.playerBirthDate)} />
        <JoinRequestInfoItem label="생년월일" value={formatDate(request.playerBirthDate)} />
      </div>
    </div>
  );
}

function StatCard({ label, value, desc }: { label: string; value: string | number; desc: string }) {
  return (
    <div className="rounded-3xl border p-5 shadow-sm" style={{ borderColor: "rgba(0,71,171,0.14)", background: "rgba(255,255,255,0.86)" }}>
      <div className="fg-label text-[10px]" style={{ color: "var(--primary)" }}>{label}</div>
      <div className="mt-2 fg-display text-3xl font-black" style={{ color: "var(--color-fg-ink)" }}>{value}</div>
      <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--color-fg-ink-muted)" }}>{desc}</p>
    </div>
  );
}


function MemberRow({ player, busy, onApprove, onReject, onPromote, onDemote }: {
  player: Player;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onPromote: () => void;
  onDemote: () => void;
}) {
  const isCoach = player.teamRole === "coach";
  return (
    <div className="rounded-3xl border p-4" style={{ borderColor: "rgba(0,71,171,0.12)", background: "rgba(255,255,255,0.78)" }}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-black" style={{ color: "var(--color-fg-ink)" }}>{player.name}</h3>
            <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: player.isApproved ? "rgba(0,71,171,0.10)" : "rgba(220,38,38,0.10)", color: player.isApproved ? "var(--primary)" : "var(--destructive)" }}>
              {player.isApproved ? "승인" : "대기"}
            </span>
            <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "rgba(15,23,42,0.06)", color: "var(--color-fg-ink-muted)" }}>
              {getDirectorRoleLabel(player)}
            </span>
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>{player.position} · #{player.number || "-"} · {player.phone || player.email || "연락처 미등록"}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <JoinRequestInfoItem label="신청일" value={formatJoinRequestedAt(player.createdAt)} />
            <JoinRequestInfoItem label="이메일" value={player.email} />
            <JoinRequestInfoItem label="전화번호" value={player.phone} />
            <JoinRequestInfoItem label="선수 정보" value={`${player.position} · #${player.number || "-"}`} />
            <JoinRequestInfoItem
              label="성별 / 나이"
              value={`${player.gender ? GENDER_LABELS[player.gender] ?? player.gender : "미입력"} · ${formatAge(player.birthDate)}`}
            />
            <JoinRequestInfoItem label="생년월일" value={formatDate(player.birthDate)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {player.isApproved ? (
            <button disabled={busy} onClick={onReject} className="inline-flex min-h-[38px] items-center gap-2 rounded-2xl border px-3 text-xs font-black disabled:opacity-50" style={{ borderColor: "rgba(220,38,38,0.20)", color: "var(--destructive)", background: "rgba(255,255,255,0.86)" }}>
              <XCircle className="h-4 w-4" /> 승인 취소
            </button>
          ) : (
            <button disabled={busy} onClick={onApprove} className="inline-flex min-h-[38px] items-center gap-2 rounded-2xl px-3 text-xs font-black disabled:opacity-50" style={{ background: "var(--primary)", color: "#fff" }}>
              <CheckCircle2 className="h-4 w-4" /> 승인
            </button>
          )}
          <button disabled={busy} onClick={isCoach ? onDemote : onPromote} className="inline-flex min-h-[38px] items-center gap-2 rounded-2xl border px-3 text-xs font-black disabled:opacity-50" style={{ borderColor: "rgba(0,71,171,0.18)", color: "var(--primary)", background: "rgba(255,255,255,0.86)" }}>
            <ShieldCheck className="h-4 w-4" /> {isCoach ? "멤버로 변경" : "감독 지정"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TeamAdminPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { player: currentPlayer, initialized } = useAuth();
  const store = useDataStore();
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [joinRequests, setJoinRequests] = useState<TeamJoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyPlayerId, setBusyPlayerId] = useState<string | null>(null);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const refresh = async () => {
    const [resolvedTeam, resolvedPlayers, resolvedRequests] = await Promise.all([
      store.fetchTeam(id),
      store.fetchTeamAdminMembers(id),
      store.fetchTeamJoinRequests(id, "pending"),
    ]);
    setTeam(resolvedTeam ?? null);
    setPlayers(resolvedPlayers);
    setJoinRequests(resolvedRequests);
  };

  useEffect(() => {
    if (!initialized) return;
    if (!currentPlayer) {
      setLoading(false);
      return;
    }

    setLoading(true);
    void refresh().finally(() => setLoading(false));
    // Re-fetch after auth hydration. team_join_requests is protected by RLS,
    // so an early anonymous fetch can legitimately return an empty list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, initialized, currentPlayer?.id]);

  const canManage = useMemo(() => canManageTeamAsDirector(currentPlayer, team), [currentPlayer, team]);
  const buckets = useMemo(() => getTeamAdminMemberBuckets(players), [players]);
  const coaches = players.filter((member) => member.teamRole === "coach");
  const managers = players.filter((member) => member.teamRole === "manager");
  const totalPendingApprovals = joinRequests.length + buckets.pending.length;

  useEffect(() => {
    if (!loading && initialized && team && !canManage) {
      router.replace(`/teams/${id}`);
    }
  }, [canManage, id, initialized, loading, router, team]);

  const runMemberAction = async (target: Player, action: () => Promise<void>, successMessage: string) => {
    setBusyPlayerId(target.id);
    setMessage("");
    try {
      await action();
      await refresh();
      setMessage(successMessage);
    } catch (error) {
      console.error("[TeamAdminPage] member action failed:", error);
      setMessage(error instanceof Error ? error.message : "처리 중 오류가 발생했습니다.");
    } finally {
      setBusyPlayerId(null);
    }
  };

  if (loading || !initialized) {
    return (
      <main className="flex min-h-screen items-center justify-center pt-[92px]" style={{ background: "var(--color-fg-paper)" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
      </main>
    );
  }

  if (!team) {
    return (
      <main className="flex min-h-screen items-center justify-center pt-[92px]" style={{ background: "var(--color-fg-paper)", color: "var(--color-fg-ink-muted)" }}>
        팀을 찾을 수 없습니다
      </main>
    );
  }

  if (!canManage) {
    return (
      <main className="flex min-h-screen items-center justify-center pt-[92px]" style={{ background: "var(--color-fg-paper)", color: "var(--color-fg-ink-muted)" }}>
        팀 운영 권한이 없습니다. 팀 페이지로 이동합니다…
      </main>
    );
  }

  return (
    <div className="space-y-6">
      {/* Compact page header — the surrounding TeamAdminLayout shell already
          provides the sidebar, back link, and padding, so we only need a
          one-line title + permission chip here. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1
          className="fg-display text-2xl font-black md:text-3xl"
          style={{
            color: "var(--color-fg-ink)",
            fontFamily: "var(--font-outfit)",
            letterSpacing: "-0.8px",
          }}
        >
          {team.name} · 팀 개요
        </h1>
        <div
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black"
          style={{
            background: canManage
              ? "rgba(0,71,171,0.10)"
              : "rgba(220,38,38,0.10)",
            color: canManage ? "var(--primary)" : "var(--destructive)",
          }}
        >
          {canManage ? (
            <ShieldCheck className="h-3.5 w-3.5" />
          ) : (
            <ShieldAlert className="h-3.5 w-3.5" />
          )}
          {canManage ? "관리 권한 확인됨" : "감독/매니저 권한 필요"}
        </div>
      </div>

      {!canManage && (
          <section className="mb-6 rounded-3xl border p-5" style={{ borderColor: "rgba(220,38,38,0.16)", background: "rgba(255,255,255,0.86)", color: "var(--color-fg-ink-muted)" }}>
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5" style={{ color: "var(--destructive)" }} />
              <div>
                <h2 className="font-black" style={{ color: "var(--color-fg-ink)" }}>읽기 전용 안내</h2>
                <p className="mt-1 text-sm leading-relaxed">현재 계정이 이 팀의 감독·매니저 또는 리그 관리자로 확인되지 않았습니다. 관리 액션은 비활성화됩니다.</p>
              </div>
            </div>
          </section>
        )}

        {message && (
          <div className="mb-6 rounded-2xl border px-4 py-3 text-sm font-bold" style={{ borderColor: "rgba(0,71,171,0.14)", background: "rgba(255,255,255,0.88)", color: "var(--primary)" }}>
            {message}
          </div>
        )}

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="승인 선수" value={buckets.approved.length} desc="현재 팀 로스터에 노출되는 선수입니다." />
          <StatCard label="승인 대기" value={totalPendingApprovals} desc="가입 신청과 로스터 미승인을 합친 대기 건수입니다." />
          <StatCard label="감독/매니저" value={coaches.length + managers.length || "-"} desc="감독은 선수 지도·경기 운영 총책임, 매니저는 팀 운영관리 담당입니다." />
          <StatCard label="팀 상태" value={team.isApproved ? "승인" : "대기"} desc="리그 공식 팀 승인 상태입니다." />
        </div>

        {/* Pending-approvals only. Full roster + role editing now lives on
            the sidebar's "멤버 관리" page (/members) — no need to mirror it
            here on the overview. */}

        {/* 가입 신청 큐 — pending team_join_requests. 직접 처리하면 트리거가
            profiles.team_id를 자동 세팅한다(20260526 마이그레이션). */}
        {joinRequests.length > 0 && (
          <section
            className="rounded-3xl border p-5 shadow-sm"
            style={{
              borderColor: "rgba(0,71,171,0.14)",
              background: "rgba(255,255,255,0.86)",
            }}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" style={{ color: "var(--primary)" }} />
                <h2 className="fg-display text-2xl font-black" style={{ color: "var(--color-fg-ink)" }}>
                  가입 신청
                </h2>
              </div>
              <span
                className="rounded-full px-3 py-1 text-xs font-black"
                style={{ background: "rgba(0,71,171,0.10)", color: "var(--primary)" }}
              >
                {joinRequests.length}건
              </span>
            </div>
            <ul className="space-y-3">
              {joinRequests.map((req) => (
                <li
                  key={req.id}
                  className="flex flex-col gap-4 rounded-2xl border p-4 lg:flex-row lg:items-start lg:justify-between"
                  style={{ borderColor: "rgba(0,71,171,0.12)" }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-black" style={{ color: "var(--color-fg-ink)" }}>
                        {req.playerName ?? "이름 미기재"}
                      </p>
                      <span
                        className="rounded-full px-2.5 py-1 text-[11px] font-black"
                        style={{ background: "rgba(0,71,171,0.10)", color: "var(--primary)" }}
                      >
                        신청자
                      </span>
                    </div>
                    <ApplicantProfileCard request={req} />
                    {req.message && (
                      <p className="mt-3 rounded-2xl px-3 py-2 text-xs leading-relaxed" style={{ background: "rgba(15,23,42,0.045)", color: "var(--color-fg-ink-muted)" }}>
                        신청 메시지: &quot;{req.message}&quot;
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={busyRequestId === req.id || !canManage}
                      onClick={async () => {
                        setBusyRequestId(req.id);
                        setMessage("");
                        try {
                          await store.setTeamJoinRequestStatus(req.id, "approved");
                          await refresh();
                          setMessage(`${req.playerName ?? "신청자"}의 가입을 승인했습니다.`);
                        } catch (err) {
                          setMessage(err instanceof Error ? err.message : "승인 실패");
                        } finally {
                          setBusyRequestId(null);
                        }
                      }}
                      className="inline-flex min-h-[36px] items-center gap-1 rounded-md px-3 text-xs font-black disabled:opacity-50"
                      style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
                    >
                      <CheckCircle2 className="h-4 w-4" /> 승인
                    </button>
                    <button
                      type="button"
                      disabled={busyRequestId === req.id || !canManage}
                      onClick={async () => {
                        setBusyRequestId(req.id);
                        setMessage("");
                        try {
                          await store.setTeamJoinRequestStatus(req.id, "rejected");
                          await refresh();
                          setMessage(`${req.playerName ?? "신청자"}의 가입을 거부했습니다.`);
                        } catch (err) {
                          setMessage(err instanceof Error ? err.message : "거부 실패");
                        } finally {
                          setBusyRequestId(null);
                        }
                      }}
                      className="inline-flex min-h-[36px] items-center gap-1 rounded-md border px-3 text-xs font-black disabled:opacity-50"
                      style={{
                        borderColor: "rgba(220,38,38,0.30)",
                        color: "var(--destructive)",
                        background: "rgba(255,255,255,0.86)",
                      }}
                    >
                      <XCircle className="h-4 w-4" /> 거부
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section
          className="rounded-3xl border p-5 shadow-sm"
          style={{
            borderColor: "rgba(0,71,171,0.14)",
            background: "rgba(255,255,255,0.86)",
          }}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <UserCheck
                className="h-5 w-5"
                style={{ color: "var(--primary)" }}
              />
              <h2
                className="fg-display text-2xl font-black"
                style={{ color: "var(--color-fg-ink)" }}
              >
                로스터 승인 대기
              </h2>
            </div>
            <span
              className="rounded-full px-3 py-1 text-xs font-black"
              style={{
                background: "rgba(0,71,171,0.10)",
                color: "var(--primary)",
              }}
            >
              {buckets.pending.length}명
            </span>
          </div>
          <div className="space-y-3">
            {buckets.pending.map((member) => (
              <MemberRow
                key={member.id}
                player={member}
                busy={busyPlayerId === member.id || !canManage}
                onApprove={() =>
                  canManage &&
                  void runMemberAction(
                    member,
                    () => setPlayerApproval(member.id, true),
                    `${member.name} 선수를 승인했습니다.`,
                  )
                }
                onReject={() =>
                  canManage &&
                  void runMemberAction(
                    member,
                    () => setPlayerApproval(member.id, false),
                    `${member.name} 선수 승인을 취소했습니다.`,
                  )
                }
                onPromote={() =>
                  canManage &&
                  void runMemberAction(
                    member,
                    () => store.updatePlayerTeamRole(member.id, "coach"),
                    `${member.name} 선수를 ${TEAM_ROLE_LABELS.coach}로 지정했습니다.`,
                  )
                }
                onDemote={() =>
                  canManage &&
                  void runMemberAction(
                    member,
                    () => store.updatePlayerTeamRole(member.id, "member"),
                    `${member.name} 선수를 ${TEAM_ROLE_LABELS.member}로 변경했습니다.`,
                  )
                }
              />
            ))}
            {buckets.pending.length === 0 && (
              <p
                className="py-10 text-center text-sm"
                style={{ color: "var(--color-fg-ink-muted)" }}
              >
                로스터 승인 대기 선수가 없습니다.
              </p>
            )}
          </div>
        </section>

    </div>
  );
}
