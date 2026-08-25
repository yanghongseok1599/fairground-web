"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Users, Shield } from "lucide-react";
import { useDataStore } from "@/stores/dataStore";
import { useAuth } from "@/hooks/useAuth";
import { PlayerProfilePhoto } from "@/components/player-profile-photo";
import { getPlayerProfilePhotoUrl } from "@/lib/player-profile-photo";
import { canManageTeamMembers } from "@/lib/team-permissions";
import {
  normalizeTeamRole,
  selectableTeamRolesFor,
  TEAM_ROLE_DESCRIPTIONS,
  TEAM_ROLE_LABELS,
  TEAM_ROLE_ORDER,
} from "@/lib/team-role-policy";
import type { Player, Team, TeamRole } from "@/types";

/**
 * 팀 멤버 역할 관리.
 *
 * 권한 UX 가드:
 *  - 감독/매니저 본인 팀, 또는 admin 만 진입
 *  - coach: 감독. 선수 지도·경기 운영 총책임이며 모든 팀 역할을 지정 가능
 *  - manager: 매니저. 팀 운영관리 담당이며 manager/captain/member 지정 가능
 *  - captain: 캡틴. 경기 중 대표·보조 역할이며 멤버 권한 변경 불가
 *
 * 최종 강제: Supabase RPC(set_team_member_role) + RLS.
 *  - 본인이 본인 team_role 변경 시도 → 거부
 *  - 다른 팀 멤버 변경 시도 → 거부
 */

