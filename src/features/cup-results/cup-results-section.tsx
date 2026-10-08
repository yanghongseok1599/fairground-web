import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { FinalStandingsTable } from "@/features/standings/final-standings-table";
import { CupAwardCard } from "./cup-award-card";
import { CupMatchMoms } from "./cup-match-moms";
import { CUP_RESULTS_TOURNAMENT_ID } from "./data";
import type { CupResults } from "./types";

export function CupResultsSection({ results, home = false }: { results: CupResults; home?: boolean }) {
  const champion = results.placements[0];
  return <section id="cup-results" aria-labelledby="cup-results-title" className={home ? "border-b bg-[#F4F7FC] px-5 py-10 md:py-12" : "rounded-2xl bg-[#F4F7FC] p-5 md:p-8"}>
    <div className="mx-auto max-w-6xl space-y-7">
      <div className="rounded-2xl bg-[#0D1B2A] p-6 text-white md:p-8">
        <p className="text-xs font-bold tracking-widest text-[#B9CDF0]">FAIRGROUND CUP 1ST · 2026.10.03 · 대회 종료</p>
        <h2 id="cup-results-title" className="mt-3 text-2xl font-black md:text-3xl" style={{ color: "#FFFFFF" }}>제1회 혼성풋살대회 결과</h2>
        <div className="mt-5 flex items-center gap-3">
          <Trophy className="h-9 w-9 shrink-0 text-[#FFD66B]" aria-hidden="true" />
          <div><p className="text-sm text-[#B9CDF0]">최종 우승</p><p className="text-3xl font-black md:text-4xl">{champion.teamName}</p></div>
        </div>
        <p className="mt-4 text-sm text-[#CFDCEE]">참가해 주신 모든 팀과 선수 여러분, 감사합니다.</p>
      </div>

      <div className="min-w-0">
        <h3 className="mb-3 text-lg font-bold text-[#0D1B2A]">최종 팀 순위</h3>
        <FinalStandingsTable rows={results.placements} withdrawnTeamNames={results.withdrawnTeams.map(team => team.teamName)} />
      </div>

      <div>
        <h3 className="mb-3 text-lg font-bold text-[#0D1B2A]">개인상</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{results.awards.map(award => <CupAwardCard key={award.id} award={award} />)}</div>
        {results.missingMomRounds.length > 0 && <p className="mt-3 rounded-lg border border-[#D9E2EF] bg-white px-4 py-3 text-sm text-[#486581]">
          {results.missingMomRounds.join("·")}경기 MOM 미선정 · 최다 MOM 횟수는 잠정 집계입니다. 여자 MOM은 운영진이 확정한 수상자를 표시합니다.
        </p>}
      </div>

      <details className="rounded-xl border border-[#D9E2EF] bg-white">
        <summary className="cursor-pointer px-5 py-4 text-sm font-bold text-[#0D1B2A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0047AB]">경기별 MOM 전체 보기</summary>
        <CupMatchMoms moms={results.matchMoms} />
      </details>
      {home && <Link href={`/tournaments/${CUP_RESULTS_TOURNAMENT_ID}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#0047AB] px-5 py-3 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0047AB]">전체 경기 결과 보기 <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>}
    </div>
  </section>;
}
