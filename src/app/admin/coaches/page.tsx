"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ShieldCheck, UserCheck } from "lucide-react";
import { AdminGuard } from "@/components/admin-guard";
import { AdminPanel, AdminShell, AdminStatusPill } from "@/components/admin-shell";
import { PlayerProfilePhoto } from "@/components/player-profile-photo";
import { useDataStore } from "@/stores/dataStore";
import type { Player, Team } from "@/types";
import { getPlayerProfilePhotoUrl } from "@/lib/player-profile-photo";

/**
 * 감독 신청 대기 큐 — admin 전용.
 *
 * 흐름:
 *  - 회원가입 시 "감독으로 가입" 토글 + 팀 선택 → profiles.team_role='coach', is_approved=false
 *  - 본 페이지에서 운영자가 검토 후 "승인" → is_approved=true
 *  - 거절은 후속(이번 범위 외), 필요 시 selectbox 로 team_role=null 또는 player 강등 가능
 *
 * 권한:
 *  - 페이지 진입: AdminGuard(allow=['admin'])
 *  - 최종 강제: RLS — anon/일반 회원은 fetchPendingCoachApplications 가 빈 배열 또는 차단
 */
export default function AdminCoachesPage() {
  return (
    <AdminGuard allow={["admin"]}>
      <AdminCoaches />
    </AdminGuard>
  );
}

function AdminCoaches() {
  const fetchPendingCoachApplications = useDataStore((s) => s.fetchPendingCoachApplications);
  const fetchTeams = useDataStore((s) => s.fetchTeams);
  const approveCoach = useDataStore((s) => s.approveCoach);

  const [applicants, setApplicants] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pending, teamsList] = await Promise.all([
        fetchPendingCoachApplications(),
        fetchTeams(),
      ]);
      const record: Record<string, Team> = {};
      for (const t of teamsList) record[t.id] = t;
      setTeams(record);
      setApplicants(pending.sort((a, b) => b.createdAt - a.createdAt));
    } catch (err) {
      setError(err instanceof Error ? err.message : "목록을 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void reload();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApprove = async (player: Player) => {
    if (!confirm(`${player.name} 님을 감독으로 승인하시겠습니까?`)) return;
    setSavingId(player.id);
    try {
      await approveCoach(player.id);
      setApplicants((prev) => prev.filter((p) => p.id !== player.id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "승인 실패";
      alert(msg);
    } finally {
      setSavingId("");
    }
  };

  return (
    <AdminShell
      eyebrow="COACH APPROVAL"
      title="감독 승인"
      description="감독으로 가입 신청한 사용자를 검토하고 승인합니다. 승인 시 해당 팀의 선수 지도·경기 운영 권한이 활성화됩니다."
    >
      <AdminPanel>
        <div
          className="border-b px-5 py-4 flex items-center justify-between gap-3"
          style={{ borderColor: "rgba(0,71,171,0.14)" }}
        >
          <div className="fg-label" style={{ color: "var(--primary)" }}>
            PENDING COACHES · {applicants.length}
          </div>
          <ShieldCheck className="h-5 w-5" style={{ color: "var(--primary)" }} />
        </div>

        {loading ? (
          <div className="p-12 text-center" style={{ color: "var(--color-fg-ink-muted)" }}>
            로딩 중...
          </div>
        ) : error ? (
          <div className="p-12 text-center" style={{ color: "var(--destructive)" }}>
            {error}
          </div>
        ) : applicants.length === 0 ? (
          <div className="p-16 text-center" style={{ color: "var(--color-fg-ink-muted)" }}>
            대기 중인 감독 신청이 없습니다
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "rgba(0,71,171,0.10)" }}>
            {applicants.map((player) => {
              const team = player.teamId ? teams[player.teamId] : undefined;
              return (
                <article key={player.id} className="p-5 transition-colors hover:bg-[#F5F7FF]">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                      <PlayerProfilePhoto
                        src={getPlayerProfilePhotoUrl(player)}
                        alt={player.name}
                        icon={UserCheck}
                      />
                      <div>
                        <div
                          className="fg-display text-xl font-black"
                          style={{ color: "var(--color-fg-ink)" }}
                        >
                          {player.name}
                        </div>
                        <div
                          className="mt-1 text-xs"
                          style={{ color: "var(--color-fg-ink-muted)" }}
                        >
                          {player.email || player.phone || "연락처 미등록"} ·{" "}
                          신청 팀: {team ? team.name : player.teamId || "(미선택)"}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <AdminStatusPill tone="red">승인 대기</AdminStatusPill>
                      <button
                        type="button"
                        onClick={() => void handleApprove(player)}
                        disabled={savingId === player.id}
                        className="inline-flex min-h-[42px] items-center gap-2 px-4 text-sm font-bold transition-opacity disabled:opacity-60"
                        style={{ background: "var(--primary)", color: "#fff" }}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {savingId === player.id ? "처리 중…" : "승인"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </AdminPanel>
    </AdminShell>
  );
}
