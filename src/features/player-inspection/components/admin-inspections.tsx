"use client";

import { useCallback, useRef, useState } from "react";
import { CheckCircle2, Clock3, Loader2, RefreshCw, Search } from "lucide-react";
import { AdminPanel, AdminShell } from "@/components/admin-shell";
import { useAuth } from "@/hooks/useAuth";
import { registrationError } from "@/lib/registration/reliability";
import { fetchInspectionPlayers, fetchInspectionTournaments, saveInspection } from "../api";
import { filterInspections, inspectionBlockReason, inspectionNumber, inspectionTime, summarizeInspections } from "../policy";
import { useInspectionQuery } from "../use-inspection-query";
import type { InspectionFilter, InspectionPlayer, InspectionTournament } from "../types";
import { InspectionDialog } from "./inspection-dialog";
import { fetchInspectionPlayersWithGender } from "../gender-api";
import { GenderEditor } from "./gender-editor";
import { BirthDateEditor } from "./birth-date-editor";

const fieldClass = "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground";

export function AdminInspections() {
  const tournaments = useInspectionQuery(fetchInspectionTournaments);
  const [selectedId, setSelectedId] = useState("");
  const selected = tournaments.data?.find((t) => t.id === selectedId) ?? tournaments.data?.[0];
  return <AdminShell eyebrow="PLAYER INSPECTION" title="현장 선수검인"
    description="대회를 선택하고 선수 본인과 참가 자격을 확인해주세요. 검인 완료 결과는 참가자 마이페이지에 반영됩니다.">
    <AdminPanel className="p-4 sm:p-6">
      {tournaments.error ? <div role="alert" className="text-sm text-destructive">
        대회 목록을 불러오지 못했습니다.
        <button type="button" onClick={() => void tournaments.reload()} className="ml-2 min-h-11 underline">다시 불러오기</button>
      </div> : !tournaments.data ? <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />대회 불러오는 중…</p>
        : !selected ? <p className="text-sm text-muted-foreground">등록된 대회가 없습니다. 대회를 등록한 뒤 검인을 진행해주세요.</p> : <>
          <label className="grid max-w-lg gap-2 text-sm font-bold">검인 대회
            <select value={selected.id} onChange={(e) => setSelectedId(e.target.value)} className={fieldClass}>
              {tournaments.data.map((t) => <option key={t.id} value={t.id}>{t.name}{t.date ? ` · ${t.date}` : ""}</option>)}
            </select>
          </label>
          <InspectionRoster key={selected.id} tournament={selected} />
        </>}
    </AdminPanel>
  </AdminShell>;
}

