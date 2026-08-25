"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  CreditCard,
  Plus,
  Trash2,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";
import { useDataStore } from "@/stores/dataStore";
import { useAuth } from "@/hooks/useAuth";
import { canManageTeam } from "@/lib/team-permissions";
import type {
  Team,
  TeamDuesPeriod,
  TeamDuesPayment,
  TeamDuesExpense,
  TeamDuesPaymentStatus,
} from "@/types";

// "2026-05-01" → "2026년 5월"
function fmtMonth(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-/);
  if (!m) return iso;
  return `${m[1]}년 ${parseInt(m[2], 10)}월`;
}

function fmtDate(iso: string | undefined | null): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[1]}.${m[2]}.${m[3]}`;
}

function fmtWon(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

function firstOfThisMonth(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}-01`;
}

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const STATUS_LABEL: Record<TeamDuesPaymentStatus, string> = {
  unpaid: "미납",
  paid: "납부",
  partial: "일부",
  exempt: "면제",
};

const STATUS_TONE: Record<TeamDuesPaymentStatus, { bg: string; fg: string }> = {
  unpaid: { bg: "rgba(255,59,48,0.10)", fg: "#C03A2B" },
  paid: { bg: "rgba(0,71,171,0.10)", fg: "var(--primary)" },
  partial: { bg: "rgba(245,158,11,0.14)", fg: "#A15C00" },
  exempt: { bg: "rgba(120,120,128,0.10)", fg: "#5F6470" },
};

