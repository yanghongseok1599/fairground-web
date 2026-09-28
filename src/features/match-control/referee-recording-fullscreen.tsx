"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { formatTime } from "@/utils/formatters";

/** The scoreboard never scrolls; only the roster/history below it does. */
export function RefereeRecordingFullscreen({ home, away, elapsed, status, practice, online, controls, roster, history, feedback, onClose }: {
  home: { name: string; score: number };
  away: { name: string; score: number };
  elapsed: number;
  status: string;
  practice: boolean;
  online: boolean;
  controls: ReactNode;
  roster: ReactNode;
  history: ReactNode;
  feedback: ReactNode;
  onClose: () => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Keep keyboard/screen-reader navigation inside the recording screen.
    // Dialog portals created later remain interactive above this screen.
    const background = [...document.body.children].filter((node): node is HTMLElement => node instanceof HTMLElement && node !== rootRef.current);
    const previous = background.map(node => node.inert);
    background.forEach(node => { node.inert = true; });
    closeRef.current?.focus();
    return () => {
      background.forEach((node, index) => { node.inert = previous[index]; });
      requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[data-slot="recording-fullscreen-entry"]')?.focus({ preventScroll: true }));
    };
  }, []);
  const toggleHistory = () => { setShowHistory(value => !value); scrollRef.current?.scrollTo(0, 0); };

  return createPortal(<section ref={rootRef} aria-label="심판 전체화면 기록" className="fixed inset-x-0 top-0 z-50 flex h-dvh flex-col overflow-hidden bg-background text-foreground"
    style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", paddingLeft: "env(safe-area-inset-left)", paddingRight: "env(safe-area-inset-right)" }}>
    <header className="shrink-0 border-b bg-slate-950 px-3 pb-2 pt-2 text-white" data-slot="recording-fixed-header">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_44px] items-center gap-2" aria-label="경기 전광판">
        <div className="min-w-0 text-center"><p className="truncate text-xs font-bold text-blue-200">{home.name}</p><p className="text-3xl font-black tabular-nums" aria-label={`홈 점수 ${home.score}`}>{home.score}</p></div>
        <div className="text-center"><p className="text-[10px] font-bold text-slate-300">{practice ? "테스트 · 심판 기록" : "심판 기록"}</p><p className="text-3xl font-black leading-tight tabular-nums" aria-label="경기시간">{formatTime(elapsed)}</p><p className="text-xs text-slate-300">{status}</p></div>
        <div className="min-w-0 text-center"><p className="truncate text-xs font-bold text-red-200">{away.name}</p><p className="text-3xl font-black tabular-nums" aria-label={`원정 점수 ${away.score}`}>{away.score}</p></div>
        <button ref={closeRef} type="button" aria-label="전체화면 닫기" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 focus-visible:outline-2 focus-visible:outline-white"><X aria-hidden="true" className="h-6 w-6" /></button>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 [&_button]:px-3">
        {controls}
        <button type="button" onClick={toggleHistory} aria-pressed={showHistory} className="min-h-11 rounded-lg border border-white/30 text-sm font-bold">{showHistory ? "선수 기록" : "기록 내역"}</button>
      </div>
      {!online && <p role="status" className="mt-2 text-center text-xs font-bold text-amber-300">연결 끊김 · 기록 입력이 잠겼습니다</p>}
    </header>
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-20" data-slot="recording-scroll-area">
      <div hidden={showHistory}>{roster}</div>
      {showHistory && <section className="py-3 [&_button]:min-h-11" aria-label="전체화면 기록 내역"><h2 className="mb-2 text-lg font-bold">경기 기록 내역</h2>{history}</section>}
    </div>
    {feedback}
  </section>, document.body);
}
