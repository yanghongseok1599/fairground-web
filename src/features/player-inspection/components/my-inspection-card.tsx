"use client";

import { CheckCircle2, ClipboardCheck, Clock3, RefreshCw } from "lucide-react";
import { fetchMyInspections } from "../api";
import { inspectionTime } from "../policy";
import { useInspectionQuery } from "../use-inspection-query";

export function MyInspectionCard() {
  const { data, error, loading, updatedAt, reload } = useInspectionQuery(fetchMyInspections);
  return <section aria-labelledby="my-inspection-title" className="rounded-3xl border border-primary/25 bg-background p-4 sm:p-5">
    <div className="flex items-center justify-between gap-3">
      <h2 id="my-inspection-title" className="flex items-center gap-2 text-lg font-black"><ClipboardCheck className="h-5 w-5 text-primary" />현장 선수검인</h2>
      <button type="button" onClick={() => void reload()} disabled={loading} aria-label="내 검인 결과 새로고침" className="inline-flex min-h-11 items-center gap-1.5 px-2 text-xs font-bold text-primary disabled:opacity-50">
        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />새로고침
      </button>
    </div>
    {error ? <div role="alert" className="mt-3 rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">
      검인 결과를 확인하지 못했습니다. 연결을 확인하고 새로고침해주세요.
      {updatedAt && <p className="mt-1 text-xs">마지막 확인: {inspectionTime(new Date(updatedAt).toISOString())}</p>}
    </div> : !data ? <p role="status" className="mt-3 text-sm text-muted-foreground">검인 결과를 불러오는 중…</p>
      : data.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">현재 확인할 참가 대회가 없습니다. 소속팀과 대회 참가 등록을 운영진에게 확인해주세요.</p>
        : <div className="mt-3 space-y-3" aria-live="polite">
          {data.map((item) => <div key={item.tournament_id} className={`rounded-2xl border p-4 ${item.checked_at ? "border-emerald-600/30 bg-emerald-50 text-emerald-950" : "border-border bg-muted/30"}`}>
            <p className="text-xs font-bold">{item.tournament_name} {item.tournament_date && `· ${item.tournament_date}`}</p>
            <p className="mt-2 flex items-center gap-2 text-xl font-black">
              {item.checked_at ? <CheckCircle2 className="h-6 w-6 text-emerald-700" /> : <Clock3 className="h-6 w-6 text-muted-foreground" />}
              {item.checked_at ? "검인완료" : "검인 대기"}
            </p>
            <p className="mt-2 text-sm">{item.checked_at ? `${item.team_name} · ${inspectionTime(item.checked_at)} 완료` : "대회 당일 현장 검인 데스크에서 본인 확인을 받아주세요."}</p>
          </div>)}
          <p className="text-xs text-muted-foreground">관리자 확인 후 자동으로 반영됩니다. 화면을 보고 있는 동안 15초마다 갱신됩니다.</p>
        </div>}
  </section>;
}