function InspectionRoster({ tournament }: { tournament: InspectionTournament }) {
  const { player: operator } = useAuth();
  const canEditIdentity = operator?.role === "admin";
  const read = useCallback((signal: AbortSignal) => canEditIdentity
    ? fetchInspectionPlayersWithGender(tournament.id, signal)
    : fetchInspectionPlayers(tournament.id, signal), [tournament.id, canEditIdentity]);
  const { data, loading, error, updatedAt, reload, connected } = useInspectionQuery(read, true);
  const [query, setQuery] = useState("");
  const [teamId, setTeamId] = useState("");
  const [status, setStatus] = useState<InspectionFilter>("all");
  const [selected, setSelected] = useState<InspectionPlayer | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [message, setMessage] = useState("");
  const saveLock = useRef(false);
  const players = data ?? [];
  const teams = [...new Map(players.map((p) => [p.team_id, p.team_name])).entries()];
  const scoped = players.filter((p) => !teamId || p.team_id === teamId);
  const summary = summarizeInspections(scoped);
  const filtered = filterInspections(players, query, teamId, status);

  const save = async () => {
    if (!selected || saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    setSaveError("");
    setMessage("");
    try {
      await saveInspection(tournament.id, selected, !selected.checked_at);
      setMessage(`${selected.name} 선수 ${selected.checked_at ? "검인 완료를 취소했습니다." : "검인을 완료했습니다."}`);
      setSelected(null);
    } catch (cause) {
      setSaveError(`${registrationError(cause, "검인 결과를 저장하지 못했습니다.")} 창을 닫고 최신 명단을 확인해주세요.`);
    } finally {
      // A timeout can still mean the server committed. Always reconcile by reading.
      await reload();
      saveLock.current = false;
      setSaving(false);
    }
  };

  return <div className="mt-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="space-y-1 text-xs text-muted-foreground">
        <p>조 편성된 참가팀 기준 · 조 편성 전에는 승인된 전체 팀</p>
        <p>{connected && !error ? "실시간 동기화 연결됨" : "자동 동기화 확인 중"} · 5초마다 명단 재확인{updatedAt ? ` · 최근 확인 ${inspectionTime(new Date(updatedAt).toISOString())}` : ""}</p>
      </div>
      <button type="button" onClick={() => void reload()} disabled={loading || saving} className="inline-flex min-h-11 items-center gap-2 px-2 text-sm font-bold text-primary disabled:opacity-50">
        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />새로고침
      </button>
    </div>
    <p className="my-3 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">명단에 없는 선수는 현장에서 가입 후 선수등록과 참가팀 소속 선택을 완료해주세요. 팀 가입 신청은 승인 후 반영되며, 가입 미승인 선수도 명단에서 확인할 수 있습니다.{operator?.role !== "admin" && " 생년월일·성별 입력·수정은 관리자 계정에서 할 수 있습니다."}</p>
    {error && <div role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
      명단을 새로 확인하지 못했습니다. 연결을 확인한 후 새로고침해주세요. {updatedAt ? `마지막 확인: ${inspectionTime(new Date(updatedAt).toISOString())}` : ""}
    </div>}
    {message && <p role="status" className="mb-4 rounded-xl border border-emerald-600/25 bg-emerald-50 p-3 text-sm font-bold text-emerald-900">{message}</p>}
    {!data ? <p role="status" className="py-8 text-center text-sm text-muted-foreground">{loading ? "선수 명단을 불러오는 중…" : "명단을 불러오면 검인 현황이 표시됩니다."}</p> : <>
      <div className="grid grid-cols-3 gap-2 sm:gap-3" aria-label={teamId ? "선택 팀 검인 현황" : "대회 전체 검인 현황"}>
        {([
          ["all", "전체 선수", summary.total], ["complete", "검인 완료", summary.complete], ["pending", "미검인", summary.pending],
        ] as const).map(([value, label, count]) => <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)}
          className={`rounded-xl border p-3 text-left sm:p-4 ${status === value ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-background"}`}>
          <span className="text-xs font-bold text-muted-foreground">{label}</span>
          <span className={`mt-1 block text-2xl font-black sm:text-3xl ${value === "complete" ? "text-emerald-700" : "text-foreground"}`}>{count}<span className="ml-1 text-xs font-medium">명</span></span>
        </button>)}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_220px]">
        <label className="relative block"><span className="sr-only">선수 이름·팀·등번호 검색</span><Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="선수 이름, 팀, 등번호 검색" className={`${fieldClass} pl-10`} type="search" />
        </label>
        <label><span className="sr-only">팀별 필터</span><select value={teamId} onChange={(e) => setTeamId(e.target.value)} className={fieldClass}>
          <option value="">전체 팀</option>{teams.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select></label>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{teamId ? "선택 팀" : "전체 팀"} · {filtered.length}명 표시{error ? " · 이전에 확인한 명단" : ""}</p>
      <div className="mt-3 hidden grid-cols-[minmax(0,1fr)_160px_120px] gap-4 rounded-t-xl bg-muted px-4 py-3 text-xs font-bold text-muted-foreground md:grid" aria-hidden="true">
        <span>선수 / 등번호 · 소속팀 · 생년월일{canEditIdentity ? " · 성별" : ""}</span><span>검인 결과</span><span>처리</span>
      </div>
      <ul className="divide-y rounded-xl border border-border md:rounded-t-none">
        {filtered.map((p) => {
          const blocked = inspectionBlockReason(p);
          return <li key={p.player_id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 md:grid-cols-[minmax(0,1fr)_160px_120px] md:gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <p className="break-words font-black">{p.name} <span className="ml-1 text-sm text-primary">#{inspectionNumber(p)}</span></p>
                <p className="max-w-full break-words text-sm text-muted-foreground"><span className="sr-only">소속팀 </span>{p.team_name}</p>
                {operator?.role === "admin" ? <BirthDateEditor player={p} tournamentId={tournament.id} disabled={Boolean(error) || saving} onSaved={reload} /> : <p className="text-sm tabular-nums"><span className="text-muted-foreground">생년월일 </span>
                  {p.birth_date ? <time dateTime={p.birth_date} className="whitespace-nowrap">{p.birth_date}</time> : "미등록"}
                </p>}
                {canEditIdentity && <GenderEditor player={p} tournamentId={tournament.id} disabled={Boolean(error) || saving} onSaved={reload} />}
              </div>
              {blocked && <p className="mt-1 text-xs text-destructive">{blocked}</p>}
            </div>
            <div className="text-right md:text-left"><p className={`inline-flex items-center gap-1.5 text-sm font-bold ${p.checked_at ? "text-emerald-700" : "text-muted-foreground"}`}>
              {p.checked_at ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}{p.checked_at ? "검인완료" : "미검인"}
            </p>{p.checked_at && <p className="mt-1 text-xs text-muted-foreground">{inspectionTime(p.checked_at)}<br />{p.checked_by_name || "운영진"}</p>}</div>
            <button type="button" disabled={Boolean(error) || saving || Boolean(blocked && !p.checked_at)} onClick={() => { setSelected(p); setSaveError(""); }}
              aria-label={`${p.name} 선수 ${p.checked_at ? "검인 취소" : "검인하기"}`}
              className={`col-span-2 min-h-11 rounded-xl px-3 text-sm font-bold disabled:opacity-40 md:col-span-1 ${p.checked_at ? "border border-border text-muted-foreground" : "bg-primary text-primary-foreground"}`}>
              {p.checked_at ? "검인 취소" : "검인하기"}
            </button>
          </li>;
        })}
      </ul>
      {filtered.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">{players.length === 0 ? "검인 대상 선수가 없습니다. 참가팀 승인과 선수 소속을 확인해주세요." : "선택한 조건에 맞는 선수가 없습니다."}</p>}
    </>}
    {selected && <InspectionDialog key={`${selected.player_id}-${selected.revision}`} player={selected} tournamentName={tournament.name}
      saving={saving} error={saveError} onClose={() => setSelected(null)} onConfirm={() => void save()} />}
  </div>;
}
