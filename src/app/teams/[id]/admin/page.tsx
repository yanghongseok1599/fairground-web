"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDataStore } from "@/stores/dataStore";
import { setPlayerApproval, setPlayerRole } from "@/lib/admin-actions";
import {
  canManageTeamAsDirector,
  getDirectorRoleLabel,
  getTeamAdminMemberBuckets,
} from "@/lib/team-admin";
import type { Player, Team, TeamJoinRequest } from "@/types";

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
  const isCaptain = player.role === "captain";
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
              {getDirectorRoleLabel(player.role)}
            </span>
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>{player.position} · #{player.number || "-"} · {player.phone || player.email || "연락처 미등록"}</p>
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
          <button disabled={busy} onClick={isCaptain ? onDemote : onPromote} className="inline-flex min-h-[38px] items-center gap-2 rounded-2xl border px-3 text-xs font-black disabled:opacity-50" style={{ borderColor: "rgba(0,71,171,0.18)", color: "var(--primary)", background: "rgba(255,255,255,0.86)" }}>
            <ShieldCheck className="h-4 w-4" /> {isCaptain ? "선수로 변경" : "감독 지정"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TeamAdminPage() {
  const { id } = useParams<{ id: string }>();
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
      store.fetchTeamPlayers(id),
      store.fetchTeamJoinRequests(id, "pending"),
    ]);
    setTeam(resolvedTeam ?? null);
    setPlayers(resolvedPlayers);
    setJoinRequests(resolvedRequests);
  };

  useEffect(() => {
    setLoading(true);
    void refresh().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const canManage = useMemo(() => canManageTeamAsDirector(currentPlayer, team), [currentPlayer, team]);
  const buckets = useMemo(() => getTeamAdminMemberBuckets(players), [players]);
  const captains = players.filter((member) => member.role === "captain");

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
          {canManage ? "관리 권한 확인됨" : "감독/관리자 권한 필요"}
        </div>
      </div>

      {!canManage && (
          <section className="mb-6 rounded-3xl border p-5" style={{ borderColor: "rgba(220,38,38,0.16)", background: "rgba(255,255,255,0.86)", color: "var(--color-fg-ink-muted)" }}>
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5" style={{ color: "var(--destructive)" }} />
              <div>
                <h2 className="font-black" style={{ color: "var(--color-fg-ink)" }}>읽기 전용 안내</h2>
                <p className="mt-1 text-sm leading-relaxed">현재 계정이 이 팀의 감독/주장 또는 리그 관리자로 확인되지 않았습니다. 관리 액션은 비활성화됩니다.</p>
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
          <StatCard label="승인 대기" value={buckets.pending.length} desc="감독 확인 후 바로 승인할 수 있습니다." />
          <StatCard label="감독/주장" value={captains.length || "-"} desc="팀 운영 권한을 가진 팀 내부 관리자입니다." />
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
                  className="flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between"
                  style={{ borderColor: "rgba(0,71,171,0.12)" }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold" style={{ color: "var(--color-fg-ink)" }}>
                      {req.playerName ?? "이름 미기재"}
                    </p>
                    <p className="mt-0.5 text-[11px]" style={{ color: "var(--color-fg-ink-muted)" }}>
                      {new Date(req.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })} 신청
                      {req.message ? ` · "${req.message}"` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
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
                승인 대기
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
                    () => setPlayerRole(member.id, "captain"),
                    `${member.name} 선수를 감독으로 지정했습니다.`,
                  )
                }
                onDemote={() =>
                  canManage &&
                  void runMemberAction(
                    member,
                    () => setPlayerRole(member.id, "player"),
                    `${member.name} 선수를 일반 선수로 변경했습니다.`,
                  )
                }
              />
            ))}
            {buckets.pending.length === 0 && (
              <p
                className="py-10 text-center text-sm"
                style={{ color: "var(--color-fg-ink-muted)" }}
              >
                승인 대기 선수가 없습니다.
              </p>
            )}
          </div>
        </section>

    </div>
  );
}
