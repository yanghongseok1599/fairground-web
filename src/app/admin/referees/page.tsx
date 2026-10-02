"use client";

import { useState } from "react";
import { CheckCircle2, Phone, ShieldCheck, UserRound, UserX, XCircle } from "lucide-react";
import { AdminGuard } from "@/components/admin-guard";
import { AdminPanel, AdminShell, AdminStatusPill } from "@/components/admin-shell";
import { ApprovalPlayerPhoto } from "@/features/admin-players/approval-player-photo";
import { fetchRefereeSummaries, type RefereeSummary } from "@/features/admin-directory/api";
import { useAdminResource } from "@/features/admin-directory/use-admin-resource";
import { AdminLoadError } from "@/features/admin-directory/load-error";
import { setPlayerApproval, setPlayerRole } from "@/lib/admin-actions";
import { getRefereeStatusLabel } from "@/lib/admin-referees";

export default function AdminRefereesPage() {
  return <AdminGuard allow={["admin"]}><AdminReferees /></AdminGuard>;
}

function AdminReferees() {
  const { data: referees, setData: setReferees, loading, error, reload } = useAdminResource(fetchRefereeSummaries, []);
  const [savingId, setSavingId] = useState("");
  const [saveError, setSaveError] = useState("");

  const updateApproval = async (referee: RefereeSummary, approved: boolean) => {
    setSavingId(referee.id);
    setSaveError("");
    try {
      await setPlayerApproval(referee.id, approved);
      setReferees((prev) => prev.map((item) => item.id === referee.id ? { ...item, isApproved: approved } : item));
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "심판 정보를 저장하지 못했습니다.");
      await reload();
    } finally { setSavingId(""); }
  };

  const convertToPlayer = async (referee: RefereeSummary) => {
    setSavingId(referee.id);
    setSaveError("");
    try {
      await setPlayerRole(referee.id, "player");
      await setPlayerApproval(referee.id, false);
      setReferees((prev) => prev.filter((item) => item.id !== referee.id));
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "심판 정보를 저장하지 못했습니다.");
      await reload();
    } finally { setSavingId(""); }
  };

  return (
    <AdminShell
      eyebrow="REFEREE CONTROL"
      title="심판 관리"
      description="심판 신청자를 따로 확인하고, 승인/권한 회수/연락처 확인까지 운영자가 한 화면에서 처리합니다."
    >
      {saveError && <p role="alert" className="mb-4 text-sm text-destructive">{saveError}</p>}
      <div className="grid gap-4 md:grid-cols-3">
        <AdminPanel className="p-5">
          <div className="fg-label" style={{ color: "var(--primary)" }}>TOTAL REFEREES</div>
          <div className="mt-3 fg-display text-4xl font-black" style={{ color: "var(--color-fg-ink)" }}>{loading || error ? "—" : referees.length}</div>
        </AdminPanel>
        <AdminPanel className="p-5">
          <div className="fg-label" style={{ color: "var(--primary)" }}>PENDING</div>
          <div className="mt-3 fg-display text-4xl font-black" style={{ color: "var(--destructive)" }}>{loading || error ? "—" : referees.filter((referee) => !referee.isApproved).length}</div>
        </AdminPanel>
        <AdminPanel className="p-5">
          <div className="fg-label" style={{ color: "var(--primary)" }}>ACTIVE</div>
          <div className="mt-3 fg-display text-4xl font-black" style={{ color: "var(--primary)" }}>{loading || error ? "—" : referees.filter((referee) => referee.isApproved).length}</div>
        </AdminPanel>
      </div>

      <AdminPanel className="mt-6">
        <div className="border-b px-5 py-4" style={{ borderColor: "rgba(0,71,171,0.14)" }}>
          <div className="flex items-center gap-2 fg-label" style={{ color: "var(--primary)" }}>
            <ShieldCheck className="h-4 w-4" /> REFEREE ROSTER · {loading || error ? "—" : referees.length}
          </div>
        </div>
        {loading ? (
          <div className="p-12 text-center" style={{ color: "var(--color-fg-ink-muted)" }}>로딩 중...</div>
        ) : error ? <AdminLoadError error={error} onRetry={() => void reload()} /> : (
          <div className="divide-y" style={{ borderColor: "rgba(0,71,171,0.10)" }}>
            {referees.map((referee) => (
              <article key={referee.id} className="p-5 transition-colors hover:bg-[#F5F7FF]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-4">
                    <ApprovalPlayerPhoto id={referee.id} name={referee.name} />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="fg-display text-xl font-black" style={{ color: "var(--color-fg-ink)" }}>{referee.name}</div>
                        <AdminStatusPill tone={referee.isApproved ? "blue" : "red"}>{getRefereeStatusLabel(referee)}</AdminStatusPill>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>
                        <span><Phone className="mr-1 inline h-3.5 w-3.5" />{referee.phone || "전화번호 없음"}</span>
                        <span>{referee.email || "이메일 없음"}</span>
                        <span>{referee.hasPlayerExperience ? "선출" : "비선출"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {referee.isApproved ? (
                      <button onClick={() => void updateApproval(referee, false)} disabled={!!savingId} className="inline-flex min-h-[42px] items-center gap-2 border px-3 text-sm font-bold" style={{ borderColor: "rgba(255,59,48,0.20)", background: "rgba(255,59,48,0.08)", color: "var(--destructive)" }}><XCircle className="h-4 w-4" /> 승인 취소</button>
                    ) : (
                      <button onClick={() => void updateApproval(referee, true)} disabled={!!savingId} className="inline-flex min-h-[42px] items-center gap-2 px-4 text-sm font-bold" style={{ background: "var(--primary)", color: "#fff" }}><CheckCircle2 className="h-4 w-4" /> 심판 승인</button>
                    )}
                    <button onClick={() => void convertToPlayer(referee)} disabled={!!savingId} className="inline-flex min-h-[42px] items-center gap-2 border px-3 text-sm font-bold" style={{ borderColor: "rgba(0,71,171,0.18)", background: "#fff", color: "var(--primary)" }}><UserRound className="h-4 w-4" /> 선수로 전환</button>
                    {referee.isApproved ? <ShieldCheck className="h-5 w-5" style={{ color: "var(--primary)" }} /> : <UserX className="h-5 w-5" style={{ color: "var(--destructive)" }} />}
                  </div>
                </div>
              </article>
            ))}
            {referees.length === 0 && <div className="p-16 text-center" style={{ color: "var(--color-fg-ink-muted)" }}>등록된 심판 신청자가 없습니다</div>}
          </div>
        )}
      </AdminPanel>
    </AdminShell>
  );
}
