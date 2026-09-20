import type { ReactNode } from "react";
import { X } from "lucide-react";

/** A separate strip keeps the scoreboard and substitutes outside the pitch. */
export function FullscreenMatchHeader({ controls, scoreboard, homeBench, awayBench, onClose }: {
  controls: ReactNode;
  scoreboard: ReactNode;
  homeBench: ReactNode;
  awayBench: ReactNode;
  onClose: () => void;
}) {
  return <header className="shrink-0 border-b border-white/15 bg-neutral-950 text-white">
    <div className="relative flex min-h-14 items-center px-14 py-1.5">
      <div className="min-w-0 flex-1">{controls}</div>
      <button type="button" onClick={onClose} aria-label="전체화면 닫기" title="전체화면 닫기"
        className="absolute right-2 top-1.5 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
        <X className="h-6 w-6" aria-hidden="true" />
      </button>
    </div>
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)] items-center gap-3 border-t border-white/10 px-3 py-2" data-slot="fullscreen-match-summary">
      <div className="min-w-0" aria-label="홈팀 상단 대기 선수">{homeBench}</div>
      <div className="min-w-0" aria-label="경기 전광판">{scoreboard}</div>
      <div className="min-w-0" aria-label="원정팀 상단 대기 선수">{awayBench}</div>
    </div>
  </header>;
}
