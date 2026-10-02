"use client";

import { useRef, useState } from "react";
import type { MatchEvent } from "@/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MatchDialogContent } from "./match-dialog-content";
import { cancellationEffect, cancellationUnavailable, recordingEventLabel } from "./recording-correction-policy";
import { isRosterEvent } from "./roster-stats";

/** All recording layouts use the same explicit event selection and confirmation. */
export function RecordingCorrectionsDialog({ events, teams, isLive, canRecord, busy, initialEventId, landscapeFallback, onClose, onCancel }: {
  events: MatchEvent[];
  teams: { id: string; name: string }[];
  isLive: boolean;
  canRecord: boolean;
  busy: boolean;
  initialEventId?: string;
  landscapeFallback?: boolean;
  onClose: () => void;
  onCancel: (eventId: string) => Promise<boolean>;
}) {
  const [selectedId, setSelectedId] = useState(initialEventId ?? "");
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const [failed, setFailed] = useState(false);
  const sending = useRef(false);
  const selected = events.find(event => event.id === selectedId);
  const locked = busy || working;
  const rows = events.filter(event => isRosterEvent(event.type)).sort((a, b) => b.timestamp - a.timestamp);
  const teamName = (event: MatchEvent) => teams.find(team => team.id === event.teamId)?.name ?? "";
  const confirm = async () => {
    if (!selected || sending.current || locked || !canRecord || cancellationUnavailable(selected, isLive)) return;
    sending.current = true; setWorking(true); setNotice(""); setFailed(false);
    try {
      if (!await onCancel(selected.id)) {
        setFailed(true); setNotice("기록을 취소하지 못했습니다. 저장 상태를 확인한 뒤 다시 시도해주세요."); return;
      }
      setNotice(`${selected.playerName} ${recordingEventLabel(selected)} 취소를 기록했습니다. 수정하려면 선수 기록 화면에서 올바른 기록을 다시 입력해주세요.`);
      setSelectedId("");
    } catch {
      setFailed(true); setNotice("기록을 취소하지 못했습니다. 저장 상태를 확인한 뒤 다시 시도해주세요.");
    } finally { sending.current = false; setWorking(false); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !sending.current) onClose(); }}>
    <MatchDialogContent landscapeFallback={landscapeFallback}>
      <DialogHeader>
        <DialogTitle>기록 수정·취소</DialogTitle>
        <DialogDescription>잘못 입력한 기록을 취소한 뒤 선수 기록 화면에서 올바르게 다시 입력하세요. 골과 어시스트는 각각 확인해주세요.</DialogDescription>
      </DialogHeader>
      {!isLive && <p role="status" className="rounded-lg bg-secondary p-3 text-sm">경기 진행 중에만 수정·취소할 수 있습니다. 종료 후에는 확정 기록을 변경할 수 없습니다.</p>}
      {notice && <p role={failed ? "alert" : "status"} className={`rounded-lg p-3 text-sm ${failed ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-900"}`}>{notice}</p>}
      {selected ? <div className="space-y-3 rounded-lg border p-3">
        <p className="text-sm font-bold">취소할 기록</p>
        <p className="font-semibold">{selected.minute}&apos; {teamName(selected)} · {selected.playerName} {recordingEventLabel(selected)}</p>
        <p className="text-sm text-muted-foreground">{cancellationUnavailable(selected, isLive) ?? cancellationEffect(selected)}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="min-h-11" disabled={locked} onClick={() => setSelectedId("")}>내역으로 돌아가기</Button>
          <Button type="button" variant="destructive" className="min-h-11" disabled={locked || !canRecord || !!cancellationUnavailable(selected, isLive)} onClick={() => void confirm()}>{working ? "취소 기록 중…" : "이 기록 취소 확인"}</Button>
        </div>
      </div> : <ul className="max-h-[45dvh] divide-y overflow-y-auto rounded-lg border" aria-label="수정할 경기 기록">
        {rows.map(event => <li key={event.id} className="flex items-start justify-between gap-3 p-3">
          <div className="min-w-0 text-sm">
            <p className={`font-semibold ${event.isCancelled ? "text-muted-foreground line-through" : ""}`}>{event.minute}&apos; {event.playerName} {recordingEventLabel(event)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{teamName(event)}{event.recorderName && ` · 기록: ${event.recorderName}`}</p>
            {event.isCancelled ? <p className="mt-1 text-xs text-muted-foreground">취소됨</p> : cancellationUnavailable(event, isLive) && <p className="mt-1 text-xs text-muted-foreground">{cancellationUnavailable(event, isLive)}</p>}
          </div>
          {!event.isCancelled && !cancellationUnavailable(event, isLive) && <Button type="button" variant="outline" size="sm" className="min-h-11 shrink-0" disabled={locked || !canRecord}
            aria-label={`${event.playerName} ${recordingEventLabel(event)} 취소 선택`} onClick={() => { setSelectedId(event.id); setNotice(""); }}>취소</Button>}
        </li>)}
        {rows.length === 0 && <li className="p-5 text-center text-sm text-muted-foreground">수정할 선수 기록이 없습니다.</li>}
      </ul>}
      <Button type="button" variant="outline" className="min-h-11" disabled={locked} onClick={onClose}>선수 기록으로 돌아가기</Button>
    </MatchDialogContent>
  </Dialog>;
}
