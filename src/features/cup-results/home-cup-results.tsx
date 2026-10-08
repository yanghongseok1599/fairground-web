"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useMatchResults } from "@/features/match-results/use-match-results";
import { HomeKnockoutSchedule } from "@/features/knockout-schedule/home-knockout-schedule";
import { fetchCupResultSnapshot } from "./api";
import { CUP_RESULTS_TOURNAMENT_ID } from "./data";
import { buildCupResults } from "./model";
import { HomeResultsExplorer } from "./home-results-explorer";

export function HomeCupResults({ onResolved, children }: { onResolved?: (completed: boolean) => void; children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof fetchCupResultSnapshot>> | null>(null);
  const [failed, setFailed] = useState(false);
  useMatchResults({
    key: "home-cup-results", tournamentId: CUP_RESULTS_TOURNAMENT_ID, finalOnly: false,
    load: fetchCupResultSnapshot,
    publish: next => {
      setSnapshot(next); setFailed(false);
      onResolved?.(Boolean(next.tournament && buildCupResults(next.tournament, next.matches, next.players)));
    },
    onError: () => { setFailed(true); if (!snapshot) onResolved?.(false); },
  });
  const results = snapshot?.tournament ? buildCupResults(snapshot.tournament, snapshot.matches, snapshot.players) : null;
  const fallback = failed ? <div className="bg-[#F4F7FC] px-5 py-6 text-center text-sm text-[#486581]">대회 결과를 다시 불러오는 중입니다. <Link className="font-bold text-[#0047AB] underline" href={`/tournaments/${CUP_RESULTS_TOURNAMENT_ID}`}>대회 상세 보기</Link></div> : snapshot?.tournament ? <HomeKnockoutSchedule /> : null;
  return <HomeResultsExplorer results={results} fallback={fallback}>{children}</HomeResultsExplorer>;
}
