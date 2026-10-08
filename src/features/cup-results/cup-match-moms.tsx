import type { CupMatchMom } from "./types";

export function CupMatchMoms({ moms }: { moms: CupMatchMom[] }) {
  return <ol className="grid gap-x-6 gap-y-3 border-t border-[#D9E2EF] p-5 sm:grid-cols-2">
    {moms.map(mom => <li key={mom.round} className="flex min-w-0 gap-3 text-sm">
      <span className="w-12 shrink-0 font-bold text-[#0047AB]">{mom.round}경기</span>
      <span className="text-[#0D1B2A]">{mom.status === "cancelled" ? "양팀 기권 · 미실시" : mom.status === "missing" ? "MOM 미선정" : `${mom.teamName ? `[${mom.teamName}] ` : ""}${mom.playerName ?? "선수 확인 중"}`}</span>
    </li>)}
  </ol>;
}
