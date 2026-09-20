"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useStore } from "zustand";
import { FlaskConical, Play, RotateCcw, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MatchControlScreen } from "@/features/match-control/match-control-screen";
import { MatchControlStoreContext } from "@/features/match-control/store-context";
import { createPracticeStore } from "./store";
import { readPracticeSnapshot, savePracticeSnapshot } from "./persistence";

type PracticeApi = ReturnType<typeof createPracticeStore>;
const subscribeToHydration = () => () => undefined;

export function MatchSimulationPage() {
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  return hydrated ? <SavedSimulation /> : <p className="p-8 text-center" role="status">테스트 경기를 준비하고 있습니다…</p>;
}

function SavedSimulation() {
  const [initial] = useState(() => {
    try { return { store: createPracticeStore(readPracticeSnapshot(window.sessionStorage)), notice: "" }; }
    catch { return { store: createPracticeStore(), notice: "이전 연습 기록을 불러오지 못해 새 테스트 경기를 준비했습니다." }; }
  });
  const store = initial.store;
  const [storageNotice, setStorageNotice] = useState(initial.notice);
  useEffect(() => store.subscribe(() => {
    try { savePracticeSnapshot(window.sessionStorage, store.getState().snapshot); }
    catch { setStorageNotice("이 브라우저에서는 기록을 보관할 수 없습니다. 현재 화면에서 계속 연습할 수 있습니다."); }
  }), [store]);
  return <SimulationWorkspace store={store} storageNotice={storageNotice} />;
}

function SimulationWorkspace({ store, storageNotice }: { store: PracticeApi; storageNotice: string }) {
  const { snapshot, setSpeed, startAutomatic, stopAutomatic, reset } = useStore(store);
  const [resetOpen, setResetOpen] = useState(false);
  useEffect(() => {
    const timer = window.setInterval(() => store.getState().tick(), 1000);
    return () => window.clearInterval(timer);
  }, [store]);
  const finished = snapshot.match.status === "finished";
  return (
    <MatchControlStoreContext.Provider value={store}>
      <section className="border-b border-blue-200 bg-blue-50 px-4 py-5 text-slate-900">
        <div className="mx-auto max-w-3xl space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-blue-700"><FlaskConical className="h-4 w-4" />실제 기록에 반영되지 않는 연습 경기</div>
          <h1 className="text-2xl font-black">테스트 경기 시뮬레이션</h1>
          <p className="text-sm leading-relaxed text-slate-600">테스트 블루와 레드, 팀당 7명이 준비됐습니다. 아래에서 직접 경기를 시작하거나 자동 진행으로 득점·어시스트·경고를 확인하세요.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button className="min-h-11" onClick={startAutomatic} disabled={finished || snapshot.automatic || snapshot.elapsedSeconds >= 720}><Play className="mr-2 h-4 w-4" />자동 시뮬레이션</Button>
            {snapshot.automatic && <Button variant="outline" className="min-h-11" onClick={stopAutomatic}><Square className="mr-2 h-4 w-4" />자동 진행 중지</Button>}
            <label className="flex min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm">진행 속도
              <select className="min-h-10 bg-transparent font-bold" aria-label="시뮬레이션 진행 속도" value={snapshot.speed} onChange={e => setSpeed(Number(e.target.value))} disabled={finished}>
                <option value={1}>1배</option><option value={10}>10배</option><option value={60}>60배</option>
              </select>
            </label>
            <Button variant="outline" className="min-h-11" onClick={() => setResetOpen(true)}><RotateCcw className="mr-2 h-4 w-4" />새 테스트 경기</Button>
          </div>
          <p className="text-xs leading-relaxed text-slate-600">60배속이면 12초에 경기 시간이 끝납니다. 마지막에는 ‘경기 종료’에서 MOM을 선택하세요. 기록은 이 탭에만 보관되며 새로고침하면 일시정지 상태로 이어집니다.</p>
          {storageNotice && <p role="status" className="text-sm text-amber-800">{storageNotice}</p>}
          {finished && <p role="status" className="rounded-lg bg-white p-3 font-bold">테스트 종료 · {snapshot.match.homeTeamName} {snapshot.match.homeScore} : {snapshot.match.awayScore} {snapshot.match.awayTeamName}</p>}
        </div>
      </section>
      <MatchControlScreen key={snapshot.match.id} matchId={snapshot.match.id} tournamentId={snapshot.match.tournamentId} practice />
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent><DialogHeader><DialogTitle>새 테스트 경기를 개설할까요?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">현재 연습 기록을 지우고 0:0부터 다시 시작합니다.</p>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setResetOpen(false)}>돌아가기</Button><Button onClick={() => { reset(); setResetOpen(false); }}>새 경기 개설</Button></div>
        </DialogContent>
      </Dialog>
    </MatchControlStoreContext.Provider>
  );
}
