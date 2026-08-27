"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Save, Wallet } from "lucide-react";
import { AdminGuard } from "@/components/admin-guard";
import { AdminPanel, AdminShell, AdminStatusPill } from "@/components/admin-shell";
import { useDataStore } from "@/stores/dataStore";
import { supabase } from "@/config/supabase";
import {
  ENTRY_FEE_STATUS_LABELS, defaultFeeFor, formatWon, summarizeFees,
  type EntryFee, type EntryFeeStatus,
} from "@/lib/entry-fee";
import type { Team, Tournament } from "@/types";

export default function AdminEntryFeesPage() {
  return <AdminGuard allow={["admin"]}><AdminEntryFees /></AdminGuard>;
}

function AdminEntryFees() {
  const store = useDataStore();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tournamentId, setTournamentId] = useState("");
  const [fees, setFees] = useState<Record<string, EntryFee>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      void (async () => {
        const [list, teamList] = await Promise.all([
          store.fetchAllTournaments(),
          store.fetchTeams(),
        ]);
        setTournaments(list);
        setTeams(teamList.filter((t) => t.isApproved));
        if (list.length > 0) setTournamentId((cur) => cur || list[0].id);
        setLoading(false);
      })();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 저장된 수납 내역을 불러오고, 없는 팀은 신청 시점 기준 기본 금액으로 채운다.
  useEffect(() => {
    if (!tournamentId || teams.length === 0) return;
    void (async () => {
      const { data, error } = await supabase
        .from("tournament_entry_fees")
        .select("team_id, amount, status, paid_at, memo")
        .eq("tournament_id", tournamentId);
      if (error) {
        setMessage({ tone: "error", text: error.message });
        return;
      }
      const saved = new Map((data ?? []).map((r) => [r.team_id, r]));
      const next: Record<string, EntryFee> = {};
      for (const team of teams) {
        const row = saved.get(team.id);
        next[team.id] = row
          ? {
              teamId: team.id,
              amount: row.amount ?? 0,
              status: (row.status as EntryFeeStatus) ?? "unpaid",
              paidAt: row.paid_at,
              memo: row.memo ?? "",
            }
          : {
              teamId: team.id,
              amount: defaultFeeFor(team.createdAt),
              status: "unpaid",
              paidAt: null,
              memo: "",
            };
      }
      setFees(next);
    })();
  }, [tournamentId, teams]);

  const summary = useMemo(() => summarizeFees(Object.values(fees)), [fees]);

  const patch = (teamId: string, changes: Partial<EntryFee>) => {
    setFees((prev) => ({ ...prev, [teamId]: { ...prev[teamId], ...changes } }));
    setMessage(null);
  };

  const save = async (teamId: string) => {
    if (savingId) return;
    const fee = fees[teamId];
    if (!fee) return;
    setSavingId(teamId);
    setMessage(null);
    try {
      const { error } = await supabase.from("tournament_entry_fees").upsert(
        {
          tournament_id: tournamentId,
          team_id: teamId,
          amount: fee.amount,
          status: fee.status,
          // 완납으로 바꾸는 순간의 시각을 납부일로 잡는다. 미납으로 되돌리면 지운다.
          paid_at: fee.status === "paid" ? (fee.paidAt ?? new Date().toISOString()) : null,
          memo: fee.memo || null,
        },
        { onConflict: "tournament_id,team_id" },
      );
      if (error) throw new Error(error.message);
      const name = teams.find((t) => t.id === teamId)?.name ?? "팀";
      setMessage({ tone: "success", text: `${name} 수납 정보를 저장했습니다.` });
      if (fee.status === "paid" && !fee.paidAt) {
        patch(teamId, { paidAt: new Date().toISOString() });
      }
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "저장에 실패했습니다.",
      });
    } finally {
      setSavingId("");
    }
  };

  const field = { borderColor: "rgba(0,71,171,0.18)", background: "#fff", color: "var(--color-fg-ink)" };

  return (
    <AdminShell
      eyebrow="OPS · ENTRY FEE"
      title="참가비 수납"
      description="팀별 참가비 청구 금액과 입금 여부를 관리합니다. 얼리버드·일반 금액은 신청 시점으로 자동 계산되며 수정할 수 있습니다."
    >
      <AdminPanel className="p-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>
            <Loader2 className="h-4 w-4 animate-spin" /> 불러오는 중...
          </div>
        ) : tournaments.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>등록된 대회가 없습니다.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={tournamentId}
                onChange={(event) => setTournamentId(event.target.value)}
                className="min-h-[42px] border px-3 text-sm font-bold"
                style={field}
              >
                {tournaments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <Stat label="청구 총액" value={formatWon(summary.expected)} />
              <Stat label="수납액" value={formatWon(summary.collected)} tone="blue" />
              <Stat label="미수금" value={formatWon(summary.outstanding)} tone={summary.outstanding > 0 ? "red" : "blue"} />
              <Stat label="완납 / 전체" value={`${summary.paidCount} / ${summary.teamCount}팀`} />
            </div>

            {message && (
              <p
                role="status"
                className="mt-4 border px-3 py-2.5 text-sm font-bold"
                style={message.tone === "success"
                  ? { background: "var(--color-fg-paper-3)", borderColor: "rgba(0,71,171,0.20)", color: "var(--primary)" }
                  : { background: "rgba(255,59,48,0.08)", borderColor: "rgba(255,59,48,0.20)", color: "var(--destructive)" }}
              >
                {message.text}
              </p>
            )}

            {teams.length === 0 ? (
              <p className="mt-5 text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>
                승인된 참가팀이 없습니다. 팀 승인 후 여기에 나타납니다.
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {teams.map((team) => {
                  const fee = fees[team.id];
                  if (!fee) return null;
                  const paid = fee.status === "paid";
                  return (
                    <div key={team.id} className="border p-4" style={{ borderColor: "rgba(0,71,171,0.14)", background: "#fff" }}>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="flex items-center gap-2">
                          {paid
                            ? <CheckCircle2 className="h-4 w-4" style={{ color: "var(--primary)" }} />
                            : <Wallet className="h-4 w-4" style={{ color: "var(--color-fg-ink-ghost)" }} />}
                          <span className="fg-display text-base font-black" style={{ color: "var(--color-fg-ink)" }}>{team.name}</span>
                        </span>
                        <AdminStatusPill tone={paid ? "blue" : fee.status === "partial" ? "muted" : "red"}>
                          {ENTRY_FEE_STATUS_LABELS[fee.status]}
                        </AdminStatusPill>
                        {fee.paidAt && (
                          <span className="text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>
                            {new Date(fee.paidAt).toLocaleDateString("ko-KR")} 입금
                          </span>
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap items-end gap-3">
                        <label className="grid gap-1">
                          <span className="fg-label text-[10px]" style={{ color: "var(--color-fg-ink-muted)" }}>청구 금액</span>
                          <input
                            type="number" min={0} step={10000} value={fee.amount}
                            onChange={(e) => patch(team.id, { amount: Number(e.target.value) })}
                            className="min-h-[38px] w-36 border px-2 text-sm font-bold" style={field}
                          />
                        </label>
                        <label className="grid gap-1">
                          <span className="fg-label text-[10px]" style={{ color: "var(--color-fg-ink-muted)" }}>상태</span>
                          <select
                            value={fee.status}
                            onChange={(e) => patch(team.id, { status: e.target.value as EntryFeeStatus })}
                            className="min-h-[38px] border px-2 text-sm font-bold" style={field}
                          >
                            {(Object.keys(ENTRY_FEE_STATUS_LABELS) as EntryFeeStatus[]).map((s) => (
                              <option key={s} value={s}>{ENTRY_FEE_STATUS_LABELS[s]}</option>
                            ))}
                          </select>
                        </label>
                        <label className="grid flex-1 gap-1" style={{ minWidth: 180 }}>
                          <span className="fg-label text-[10px]" style={{ color: "var(--color-fg-ink-muted)" }}>메모</span>
                          <input
                            value={fee.memo}
                            onChange={(e) => patch(team.id, { memo: e.target.value })}
                            placeholder="입금자명, 분할 납부 등"
                            className="min-h-[38px] border px-2 text-sm" style={field}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => void save(team.id)}
                          disabled={savingId === team.id}
                          className="inline-flex min-h-[38px] items-center gap-2 px-3 text-sm font-bold disabled:opacity-60"
                          style={{ background: "var(--primary)", color: "#fff" }}
                        >
                          {savingId === team.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          저장
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </AdminPanel>
    </AdminShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "blue" | "red" }) {
  const color = tone === "red" ? "var(--destructive)" : tone === "blue" ? "var(--primary)" : "var(--color-fg-ink)";
  return (
    <div className="border p-3" style={{ borderColor: "rgba(0,71,171,0.14)", background: "#fff" }}>
      <div className="fg-label text-[10px]" style={{ color: "var(--color-fg-ink-muted)" }}>{label}</div>
      <div className="mt-1 fg-display text-lg font-black" style={{ color }}>{value}</div>
    </div>
  );
}
