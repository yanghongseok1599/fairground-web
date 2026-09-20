"use client";

import type { ReactNode } from "react";
import { Maximize2 } from "lucide-react";
import { FullscreenMatchHeader } from "./fullscreen-match-header";

/** Presentation only: this component has no match mutations or clock ownership. */
export function MatchBroadcastView({ fullscreen, landscapeFallback, onOpen, onClose, scoreboard, homeBench, awayBench, court, practice, online, mom }: {
  fullscreen: boolean; landscapeFallback: boolean; onOpen: () => void; onClose: () => void;
  scoreboard: ReactNode; homeBench: ReactNode; awayBench: ReactNode; court: ReactNode;
  practice: boolean; online: boolean; mom?: string;
}) {
  return <section className={fullscreen ? "fixed inset-0 z-50 overflow-hidden bg-black text-white" : "mx-auto max-w-6xl overflow-hidden rounded-xl bg-neutral-950 text-white"} aria-label="참가자 경기 중계">
    <div className={fullscreen ? "match-landscape-shell flex h-full w-full flex-col bg-black" : "flex flex-col"} style={fullscreen && landscapeFallback ? {
      position: "absolute", left: "50%", top: "50%", width: "100dvh", height: "100dvw", maxWidth: "none", transform: "translate(-50%, -50%) rotate(90deg)", transformOrigin: "center",
    } : undefined}>
      <div className="bg-blue-800 px-3 py-1 text-center text-xs font-bold">{practice ? "테스트 경기 중계 · 실제 기록에 반영되지 않습니다" : "실시간 경기 중계"}</div>
      {!online && <p role="status" className="bg-amber-700 p-2 text-center text-sm">연결이 끊겼습니다. 표시된 기록은 마지막으로 받은 내용입니다.</p>}
      {fullscreen ? <FullscreenMatchHeader controls={<p className="text-center text-xs text-white/70">참가자 중계</p>} scoreboard={scoreboard} homeBench={homeBench} awayBench={awayBench} onClose={onClose} /> : <>
        <div className="flex items-center justify-between px-3 py-2"><h2 className="font-bold">경기장 중계</h2><button type="button" onClick={onOpen} className="flex min-h-11 items-center gap-2 rounded-lg bg-white/10 px-3 text-sm font-bold"><Maximize2 className="h-4 w-4" />전체화면</button></div>
        <div className="px-3 pb-3" aria-label="경기 전광판">{scoreboard}</div>
        <div className="grid grid-cols-2 gap-4 border-t border-white/10 px-3 py-2">{homeBench}{awayBench}</div>
      </>}
      <div className={fullscreen ? "relative min-h-0 flex-1" : "relative aspect-[3/4] w-full md:aspect-[2/1] landscape:aspect-[2/1]"} data-slot="spectator-match-pitch">{court}</div>
      {mom && <p className="bg-neutral-900 p-2 text-center text-sm font-bold">MOM · {mom}</p>}
    </div>
  </section>;
}
