"use client";

import { useState } from "react";
import type { Match, MatchEvent } from "@/types";
import { Button } from "@/components/ui/button";
import { recordingApi } from "./api";
import type { RecordingDuty } from "./types";

export function RecordingPanel({ match, events, duty, busy, pendingCount, storageError, onAssist, onRefresh, onRetry }: {
  match: Match; events: MatchEvent[]; duty: RecordingDuty; busy: boolean;
  pendingCount: number; storageError: string;
  onAssist: (goal: MatchEvent)=>void; onRefresh: ()=>Promise<void>; onRetry: ()=>Promise<boolean>;
}) {
  const [working,setWorking]=useState(false), [error,setError]=useState("");
  const run=async (fn:()=>Promise<void>) => {
    if(working || busy) return;
    setWorking(true);setError("");
    try { await fn(); await onRefresh(); } catch(e) { setError(e instanceof Error ? e.message : "저장 여부를 확인해주세요."); }
    finally { setWorking(false); }
  };
  const goals=events.filter(e=>e.type==="goal" && !e.isCancelled);
  const canAssist=duty==="assistant" || duty==="admin";
  const editable=match.status==="live" && !working && !busy;
  return <section aria-label="공동 경기 기록" className="space-y-3 rounded-xl border bg-card p-4">
    <div><h2 className="font-bold">{({admin:"관리자 · 전체 검수 및 최종 확정",primary:"주심 · 득점·반칙·카드 기록",assistant:"부심 · 득점별 어시스트 확인",unassigned:"이 경기에서 맡을 역할"})[duty]}</h2>
      <p className="mt-1 text-xs text-muted-foreground">주심 기록 → 부심 어시스트 확인 → 관리자 수정·보강·최종 확정</p></div>
    {duty==="unassigned" && (match.status==="scheduled" || match.status==="live") && <div className="flex flex-wrap gap-2">
      <Button disabled={working || !!match.primaryRefereeId} onClick={()=>run(()=>recordingApi.claim(match.id,"primary"))}>주심으로 참여{match.primaryRefereeId ? " · 배정됨" : ""}</Button>
      <Button variant="outline" disabled={working || !!match.assistantRefereeId} onClick={()=>run(()=>recordingApi.claim(match.id,"assistant"))}>부심으로 참여{match.assistantRefereeId ? " · 배정됨" : ""}</Button>
    </div>}
    {(pendingCount>0 || storageError) && <div role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
      <p>{storageError || `이 기기에 확인이 필요한 입력 ${pendingCount}건이 남아 있습니다. 새로 입력하지 말고 아래에서 저장 여부를 재확인해주세요.`}</p>
      <Button className="mt-2" variant="outline" disabled={busy || working || !!storageError} onClick={()=>void onRetry()}>보관된 기록 재확인</Button>
    </div>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="space-y-2">
      {goals.length===0 ? <p className="text-sm text-muted-foreground">주심이 득점을 입력하면 여기에 표시됩니다.</p> : goals.map(goal=>{
        const assist=events.find(e=>e.type==="assist" && !e.isCancelled && e.goalEventId===goal.id);
        return <div key={goal.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
          <div className="min-w-0 flex-1"><p className="font-bold">{goal.minute}′ {goal.playerName} 골</p><p className="text-xs text-muted-foreground">{goal.teamId===match.homeTeamId ? match.homeTeamName : match.awayTeamName} · 입력 {goal.recordedByName || "기존 기록"}</p>
            <p className="mt-1">{assist ? `어시스트 ${assist.playerName} · 입력 ${assist.recordedByName || "기존 기록"}` : goal.assistChecked ? "어시스트 없음 · 확인 완료" : "어시스트 확인 대기"}</p></div>
          {canAssist && !goal.assistChecked && <><Button size="sm" disabled={!editable} onClick={()=>onAssist(goal)}>선수 선택</Button><Button size="sm" variant="outline" disabled={!editable} onClick={()=>run(()=>recordingApi.noAssist(match.id,goal.id))}>어시스트 없음</Button></>}
          {duty==="admin" && goal.assistChecked && !assist && <Button size="sm" variant="outline" disabled={!editable} onClick={()=>run(()=>recordingApi.reopenAssist(match.id,goal.id))}>어시스트 다시 확인</Button>}
        </div>;
      })}
    </div>
    {duty==="primary" && <p className="text-xs text-muted-foreground">어시스트는 부심이 연결합니다. 기록 수정·보강·최종 확정은 관리자가 담당합니다.</p>}
  </section>;
}
