"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Users, XCircle, ArrowUpCircle, ArrowDownCircle, Trash2 } from "lucide-react";
import { AdminGuard } from "@/components/admin-guard";
import { AdminPanel, AdminShell, AdminStatusPill } from "@/components/admin-shell";
import { ClubEmblem } from "@/components/club-emblem";
import { useDataStore } from "@/stores/dataStore";
import type { Team } from "@/types";
import { deleteTeam, setTeamApproval } from "@/lib/admin-actions";
import { LEAGUE_TIER_LABEL, nextLeagueTier } from "@/lib/team-home";
import type { LeagueTier } from "@/types";

// 강등 시 한 단계 아래 라벨 (bronze 는 더 내려갈 곳 없음).
function nextLowerTierLabel(t: LeagueTier): string {
  const order: LeagueTier[] = ["bronze", "silver", "gold", "premium"];
  const i = order.indexOf(t);
  return i > 0 ? LEAGUE_TIER_LABEL[order[i - 1]] : LEAGUE_TIER_LABEL.bronze;
}

export default function AdminTeamsPage() {
  return <AdminGuard allow={["admin"]}><AdminTeams /></AdminGuard>;
}

function AdminTeams() {
  const store = useDataStore();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");

  useEffect(() => {
    void store.fetchTeams().then((list) => {
      setTeams([...list].sort((a, b) => Number(a.isApproved) - Number(b.isApproved) || b.createdAt - a.createdAt));
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateApproval = async (team: Team, approved: boolean) => {
    setSavingId(team.id);
    await setTeamApproval(team.id, approved);
    setTeams((prev) => prev.map((item) => item.id === team.id ? { ...item, isApproved: approved } : item));
    setSavingId("");
  };

  const applyFresh = (id: string, fresh: Team) =>
    setTeams((prev) => prev.map((it) => (it.id === id ? fresh : it)));

  // 대회 참가 기록 — 연속 streak +1 (최대 4). 연속참가 보상은 승점이 아니라
  // 대진 편성 시 "휴식 시드 우선권"(연속 높을수록 휴식 많은 시드 우선 배정).
  const recordParticipation = async (team: Team) => {
    setSavingId(team.id);
    try {
      await store.recordParticipation(team.id);
      const fresh = await store.fetchTeam(team.id);
      if (fresh) {
        applyFresh(team.id, fresh);
        alert(`${fresh.name} 참가 기록됨\n연속 ${fresh.participationStreak}회 · 다음 대진에서 휴식 시드 우선권`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "기록 실패");
    } finally {
      setSavingId("");
    }
  };

  // 연속 끊김(불참) — streak 0.
  const breakStreak = async (team: Team) => {
    if (!confirm(`${team.name}의 연속 참여 기록을 초기화할까요? (불참 처리)`)) return;
    setSavingId(team.id);
    try {
      await store.resetParticipationStreak(team.id);
      const fresh = await store.fetchTeam(team.id);
      if (fresh) applyFresh(team.id, fresh);
    } catch (err) {
      alert(err instanceof Error ? err.message : "초기화 실패");
    } finally {
      setSavingId("");
    }
  };

  // 승급 — 시즌 상위 2팀 정산. 한 단계 위 + streak 0.
  const promote = async (team: Team) => {
    const next = nextLeagueTier(team.leagueTier);
    if (!next) { alert(`${team.name}은(는) 이미 최상위 플래티넘 리그입니다.`); return; }
    if (!confirm(`${team.name}을(를) ${LEAGUE_TIER_LABEL[team.leagueTier]} → ${LEAGUE_TIER_LABEL[next]}로 승급할까요?\n(연속 참여 기록은 초기화됩니다)`)) return;
    setSavingId(team.id);
    try {
      await store.promoteTeam(team.id);
      const fresh = await store.fetchTeam(team.id);
      if (fresh) {
        applyFresh(team.id, fresh);
        alert(`🎉 ${fresh.name} 승급!\n현재 리그: ${LEAGUE_TIER_LABEL[fresh.leagueTier]}`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "승급 실패");
    } finally {
      setSavingId("");
    }
  };

  const relegate = async (team: Team) => {
    const prev = nextLowerTierLabel(team.leagueTier);
    if (!confirm(`${team.name}을(를) ${LEAGUE_TIER_LABEL[team.leagueTier]} → ${prev}로 강등할까요?`)) return;
    setSavingId(team.id);
    try {
      await store.relegateTeam(team.id);
      const fresh = await store.fetchTeam(team.id);
      if (fresh) {
        applyFresh(team.id, fresh);
        alert(`${fresh.name} 강등 완료\n현재 리그: ${LEAGUE_TIER_LABEL[fresh.leagueTier]}`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "강등 실패");
    } finally {
      setSavingId("");
    }
  };

  // 팀 삭제 — 잘못 만든 팀 정리. 경기 기록이 있는 팀은 deleteTeam 이 거부한다(그 경우는 승인 취소).
  const removeTeam = async (team: Team) => {
    if (!confirm(
      `"${team.name}" 팀을 삭제합니다.\n\n· 소속 멤버는 모두 무소속으로 바뀝니다\n· 팀 게시글·공지·갤러리·회비 기록도 함께 삭제됩니다\n· 되돌릴 수 없습니다\n\n계속할까요?`
    )) return;
    setSavingId(team.id);
    try {
      await deleteTeam(team.id);
      setTeams((prev) => prev.filter((it) => it.id !== team.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "삭제 실패");
    } finally {
      setSavingId("");
    }
  };

  return (
    <AdminShell
      eyebrow="TEAM REVIEW"
      title="팀 관리"
      description="팀 등록 요청을 검수하고 공식 팀 홈 노출 여부를 관리합니다. 팀 카드, 로고, 시즌 스탯을 한눈에 확인합니다."
    >
      {loading ? <div style={{ color: "var(--color-fg-ink-muted)" }}>로딩 중...</div> : (
        <div className="grid gap-4 md:grid-cols-2">
          {teams.map((team) => (
            <AdminPanel key={team.id} className="p-5 transition-transform hover:-translate-y-1">
              <div className="flex items-start gap-5">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden border p-3" style={{ background: "var(--color-fg-paper-3)", borderColor: "rgba(0,71,171,0.18)", color: "var(--primary)" }}>
                  <ClubEmblem name={team.name} logoSrc={team.logo} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h2 className="fg-display text-2xl font-black" style={{ color: "var(--color-fg-ink)" }}>{team.name}</h2>
                    <AdminStatusPill tone={team.isApproved ? "blue" : "red"}>{team.isApproved ? "공식 팀" : "승인 대기"}</AdminStatusPill>
                  </div>
                  <p className="text-xs" style={{ color: "var(--color-fg-ink-muted)" }}><Users className="mr-1 inline h-3.5 w-3.5" /> {team.memberCount}명 · 승점 {team.seasonStats.points} · {team.foundedYear ? `${team.foundedYear}년 창단` : "창단연도 미입력"}</p>
                  {/* 리그 등급 + 연속 참여 streak (보상: 휴식 시드 우선권) */}
                  <p className="mt-1 text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>
                    {LEAGUE_TIER_LABEL[team.leagueTier]} · 연속 {team.participationStreak}회
                    {team.participationStreak >= 2 && " · 휴식 시드 우선권"}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link href={`/teams/${team.id}`} className="border px-3 py-2 text-xs font-bold" style={{ borderColor: "rgba(0,71,171,0.18)", background: "#fff", color: "var(--primary)" }}>팀 홈 보기</Link>
                    {team.isApproved ? (
                      <button onClick={() => void updateApproval(team, false)} disabled={savingId === team.id} className="inline-flex items-center gap-2 border px-3 py-2 text-xs font-bold" style={{ borderColor: "rgba(255,59,48,0.20)", background: "rgba(255,59,48,0.08)", color: "var(--destructive)" }}><XCircle className="h-4 w-4" /> 승인 취소</button>
                    ) : (
                      <button onClick={() => void updateApproval(team, true)} disabled={savingId === team.id} className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold" style={{ background: "var(--primary)", color: "#fff" }}><CheckCircle2 className="h-4 w-4" /> 승인</button>
                    )}
                    {/* 시즌 정산: 참가 기록(streak+1) / 연속 끊김 / 승급(상위2) / 강등(하위2) */}
                    <button onClick={() => void recordParticipation(team)} disabled={savingId === team.id} className="inline-flex items-center gap-1.5 border px-3 py-2 text-xs font-bold" style={{ borderColor: "rgba(0,71,171,0.20)", background: "rgba(0,71,171,0.06)", color: "var(--primary)" }} title="대회 참가 기록 — 연속 streak +1, 휴식 시드 우선권"><CheckCircle2 className="h-4 w-4" /> 참가 기록</button>
                    {team.participationStreak > 0 && (
                      <button onClick={() => void breakStreak(team)} disabled={savingId === team.id} className="inline-flex items-center gap-1.5 border px-3 py-2 text-xs font-bold" style={{ borderColor: "var(--color-fg-line-soft)", background: "var(--color-fg-paper)", color: "var(--color-fg-ink-muted)" }} title="연속 참여 초기화(불참)"><XCircle className="h-4 w-4" /> 연속 끊김</button>
                    )}
                    {nextLeagueTier(team.leagueTier) && (
                      <button onClick={() => void promote(team)} disabled={savingId === team.id} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold" style={{ background: "var(--primary)", color: "#fff" }} title="시즌 상위 2팀 승급 — 한 단계 위"><ArrowUpCircle className="h-4 w-4" /> 승급</button>
                    )}
                    {team.leagueTier !== "bronze" && (
                      <button onClick={() => void relegate(team)} disabled={savingId === team.id} className="inline-flex items-center gap-1.5 border px-3 py-2 text-xs font-bold" style={{ borderColor: "rgba(255,59,48,0.20)", background: "rgba(255,59,48,0.08)", color: "var(--destructive)" }} title="시즌 하위 2팀 강등 — 한 단계 아래"><ArrowDownCircle className="h-4 w-4" /> 강등</button>
                    )}
                    <button onClick={() => void removeTeam(team)} disabled={savingId === team.id} className="inline-flex items-center gap-1.5 border px-3 py-2 text-xs font-bold" style={{ borderColor: "rgba(255,59,48,0.35)", background: "var(--destructive)", color: "#fff" }} title="팀 삭제 — 경기 기록이 있는 팀은 삭제할 수 없습니다"><Trash2 className="h-4 w-4" /> 삭제</button>
                  </div>
                </div>
              </div>
            </AdminPanel>
          ))}
          {teams.length === 0 && <div className="py-16 text-center" style={{ color: "var(--color-fg-ink-muted)" }}>등록된 팀이 없습니다</div>}
        </div>
      )}
    </AdminShell>
  );
}
