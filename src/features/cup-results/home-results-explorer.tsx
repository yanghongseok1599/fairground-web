"use client";

import { useRef, useState, type ReactNode } from "react";
import { HOME_RESULTS_PANEL_ID, homeResultTabId, type HomeResultTab } from "./home-result-tabs";
import { HomeResultsNavigation } from "./home-results-navigation";
import { HomeResultsPanel } from "./home-results-panel";
import type { CupResults } from "./types";

export function HomeResultsExplorer({ results, children, fallback }: {
  results: CupResults | null;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const [selected, setSelected] = useState<HomeResultTab>("overview");
  const panelRef = useRef<HTMLElement>(null);

  function selectResult(id: HomeResultTab, scrollToResult: boolean) {
    setSelected(id);
    if (scrollToResult) {
      requestAnimationFrame(() => panelRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        block: "start",
      }));
    }
  }

  return (
    <div className="relative isolate">
      {/* Zero-height sticky navigation overlays the video without changing its aspect ratio. */}
      {results && <div className="sticky top-[68px] z-20 h-0 md:top-[76px]">
        <HomeResultsNavigation selected={selected} onSelect={selectResult} />
      </div>}
      {children}
      {results ? (
        <section id="cup-results" ref={panelRef} className="scroll-mt-36 border-b bg-[#F4F7FC] px-5 py-8 md:scroll-mt-40 md:py-10" aria-labelledby="cup-results-title">
          <div
            id={HOME_RESULTS_PANEL_ID}
            role="tabpanel"
            aria-labelledby={homeResultTabId(selected)}
            tabIndex={0}
            className="rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0047AB]"
          >
            <HomeResultsPanel results={results} selected={selected} />
          </div>
        </section>
      ) : fallback}
    </div>
  );
}