export default function TeamDuesPage() {
  const { id } = useParams<{ id: string }>();
  const { player: currentPlayer } = useAuth();
  const store = useDataStore();

  const [team, setTeam] = useState<Team | null>(null);
  const [periods, setPeriods] = useState<TeamDuesPeriod[]>([]);
  const [expenses, setExpenses] = useState<TeamDuesExpense[]>([]);
  // 펼친 month의 payments 캐시 (periodId → payments[])
  const [paymentsByPeriod, setPaymentsByPeriod] = useState<
    Record<string, TeamDuesPayment[]>
  >({});
  const [openPeriodId, setOpenPeriodId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // create-period form
  const [createOpen, setCreateOpen] = useState(false);
  const [newMonth, setNewMonth] = useState(firstOfThisMonth());
  const [newAmount, setNewAmount] = useState("50000");
  const [newDueDate, setNewDueDate] = useState("");
  const [newMemo, setNewMemo] = useState("");
  const [creating, setCreating] = useState(false);

  // add-expense form
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expDate, setExpDate] = useState(todayISO());
  const [expAmount, setExpAmount] = useState("");
  const [expCategory, setExpCategory] = useState("");
  const [expMemo, setExpMemo] = useState("");
  const [savingExpense, setSavingExpense] = useState(false);

  const isDirector = useMemo(
    () => canManageTeam(currentPlayer, team),
    [currentPlayer, team],
  );

  // 본 페이지 read 권한: 팀 멤버 OR 디렉터 OR admin
  const canRead = useMemo(() => {
    if (!currentPlayer || !team) return false;
    if (currentPlayer.role === "admin") return true;
    if (isDirector) return true;
    return currentPlayer.isApproved && currentPlayer.teamId === team.id;
  }, [currentPlayer, team, isDirector]);

  // ── data fetchers ─────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    void store.fetchTeam(id).then((t) => {
      if (!cancelled) setTeam(t);
    });
    return () => {
      cancelled = true;
    };
  }, [id, store]);

  useEffect(() => {
    if (!team?.id) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      store.fetchTeamDuesPeriods(team.id),
      store.fetchTeamDuesExpenses(team.id),
    ]).then(([ps, es]) => {
      if (cancelled) return;
      setPeriods(ps);
      setExpenses(es);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [team?.id, store]);

  const reloadPayments = async (periodId: string) => {
    const list = await store.fetchTeamDuesPayments(periodId);
    setPaymentsByPeriod((prev) => ({ ...prev, [periodId]: list }));
  };

  const togglePeriod = async (p: TeamDuesPeriod) => {
    if (openPeriodId === p.id) {
      setOpenPeriodId(null);
      return;
    }
    setOpenPeriodId(p.id);
    if (!paymentsByPeriod[p.id]) {
      await reloadPayments(p.id);
    }
  };

  // ── actions ────────────────────────────────────────────────────────────
  const submitCreatePeriod = async () => {
    if (!team) return;
    const amount = parseInt(newAmount.replace(/[^\d]/g, ""), 10);
    if (!Number.isFinite(amount) || amount < 0) {
      alert("회비 금액을 올바르게 입력해주세요");
      return;
    }
    setCreating(true);
    try {
      await store.createTeamDuesPeriod({
        teamId: team.id,
        periodMonth: newMonth,
        monthlyAmount: amount,
        dueDate: newDueDate || undefined,
        memo: newMemo.trim() || undefined,
      });
      const ps = await store.fetchTeamDuesPeriods(team.id);
      setPeriods(ps);
      setCreateOpen(false);
      setNewMemo("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "생성 실패");
    } finally {
      setCreating(false);
    }
  };

  const removePeriod = async (p: TeamDuesPeriod) => {
    if (!confirm(`${fmtMonth(p.periodMonth)} 회비 항목을 삭제할까요? 납부 내역도 함께 삭제됩니다.`)) {
      return;
    }
    try {
      await store.deleteTeamDuesPeriod(p.id);
      if (team) setPeriods(await store.fetchTeamDuesPeriods(team.id));
      setPaymentsByPeriod((prev) => {
        const copy = { ...prev };
        delete copy[p.id];
        return copy;
      });
      if (openPeriodId === p.id) setOpenPeriodId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "삭제 실패");
    }
  };

  const togglePaymentStatus = async (
    p: TeamDuesPeriod,
    pay: TeamDuesPayment,
    next: TeamDuesPaymentStatus,
  ) => {
    try {
      const amount =
        next === "paid"
          ? p.monthlyAmount
          : next === "unpaid" || next === "exempt"
            ? 0
            : pay.amountPaid;
      await store.setTeamDuesPaymentStatus(pay.id, next, amount);
      await reloadPayments(p.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "변경 실패");
    }
  };

  const submitAddExpense = async () => {
    if (!team) return;
    const amount = parseInt(expAmount.replace(/[^\d]/g, ""), 10);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("지출 금액을 올바르게 입력해주세요");
      return;
    }
    setSavingExpense(true);
    try {
      await store.addTeamDuesExpense({
        teamId: team.id,
        occurredOn: expDate,
        amount,
        category: expCategory.trim() || undefined,
        memo: expMemo.trim() || undefined,
      });
      const es = await store.fetchTeamDuesExpenses(team.id);
      setExpenses(es);
      setExpenseOpen(false);
      setExpAmount("");
      setExpCategory("");
      setExpMemo("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "등록 실패");
    } finally {
      setSavingExpense(false);
    }
  };

  const removeExpense = async (e: TeamDuesExpense) => {
    if (!confirm(`${fmtDate(e.occurredOn)} 지출(${fmtWon(e.amount)})을 삭제할까요?`)) return;
    try {
      await store.deleteTeamDuesExpense(e.id);
      if (team) setExpenses(await store.fetchTeamDuesExpenses(team.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "삭제 실패");
    }
  };

  // ── derived: 잔액·요약 ─────────────────────────────────────────────────
  // 잔액 = sum(모든 period의 paid+partial amount_paid) − sum(expenses.amount).
  // payments는 펼친 month만 fetch했으므로 모든 month 캐시가 있을 때만 정확하다.
  // 화면 상단의 빠른 요약은 expenses는 정확하나 income은 펼친 month만 합산되니
  // "정확한 잔액"이 필요한 디렉터는 모든 month를 펼치게 안내한다.
  const totalExpense = expenses.reduce((a, e) => a + e.amount, 0);
  const knownIncome = Object.values(paymentsByPeriod)
    .flat()
    .reduce((a, p) => a + (p.status === "paid" || p.status === "partial" ? p.amountPaid : 0), 0);
  const allMonthsLoaded = periods.every((p) => paymentsByPeriod[p.id] !== undefined);
  const balance = knownIncome - totalExpense;

  // 본인 미납 표시: 펼쳐진 payments 중 본인 행에서 unpaid 상태 카운트.
  // 정확도를 위해 fetchMyDuesPayments도 별도 호출하여 모든 미납 표시.
  const [myUnpaidPeriods, setMyUnpaidPeriods] = useState<TeamDuesPayment[]>([]);
  useEffect(() => {
    if (!currentPlayer?.id) return;
    let cancelled = false;
    void store.fetchMyDuesPayments(currentPlayer.id).then((list) => {
      if (cancelled) return;
      const teamPeriodIds = new Set(periods.map((p) => p.id));
      setMyUnpaidPeriods(
        list.filter((p) => p.status === "unpaid" && teamPeriodIds.has(p.periodId)),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [currentPlayer?.id, store, periods]);

  // ── render ────────────────────────────────────────────────────────────
  // 본 페이지는 teams/[id]/layout.tsx의 TeamAdminLayout 사이드바 grid의 우측
  // 컬럼 안에서 렌더된다(좌측 nav가 자동으로 "팀 홈으로" 백링크 + dues 탭 활성
  // 상태를 제공). 따라서 자체 min-h-screen·외부 main·백링크는 두지 않는다.
  return (
    <div>
      {/* Hero */}
        <div
          className="mb-8 rounded-2xl border p-6 md:p-8"
          style={{
            background: "var(--color-fg-paper-2)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: "var(--color-fg-paper-3)", color: "var(--primary)" }}
            >
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <p
                className="fg-label text-[11px]"
                style={{ color: "var(--primary)" }}
              >
                TEAM DUES
              </p>
              <h1
                className="fg-display text-2xl md:text-3xl font-black"
                style={{ color: "var(--color-fg-ink)" }}
              >
                회비 장부
              </h1>
            </div>
          </div>
          <p className="text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>
            {team?.name ? `${team.name} · ` : ""}월별 회비, 미납자, 지출과 잔액을 한곳에서 관리합니다.
          </p>

          {/* 팀 운영 형태 배지 — community 는 모든 멤버 공개, club 은 디렉터 전용
              임을 한 줄로 알려 회비 정책 차이를 인지시킨다. */}
          {team && (
            <div
              className="mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold"
              style={{
                background:
                  team.teamType === "club"
                    ? "rgba(120,120,128,0.10)"
                    : "rgba(0,71,171,0.08)",
                borderColor:
                  team.teamType === "club"
                    ? "rgba(120,120,128,0.22)"
                    : "rgba(0,71,171,0.22)",
                color:
                  team.teamType === "club" ? "#5F6470" : "var(--primary)",
              }}
              aria-label={
                team.teamType === "club"
                  ? "클럽형: 디렉터 전용 장부"
                  : "동호회형: 모든 멤버 공개"
              }
            >
              {team.teamType === "club" ? "클럽형 · 디렉터 전용" : "동호회형 · 전체 공개"}
            </div>
          )}

          {/* 본인 미납 알림 */}
          {!isDirector && myUnpaidPeriods.length > 0 && (
            <div
              className="mt-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm"
              style={{
                background: "rgba(255,59,48,0.06)",
                borderColor: "rgba(255,59,48,0.22)",
                color: "#C03A2B",
              }}
              role="status"
            >
              <AlertCircle className="h-4 w-4" />
              <span className="font-bold">미납 {myUnpaidPeriods.length}건</span>
              <span>이 있습니다. 매니저에게 납부 후 확인을 요청해주세요.</span>
            </div>
          )}
        </div>

        {!canRead ? (
          <div
            className="rounded-2xl border p-8 text-center text-sm"
            style={{
              background: "var(--color-fg-paper-2)",
              borderColor: "var(--border)",
              color: "var(--color-fg-ink-muted)",
            }}
          >
            팀 멤버만 회비 장부를 열람할 수 있습니다.
          </div>
        ) : loading ? (
          <div
            className="rounded-2xl border p-8 text-center text-sm"
            style={{
              background: "var(--color-fg-paper-2)",
              borderColor: "var(--border)",
              color: "var(--color-fg-ink-muted)",
            }}
          >
            불러오는 중...
          </div>
        ) : (
          <>
            {/* 클럽형 + 일반 멤버: 전체 장부(요약/지출/타인 납부)는 비공개.
                자신의 납부 내역(periods + 본인 payment 행) 만 표시한다. */}
            {team?.teamType === "club" && !isDirector ? (
              <div
                className="mb-6 rounded-2xl border p-5 text-sm"
                style={{
                  background: "var(--color-fg-paper-2)",
                  borderColor: "var(--border)",
                  color: "var(--color-fg-ink-muted)",
                }}
              >
                이 팀은 <strong style={{ color: "var(--color-fg-ink)" }}>클럽형</strong> 으로 운영되어
                전체 장부(누적 수입·지출·잔액·다른 멤버 납부 내역)는 디렉터만 열람합니다.
                본인 납부 내역은 아래 월별 카드에서 확인할 수 있습니다.
              </div>
            ) : (
            /* 요약 카드: 수입(펼친 month 합) · 지출 · 잔액 */
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <SummaryCard
                label="누적 수입"
                value={fmtWon(knownIncome)}
                hint={allMonthsLoaded ? "전 월 합산" : "펼친 월 합산"}
                accent="var(--primary)"
              />
              <SummaryCard
                label="누적 지출"
                value={fmtWon(totalExpense)}
                hint={`${expenses.length}건`}
                accent="#C03A2B"
              />
              <SummaryCard
                label="잔액"
                value={fmtWon(balance)}
                hint={allMonthsLoaded ? "정확" : "참고용"}
                accent={balance >= 0 ? "var(--primary)" : "#C03A2B"}
              />
            </div>
            )}

            {/* 월별 사이클 섹션 */}
            <section
              className="mb-8 rounded-2xl border"
              style={{
                background: "var(--color-fg-paper-2)",
                borderColor: "var(--border)",
              }}
            >
              <header className="flex items-center justify-between gap-3 border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
                <h2
                  className="fg-display text-lg font-black"
                  style={{ color: "var(--color-fg-ink)" }}
                >
                  월별 회비
                </h2>
                {isDirector && (
                  <button
                    type="button"
                    onClick={() => setCreateOpen((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
                    style={{ background: "var(--primary)", color: "#fff" }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {createOpen ? "닫기" : "월 추가"}
                  </button>
                )}
              </header>

              {isDirector && createOpen && (
                <div className="border-b px-5 py-4 grid gap-3 md:grid-cols-4" style={{ borderColor: "var(--border)", background: "rgba(0,71,171,0.03)" }}>
                  <LabeledInput label="월(YYYY-MM-01)" type="date" value={newMonth} onChange={setNewMonth} />
                  <LabeledInput label="월 회비(원)" type="number" inputMode="numeric" value={newAmount} onChange={setNewAmount} />
                  <LabeledInput label="납부 기한(선택)" type="date" value={newDueDate} onChange={setNewDueDate} />
                  <LabeledInput label="메모(선택)" value={newMemo} onChange={setNewMemo} placeholder="예: 5월 정기 회비" />
                  <div className="md:col-span-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setCreateOpen(false)}
                      className="rounded-md border px-4 py-2 text-xs font-bold"
                      style={{ borderColor: "var(--border)", color: "var(--color-fg-ink-muted)", background: "var(--color-fg-paper)" }}
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={submitCreatePeriod}
                      disabled={creating}
                      className="rounded-md px-4 py-2 text-xs font-bold disabled:opacity-50"
                      style={{ background: "var(--primary)", color: "#fff" }}
                    >
                      {creating ? "추가 중..." : "추가"}
                    </button>
                  </div>
                </div>
              )}

              {periods.length === 0 ? (
                <div className="px-5 py-12 text-center" style={{ color: "var(--color-fg-ink-muted)" }}>
                  <div
                    className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full"
                    style={{ background: "var(--color-fg-paper-3)", color: "var(--primary)" }}
                    aria-hidden
                  >
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-bold" style={{ color: "var(--color-fg-ink)" }}>
                    아직 등록된 회비 사이클이 없습니다
                  </p>
                  <p className="mt-1 text-xs leading-relaxed">
                    {isDirector
                      ? "위 ‘월 추가’로 첫 회비 월을 만들고 멤버들의 납부를 시작하세요."
                      : "감독·매니저가 첫 회비 월을 등록하면 여기에 표시됩니다."}
                  </p>
                </div>
              ) : (
                <ul>
                  {periods.map((p) => {
                    const pays = paymentsByPeriod[p.id] ?? [];
                    const paidCnt = pays.filter((x) => x.status === "paid").length;
                    const unpaidCnt = pays.filter((x) => x.status === "unpaid").length;
                    const open = openPeriodId === p.id;
                    return (
                      <li key={p.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                        <button
                          type="button"
                          onClick={() => void togglePeriod(p)}
                          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-[rgba(0,71,171,0.04)]"
                        >
                          <div>
                            <p className="font-bold text-sm" style={{ color: "var(--color-fg-ink)" }}>
                              {fmtMonth(p.periodMonth)} · {fmtWon(p.monthlyAmount)}
                            </p>
                            <p className="text-[11px] mt-0.5" style={{ color: "var(--color-fg-ink-muted)" }}>
                              {p.dueDate ? `기한 ${fmtDate(p.dueDate)} · ` : ""}
                              {pays.length > 0 ? `납부 ${paidCnt} · 미납 ${unpaidCnt}` : "납부 현황 펼치기"}
                              {p.memo ? ` · ${p.memo}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {isDirector && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void removePeriod(p);
                                }}
                                aria-label="월 삭제"
                                className="rounded-md border p-2"
                                style={{ borderColor: "var(--border)", color: "#C03A2B", background: "var(--color-fg-paper)" }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </button>

                        {open && (
                          <div className="border-t bg-[rgba(0,0,0,0.015)] px-5 py-4" style={{ borderColor: "var(--border)" }}>
                            {pays.length === 0 ? (
                              <p className="text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>납부 내역이 없습니다.</p>
                            ) : (
                              <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
                                {pays.map((pay) => {
                                  const tone = STATUS_TONE[pay.status];
                                  const isMe = currentPlayer?.id === pay.playerId;
                                  return (
                                    <li key={pay.id} className="flex items-center justify-between gap-3 py-2.5">
                                      <div className="min-w-0">
                                        <p className="text-sm font-bold truncate" style={{ color: "var(--color-fg-ink)" }}>
                                          {pay.playerName ?? "이름 없음"}
                                          {isMe && <span className="ml-1.5 text-[10px] font-normal" style={{ color: "var(--primary)" }}>(나)</span>}
                                        </p>
                                        <p className="text-[11px]" style={{ color: "var(--color-fg-ink-muted)" }}>
                                          {pay.status === "paid" || pay.status === "partial"
                                            ? `${fmtWon(pay.amountPaid)} · ${pay.paidAt ? fmtDate(new Date(pay.paidAt).toISOString()) : ""}`
                                            : pay.status === "exempt"
                                              ? "면제"
                                              : "미납"}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span
                                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold"
                                          style={{ background: tone.bg, color: tone.fg }}
                                        >
                                          {STATUS_LABEL[pay.status]}
                                        </span>
                                        {isDirector && (
                                          <div className="flex items-center gap-1">
                                            {pay.status !== "paid" && (
                                              <button
                                                type="button"
                                                onClick={() => void togglePaymentStatus(p, pay, "paid")}
                                                aria-label="납부 처리"
                                                className="rounded-md border p-2"
                                                style={{ borderColor: "var(--border)", background: "var(--color-fg-paper)", color: "var(--primary)" }}
                                              >
                                                <Check className="h-3.5 w-3.5" />
                                              </button>
                                            )}
                                            {pay.status !== "unpaid" && (
                                              <button
                                                type="button"
                                                onClick={() => void togglePaymentStatus(p, pay, "unpaid")}
                                                aria-label="미납 되돌리기"
                                                className="rounded-md border p-2"
                                                style={{ borderColor: "var(--border)", background: "var(--color-fg-paper)", color: "#C03A2B" }}
                                              >
                                                <X className="h-3.5 w-3.5" />
                                              </button>
                                            )}
                                            {pay.status !== "exempt" && (
                                              <button
                                                type="button"
                                                onClick={() => void togglePaymentStatus(p, pay, "exempt")}
                                                className="rounded-md border px-2 py-1 text-[10px] font-bold"
                                                style={{ borderColor: "var(--border)", background: "var(--color-fg-paper)", color: "#5F6470" }}
                                              >
                                                면제
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* 지출 섹션 — 클럽형은 일반 멤버에게 비공개(RLS 도 막지만 UI 도
                숨겨 오해 방지). 디렉터/admin/community 멤버는 그대로 보임. */}
            {(team?.teamType !== "club" || isDirector) && (
            <section
              className="rounded-2xl border"
              style={{
                background: "var(--color-fg-paper-2)",
                borderColor: "var(--border)",
              }}
            >
              <header className="flex items-center justify-between gap-3 border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
                <h2
                  className="fg-display text-lg font-black"
                  style={{ color: "var(--color-fg-ink)" }}
                >
                  지출 내역
                </h2>
                {isDirector && (
                  <button
                    type="button"
                    onClick={() => setExpenseOpen((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
                    style={{ background: "var(--primary)", color: "#fff" }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {expenseOpen ? "닫기" : "지출 추가"}
                  </button>
                )}
              </header>

              {isDirector && expenseOpen && (
                <div className="border-b px-5 py-4 grid gap-3 md:grid-cols-4" style={{ borderColor: "var(--border)", background: "rgba(0,71,171,0.03)" }}>
                  <LabeledInput label="날짜" type="date" value={expDate} onChange={setExpDate} />
                  <LabeledInput label="금액(원)" type="number" inputMode="numeric" value={expAmount} onChange={setExpAmount} placeholder="50000" />
                  <LabeledInput label="분류(선택)" value={expCategory} onChange={setExpCategory} placeholder="구장/식대 등" />
                  <LabeledInput label="메모(선택)" value={expMemo} onChange={setExpMemo} placeholder="상세" />
                  <div className="md:col-span-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setExpenseOpen(false)}
                      className="rounded-md border px-4 py-2 text-xs font-bold"
                      style={{ borderColor: "var(--border)", color: "var(--color-fg-ink-muted)", background: "var(--color-fg-paper)" }}
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={submitAddExpense}
                      disabled={savingExpense}
                      className="rounded-md px-4 py-2 text-xs font-bold disabled:opacity-50"
                      style={{ background: "var(--primary)", color: "#fff" }}
                    >
                      {savingExpense ? "등록 중..." : "등록"}
                    </button>
                  </div>
                </div>
              )}

              {expenses.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>
                  아직 등록된 지출이 없습니다.{isDirector && " 위 ‘지출 추가’로 기록해보세요."}
                </div>
              ) : (
                <ul>
                  {expenses.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-3 border-t px-5 py-3" style={{ borderColor: "var(--border)" }}>
                      <div className="min-w-0">
                        <p className="text-sm font-bold" style={{ color: "var(--color-fg-ink)" }}>
                          {fmtWon(e.amount)}
                          {e.category && <span className="ml-2 text-[11px] font-normal" style={{ color: "var(--primary)" }}>· {e.category}</span>}
                        </p>
                        <p className="text-[11px]" style={{ color: "var(--color-fg-ink-muted)" }}>
                          {fmtDate(e.occurredOn)}{e.memo ? ` · ${e.memo}` : ""}
                        </p>
                      </div>
                      {isDirector && (
                        <button
                          type="button"
                          onClick={() => void removeExpense(e)}
                          aria-label="지출 삭제"
                          className="rounded-md border p-2"
                          style={{ borderColor: "var(--border)", color: "#C03A2B", background: "var(--color-fg-paper)" }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            )}
          </>
        )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent: string;
}) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        background: "var(--color-fg-paper-2)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <p className="fg-label text-[10px]" style={{ color: accent }}>{label}</p>
      <p className="mt-1 fg-display text-lg md:text-xl font-black" style={{ color: "var(--color-fg-ink)" }}>{value}</p>
      {hint && <p className="text-[10px] mt-0.5" style={{ color: "var(--color-fg-ink-muted)" }}>{hint}</p>}
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="block">
      <span className="fg-label text-[10px]" style={{ color: "var(--color-fg-ink-muted)" }}>{label}</span>
      <input
        type={type}
        value={value}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
        style={{ borderColor: "var(--border)", background: "var(--color-fg-paper)", color: "var(--color-fg-ink)" }}
      />
    </label>
  );
}
