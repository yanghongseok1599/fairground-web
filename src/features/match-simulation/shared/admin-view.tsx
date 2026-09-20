"use client";

import { useState } from "react";
import { useStore } from "zustand";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { createRoomSession } from "./session";

type Session = ReturnType<typeof createRoomSession>;
const labels: Record<string, string> = { goal: "득점", assist: "어시스트", foul: "반칙", yellow_card: "경고", red_card: "퇴장", substitution: "교체", mom: "MOM" };

export function PracticeAdminView({ session, active, observing = false }: { session: Session; active: boolean; observing?: boolean }) {
  const { snapshot: s } = useStore(session.store);
  const [resetOpen, setResetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const reset = async () => {
    setBusy(true); setError("");
    try { await session.reset(); setResetOpen(false); }
    catch (e) { setError(e instanceof Error ? e.message : "초기화에 실패했습니다."); }
    finally { setBusy(false); }
  };
  const mom = s.players.find(p => p.id === s.match.momPlayerId)?.name;
  return <section className="mx-auto max-w-3xl space-y-5 px-4 py-6" aria-label="관리자 경기 모니터">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-bold">관리자 실시간 모니터</h2>
      <Button variant="outline" disabled={!active} onClick={() => setResetOpen(true)}>{observing ? "초기화는 운영 관리자만 가능" : "현재 경기 초기화"}</Button>
    </div>
    <p className="text-sm text-muted-foreground">심판이 입력한 기록과 교체를 함께 확인합니다. {observing ? "관전 중에는 경기 기록을 변경하지 않습니다." : "현재 경기를 초기화하면 연결된 모든 화면이 0:0부터 다시 시작합니다."}</p>
    <div className="rounded-xl border bg-card p-5 text-center" aria-label="실시간 스코어">
      <div className="grid grid-cols-3 items-center gap-2">
        <div><p className="text-sm font-bold">테스트 블루</p><p className="text-5xl font-black tabular-nums">{s.match.homeScore}</p></div>
        <div><p className="text-2xl font-bold tabular-nums">{String(Math.floor(s.elapsedSeconds / 60)).padStart(2, "0")}:{String(s.elapsedSeconds % 60).padStart(2, "0")}</p><p className="text-xs text-muted-foreground">{s.match.status === "finished" ? "경기 종료" : s.match.status === "scheduled" ? "시작 대기" : s.running ? "진행 중" : "일시정지"}</p></div>
        <div><p className="text-sm font-bold">테스트 레드</p><p className="text-5xl font-black tabular-nums">{s.match.awayScore}</p></div>
      </div>
      {mom && <p className="mt-4 font-bold text-blue-600">MOM · {mom}</p>}
    </div>
    <div className="grid grid-cols-2 gap-3">{[s.match.homeTeamId, s.match.awayTeamId].map((team, side) => <div key={team} className="rounded-xl border p-3">
      <h3 className="mb-2 font-bold">{side ? "테스트 레드" : "테스트 블루"}</h3>
      <ul className="space-y-2 text-sm">{s.lineup.filter(p => p.teamId === team).map(p => <li key={p.playerId} className="flex flex-wrap justify-between gap-1"><span>{p.playerName}</span><span className={p.isStarter ? "font-bold text-blue-600" : "text-muted-foreground"}>{p.isStarter ? "코트" : "벤치"}</span></li>)}</ul>
    </div>)}</div>
    <div className="rounded-xl border p-4">
      <h3 className="mb-3 font-bold">경기 기록 · {s.match.events.filter(e => !e.isCancelled).length}건</h3>
      {s.match.events.length === 0 ? <p className="text-sm text-muted-foreground">심판이 경기를 시작하면 기록이 여기에 나타납니다.</p> : <ol className="max-h-96 space-y-2 overflow-y-auto text-sm">{[...s.match.events].reverse().map(e => <li key={e.id} className={`flex flex-wrap gap-2 border-b pb-2 ${e.isCancelled ? "text-muted-foreground line-through" : ""}`}><span>{e.minute}분</span><strong>{labels[e.type]}</strong><span>{e.playerName}</span>{e.isCancelled && <span>취소됨</span>}</li>)}</ol>}
    </div>
    <Dialog open={resetOpen} onOpenChange={open => { if (!busy) setResetOpen(open); }}>
      <DialogContent><DialogHeader><DialogTitle>함께 새 경기를 시작할까요?</DialogTitle><DialogDescription>심판과 관리자의 현재 연습 기록을 지우고 0:0부터 다시 시작합니다.</DialogDescription></DialogHeader>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setResetOpen(false)} disabled={busy}>돌아가기</Button><Button onClick={reset} disabled={busy || !active}>{busy ? "동기화 중…" : "모든 화면 초기화"}</Button></div>
      </DialogContent>
    </Dialog>
  </section>;
}
