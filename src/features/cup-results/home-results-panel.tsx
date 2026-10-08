import Link from "next/link";
import { ArrowUpRight, Trophy } from "lucide-react";
import { FinalStandingsTable } from "@/features/standings/final-standings-table";
import { CupAwardCard } from "./cup-award-card";
import { CupMatchMoms } from "./cup-match-moms";
import { CUP_RESULTS_TOURNAMENT_ID } from "./data";
import { HOME_RESULT_TABS, type HomeResultTab } from "./home-result-tabs";
import type { CupResults } from "./types";

export function HomeResultsPanel({ results, selected }: { results: CupResults; selected: HomeResultTab }) {
  const champion = results.placements[0];
  const award = results.awards.find(item => item.id === selected);
  const label = HOME_RESULT_TABS.find(item => item.id === selected)?.label;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.16em] text-[#486581]">FAIRGROUND CUP 01 · 2026.10.03</p>
          <h2 id="cup-results-title" className="mt-2 text-2xl font-black tracking-tight text-[#0D1B2A] md:text-3xl">{label}</h2>
        </div>
        <Link href={`/tournaments/${CUP_RESULTS_TOURNAMENT_ID}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#C8D8EE] bg-white/80 px-4 text-xs font-bold text-[#0047AB] transition-colors hover:bg-[#E6F0FF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0047AB]">
          전체 경기 보기 <ArrowUpRight size={16} aria-hidden />
        </Link>
      </div>

      {selected === "overview" ? (
        <div className="grid items-start gap-5 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:gap-7">
          {champion && <div className="relative overflow-hidden rounded-3xl bg-[#0047AB] p-7 text-white md:p-8">
            <div className="pointer-events-none absolute -top-12 -right-12 h-48 w-48 rounded-full border border-white/15" aria-hidden />
            <Trophy size={32} strokeWidth={1.5} className="mb-8 text-[#E5F0FF]" aria-hidden />
            <p className="text-xs font-bold tracking-[0.18em] text-[#D2E4FF]">최종 우승</p>
            <p className="mt-3 text-4xl font-black leading-tight tracking-tight md:text-5xl">{champion.teamName}</p>
            <p className="mt-5 text-sm leading-relaxed text-[#E5F0FF]">참가해 주신 모든 팀과 선수 여러분,<br />감사합니다.</p>
            <Link href={`/teams/${champion.teamId}`} className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/40 px-4 text-xs font-bold text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">우승팀 보기 <ArrowUpRight size={15} aria-hidden /></Link>
          </div>}
          <div className="min-w-0">
            <h3 className="mb-3 text-sm font-bold text-[#0D1B2A]">최종 팀 순위</h3>
            <FinalStandingsTable rows={results.placements} withdrawnTeamNames={results.withdrawnTeams.map(team => team.teamName)} />
          </div>
        </div>
      ) : selected === "match-moms" ? (
        <div className="overflow-hidden rounded-3xl border border-[#D9E2EF] bg-white">
          <CupMatchMoms moms={results.matchMoms} />
        </div>
      ) : award ? (
        <CupAwardCard award={award} featured />
      ) : (
        <p className="rounded-2xl border border-[#D9E2EF] bg-white p-6 text-sm text-[#486581]">수상 기록을 확인 중입니다.</p>
      )}

      {(selected === "mens-mom" || selected === "match-moms") && results.missingMomRounds.length > 0 && (
        <p className="mt-4 rounded-2xl border border-[#D9E2EF] bg-white/80 px-5 py-4 text-sm leading-relaxed text-[#486581]">
          {results.missingMomRounds.join("·")}경기 MOM 미선정 · 최다 MOM 횟수는 잠정 집계입니다. 여자 MOM은 운영진이 확정한 수상자를 표시합니다.
        </p>
      )}
    </div>
  );
}
