"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Users, Shield, UserCheck } from "lucide-react";
import { useDataStore } from "@/stores/dataStore";
import { useAuth } from "@/hooks/useAuth";
import { canManageTeamMembers } from "@/lib/team-permissions";
import type { Player, Team, TeamRole } from "@/types";

/**
 * 팀 멤버 역할 관리.
 *
 * 권한 UX 가드:
 *  - manager/coach 본인 팀, 또는 admin 만 진입
 *  - coach 부여는 admin 만 (UI 옵션에서 노출 안 함)
 *  - captain 지명: coach 가 (DB 정책상) 같은 팀 member→captain 가능. UX에서는
 *    manager/coach 모두에게 member/captain/manager 옵션 노출 — 거부 시 RLS 가 강제.
 *
 * 최종 강제: profiles RLS + trg_guard_team_role 트리거.
 *  - 본인이 본인 team_role 변경 시도 → 거부
 *  - 다른 팀 멤버 변경 시도 → 거부
 */

const ROLE_LABELS: Record<TeamRole, string> = {
  member: "멤버",
  captain: "주장",
  manager: "운영자",
  coach: "감독",
};

// 일반 UX 에서 노출하는 옵션 (coach 는 admin 전용).
const SELECTABLE_ROLES: TeamRole[] = ["member", "captain", "manager"];

export default function TeamMembersPage() {
  const { id: teamId } = useParams<{ id: string }>();
  const fetchTeam = useDataStore((s) => s.fetchTeam);
  const fetchTeamMembers = useDataStore((s) => s.fetchTeamMembers);
  const updatePlayerTeamRole = useDataStore((s) => s.updatePlayerTeamRole);
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
        // 감독→매니저→주장→멤버→null 순.
        const rank = (r: TeamRole | undefined) =>
          r === "coach" ? 0 : r === "manager" ? 1 : r === "captain" ? 2 : r === "member" ? 3 : 4;
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

  // 권한 UX 가드 — admin 또는 본인 팀의 manager/coach. 가드는
  // lib/team-permissions.canManageTeamMembers 한 곳에서 관리.
  const canManage = useMemo(
    () => canManageTeamMembers(currentPlayer, team),
    [currentPlayer, team],
  );

  const isAdmin = currentPlayer?.role === "admin";

  // 본인 행은 권한 변경 옵션 비활성 (트리거가 self 변경 거부).
  const handleRoleChange = async (target: Player, newRole: TeamRole | "") => {
    if (!canManage) return;
    setError(null);
    setSavingId(target.id);
    try {
      const role: TeamRole | null = newRole === "" ? null : (newRole as TeamRole);
      await updatePlayerTeamRole(target.id, role);
      setMembers((prev) => prev.map((m) => (m.id === target.id ? { ...m, teamRole: role ?? undefined } : m)));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "역할 변경 실패";
      setError(msg);
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
          멤버 관리는 팀의 감독·운영자 또는 관리자만 사용할 수 있습니다.
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
          팀 운영자·감독은 멤버 역할을 지정할 수 있습니다. 감독 지정은 관리자만
          수행합니다.
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
                  // coach 옵션은 admin 일 때만 노출.
                  const options = isAdmin
                    ? (["member", "captain", "manager", "coach"] as TeamRole[])
                    : SELECTABLE_ROLES;
                  // 현재 역할이 coach 인데 admin 이 아니면 selectbox 비활성 (변경 권한 없음).
                  const disableRoleChange =
                    isSelf || savingId === m.id || (m.teamRole === "coach" && !isAdmin);
                  return (
                    <li key={m.id} className="p-5">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border"
                            style={{
                              background: "var(--color-fg-paper-3)",
                              borderColor: "var(--color-fg-line-soft)",
                              color: "var(--primary)",
                            }}
                          >
                            {m.profilePhotoUrl || m.photoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={m.profilePhotoUrl || m.photoUrl}
                                alt={m.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <UserCheck className="w-5 h-5" />
                            )}
                          </div>
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
                            </div>
                            <div
                              className="text-xs mt-0.5"
                              style={{ color: "var(--color-fg-ink-muted)" }}
                            >
                              {m.position} · #{m.number || "-"} ·{" "}
                              {m.teamRole ? ROLE_LABELS[m.teamRole] : "역할 미지정"}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <label htmlFor={`role-${m.id}`} className="sr-only">
                            {m.name}의 팀 역할
                          </label>
                          <select
                            id={`role-${m.id}`}
                            value={m.teamRole ?? ""}
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
                            <option value="">미지정</option>
                            {options.map((opt) => (
                              <option key={opt} value={opt}>
                                {ROLE_LABELS[opt]}
                              </option>
                            ))}
                            {/* 현재 coach 인데 admin 외에는 옵션 추가 X — 표시만. */}
                            {m.teamRole === "coach" && !isAdmin && (
                              <option value="coach">{ROLE_LABELS.coach}</option>
                            )}
                          </select>
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
        · 본인 역할은 보안상 직접 변경할 수 없습니다. 다른 운영자에게 요청하세요.
        <br />
        · 감독(coach) 부여/회수는 관리자만 수행할 수 있습니다.
      </p>
    </div>
  );
}
