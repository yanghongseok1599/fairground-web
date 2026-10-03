"use client";

import Link from "next/link";
import { useState } from "react";
import { useMatchResults } from "@/features/match-results/use-match-results";
import { fetchResultMatches } from "@/features/match-results/api";
import { KNOCKOUT_TOURNAMENT_ID, resolveKnockoutFixtures } from "./resolve-knockout-fixtures";
import type { Match } from "@/types";

export function HomeKnockoutSchedule() {
  const [matches, setMatches] = useState<Match[]>([]);
  useMatchResults({
    key: "home-knockout-schedule", tournamentId: KNOCKOUT_TOURNAMENT_ID, finalOnly: false,
    load: () => fetchResultMatches({ tournamentId: KNOCKOUT_TOURNAMENT_ID }),
    publish: setMatches,
  });
  const fixtures = resolveKnockoutFixtures(matches);
  return <section className="border-b bg-[#122B49] px-5 py-8 text-white" aria-labelledby="knockout-title">
    <div className="mx-auto max-w-6xl">
      <p className="text-sm font-bold text-[#8ED9D1]">2026.10.03 · 조별리그 12경기 종료 · A구장</p>
      <h2 id="knockout-title" style={{ color: "#FFFFFF" }} className="mt-2 text-2xl font-black">순위결정전 대진표</h2>
      <p className="mt-2 text-sm text-white/80">출전팀은 시작 5분 전까지 A구장 앞에 집합해 주세요. 시각은 예정이며 현장 진행을 따릅니다.</p>
      <ol className="mt-5 grid gap-3 md:grid-cols-2">
        {fixtures.map(row => <li key={row.slot} className="rounded-xl border border-white/20 bg-white/5 p-4">
          <div className="flex justify-between gap-3 text-sm text-[#8ED9D1]"><span>{row.slot}경기 · {row.stage}</span><time>{row.time}</time></div>
          <p className="mt-2 font-bold">{row.homeLabel} <span className="font-normal text-white/60">vs</span> {row.awayLabel}</p>
          <p className="mt-1 text-xs text-white/70">{row.note ?? `${row.reportTime}까지 집합`}{!row.note && row.status ? ` · ${row.status === "finished" ? "종료" : row.status === "live" ? "진행중" : row.status === "cancelled" ? "취소" : "예정"}` : ""}</p>
        </li>)}
      </ol>
      <div className="mt-5 flex flex-wrap gap-4 text-sm font-bold underline underline-offset-4">
        <Link href="/cup-ops/#matches">조별 순위·운영가이드 보기</Link>
        <a href="/cup-ops/assets/knockout-schedule-20261003.png" download>대진표 이미지 다운로드</a>
      </div>
    </div>
  </section>;
}