export default function TeamMembersPage() {
  const { id: teamId } = useParams<{ id: string }>();
  const fetchTeam = useDataStore((s) => s.fetchTeam);
  const fetchTeamMembers = useDataStore((s) => s.fetchTeamMembers);
  const updatePlayerTeamRole = useDataStore((s) => s.updatePlayerTeamRole);
  const transferTeamOwnership = useDataStore((s) => s.transferTeamOwnership);
  const { player: currentPlayer, initialized } = useAuth();

  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    const [t, list] = await Promise.all([fetchTeam(teamId), fetchTeamMembers(teamId)]);
    setTeam(t);
    setMembers(
      [...list].sort((a, b) => {
        // 감독→매니저→캡틴→멤버 순.
        const rank = (r: TeamRole | undefined) =>
          TEAM_ROLE_ORDER.indexOf(normalizeTeamRole(r));
        const ra = rank(a.teamRole);
        const rb = rank(b.teamRole);
        if (ra !== rb) return ra - rb;
        return a.name.localeCompare(b.name);
      }),
    );
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  // 권한 UX 가드 — admin 또는 본인 팀의 감독/매니저. 가드는
  // lib/team-permissions.canManageTeamMembers 한 곳에서 관리.
  const canManage = useMemo(
    () => canManageTeamMembers(currentPlayer, team),
    [currentPlayer, team],
  );

  const isAdmin = currentPlayer?.role === "admin";
  const actorForRoleOptions =
    currentPlayer && team?.captainId === currentPlayer.id && !currentPlayer.teamRole
      ? { ...currentPlayer, teamRole: "coach" as TeamRole }
      : currentPlayer;
  const selectableRoles = selectableTeamRolesFor(actorForRoleOptions);
  const canEditCoach =
    isAdmin ||
    actorForRoleOptions?.teamRole === "coach" ||
    Boolean(currentPlayer?.id && team?.captainId === currentPlayer.id);

  // 소유권 이전은 현재 소유자(captain_id) 또는 admin 만. 일반 감독·매니저는 불가.
  const isOwner = Boolean(currentPlayer?.id && team?.captainId === currentPlayer.id);
  const canTransferOwnership = isAdmin || isOwner;

  // 본인 행은 권한 변경 옵션 비활성 (트리거가 self 변경 거부).
  const handleRoleChange = async (target: Player, newRole: TeamRole | "") => {
    if (!canManage) return;
    if (!newRole) return;
    setError(null);
    setSavingId(target.id);
    try {
      const role = newRole as TeamRole;
      await updatePlayerTeamRole(target.id, role);
      setMembers((prev) => prev.map((m) => (m.id === target.id ? { ...m, teamRole: role } : m)));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "역할 변경 실패";
      setError(msg);
    } finally {
      setSavingId("");
    }
  };

  // 소유권 이전 — 현재 소유자/admin 만. 확인 후 RPC 호출, 성공 시 목록 갱신.
  const handleTransfer = async (target: Player) => {
    if (!canTransferOwnership) return;
    const ok = window.confirm(
      `'${target.name}'님에게 팀 소유권을 이전할까요?\n\n` +
        `이전 후 ${target.name}님이 팀 정보 수정·운영형태 변경 등 소유자 권한을 갖게 됩니다. ` +
        `되돌리려면 새 소유자가 다시 이전해야 합니다.`,
    );
    if (!ok) return;
    setError(null);
    setSavingId(target.id);
    try {
      await transferTeamOwnership(teamId, target.id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "소유권 이전에 실패했습니다");
    } finally {
      setSavingId("");
    }
  };

  if (!initialized) {
    return (
      <main className="min-h-screen pt-[60px] flex items-center justify-center" style={{ background: "var(--color-fg-paper-2)" }}>
        <p className="text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>
          확인 중…
        </p>
      </main>
    );
  }

  if (!canManage) {
    return (
      <div
        className="rounded-2xl px-6 py-12 text-center"
        style={{
          background: "var(--color-fg-paper)",
          border: "1px solid var(--color-fg-line-soft)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <Shield
          className="w-10 h-10 mx-auto mb-3"
          style={{ color: "var(--color-fg-ink-muted)" }}
        />
        <h1
          className="font-bold text-lg mb-1"
          style={{ color: "var(--color-fg-ink)" }}
        >
          접근 권한이 없습니다
        </h1>
        <p className="text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>
          멤버 관리는 팀의 감독·매니저 또는 관리자만 사용할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* One-line page header — the surrounding TeamAdminLayout shell
          provides the sidebar, back link, and padding. */}
      <div>
        <h1
          className="fg-display text-2xl font-black md:text-3xl"
          style={{
            color: "var(--color-fg-ink)",
            fontFamily: "var(--font-outfit)",
            letterSpacing: "-0.8px",
          }}
        >
          {team?.name ? `${team.name} · 멤버 관리` : "멤버 관리"}
        </h1>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--color-fg-ink-muted)" }}
        >
          감독은 선수 지도·경기 운영 총책임, 매니저는 팀 운영관리 담당입니다.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="px-4 py-3 rounded-md text-sm font-medium"
          style={{
            background: "rgba(255,59,48,0.08)",
            border: "1px solid rgba(255,59,48,0.20)",
            color: "var(--destructive)",
          }}
        >
          {error}
        </div>
      )}

      <section
        className="rounded-2xl"
        style={{
          background: "var(--color-fg-paper)",
          border: "1px solid var(--color-fg-line-soft)",
          boxShadow: "var(--shadow-sm)",
        }}
        aria-labelledby="members-heading"
      >
            <div
              className="px-5 py-4 flex items-center justify-between gap-3 border-b"
              style={{ borderColor: "var(--color-fg-line-soft)" }}
            >
              <h2
                id="members-heading"
                className="font-bold text-sm flex items-center gap-2"
                style={{ color: "var(--color-fg-ink)" }}
              >
                <Users className="w-4 h-4" /> 멤버 {members.length}
              </h2>
            </div>

            {loading ? (
              <div className="p-12 text-center text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>
                불러오는 중…
              </div>
            ) : members.length === 0 ? (
              <div className="p-12 text-center" style={{ color: "var(--color-fg-ink-muted)" }}>
                <div
                  className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full"
                  style={{ background: "var(--color-fg-paper-3, #EEF3FF)", color: "var(--primary)" }}
                  aria-hidden
                >
                  <Users className="h-5 w-5" />
                </div>
                <p className="text-sm font-bold" style={{ color: "var(--color-fg-ink)" }}>
                  아직 등록된 멤버가 없습니다
                </p>
                <p className="mt-1 text-xs leading-relaxed">
                  {canManage
                    ? "팀 가입 신청을 승인하거나, 선수에게 팀홈 링크를 공유해 합류시키세요."
                    : "선수가 가입 신청을 보내면 멤버 명단에 표시됩니다."}
                </p>
              </div>
            ) : (
              <ul className="divide-y" style={{ borderColor: "var(--color-fg-line-soft)" }}>
                {members.map((m) => {
                  const isSelf = currentPlayer?.id === m.id;
                  const currentTeamRole = normalizeTeamRole(m.teamRole);
                  const options = selectableRoles.includes(currentTeamRole)
                    ? selectableRoles
                    : [...selectableRoles, currentTeamRole];
                  const disableRoleChange =
                    isSelf || savingId === m.id || (currentTeamRole === "coach" && !canEditCoach);
                  return (
                    <li key={m.id} className="p-5">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-3">
                          <PlayerProfilePhoto
                            src={getPlayerProfilePhotoUrl(m)}
                            alt={m.name}
                            className="h-11 w-11 rounded-full"
                          />
                          <div>
                            <div className="font-bold text-sm" style={{ color: "var(--color-fg-ink)" }}>
                              {m.name}
                              {isSelf && (
                                <span
                                  className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded"
                                  style={{ background: "var(--color-fg-paper-3)", color: "var(--primary)" }}
                                >
                                  나
                                </span>
                              )}
                              {m.id === team?.captainId && (
                                <span
                                  className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded"
                                  style={{ background: "rgba(0,71,171,0.10)", color: "var(--primary)" }}
                                >
                                  소유자
                                </span>
                              )}
                            </div>
                            <div
                              className="text-xs mt-0.5"
                              style={{ color: "var(--color-fg-ink-muted)" }}
                            >
                              {m.position} · #{m.number || "-"} ·{" "}
                              {TEAM_ROLE_LABELS[currentTeamRole]} · {TEAM_ROLE_DESCRIPTIONS[currentTeamRole]}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <label htmlFor={`role-${m.id}`} className="sr-only">
                            {m.name}의 팀 역할
                          </label>
                          <select
                            id={`role-${m.id}`}
                            value={currentTeamRole}
                            onChange={(e) => void handleRoleChange(m, e.target.value as TeamRole | "")}
                            disabled={disableRoleChange}
                            className="min-h-[42px] px-3 text-sm font-bold rounded-md focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50"
                            style={{
                              background: "var(--color-fg-paper)",
                              color: "var(--color-fg-ink)",
                              border: "1px solid var(--color-fg-line-soft)",
                              ["--tw-ring-color" as string]: "var(--primary)",
                            }}
                          >
                            {options.map((opt) => (
                              <option key={opt} value={opt}>
                                {TEAM_ROLE_LABELS[opt]} · {TEAM_ROLE_DESCRIPTIONS[opt]}
                              </option>
                            ))}
                          </select>
                          {canTransferOwnership && m.id !== team?.captainId && (
                            <button
                              type="button"
                              onClick={() => void handleTransfer(m)}
                              disabled={savingId === m.id}
                              className="min-h-[42px] whitespace-nowrap rounded-md px-3 text-xs font-bold transition-colors disabled:opacity-50"
                              style={{
                                background: "var(--color-fg-paper)",
                                color: "var(--primary)",
                                border: "1px solid var(--color-fg-line-soft)",
                              }}
                            >
                              소유권 이전
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

      <p
        className="text-xs leading-relaxed"
        style={{ color: "var(--color-fg-ink-muted)" }}
      >
        · 본인 역할은 보안상 직접 변경할 수 없습니다. 다른 감독·매니저에게 요청하세요.
        <br />
        · 감독은 모든 역할을 지정할 수 있고, 매니저는 매니저·캡틴·멤버를 지정할 수 있습니다.
        {canTransferOwnership && (
          <>
            <br />· 소유권 이전은 현재 소유자(또는 관리자)만 가능하며, 새 소유자가 팀 정보
            수정·운영형태 변경 권한을 갖습니다.
          </>
        )}
      </p>
    </div>
  );
}
