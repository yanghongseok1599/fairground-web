import { Award } from "lucide-react";
import type { CupAward } from "./types";

export function CupAwardCard({ award, featured = false }: { award: CupAward; featured?: boolean }) {
  return <article className={featured
    ? "min-w-0 rounded-2xl border border-[#B9CDF0] bg-white p-6 md:p-8"
    : "min-w-0 rounded-xl border border-[#D9E2EF] bg-white p-5"}>
    <div className="flex items-center gap-2 text-[#0047AB]">
      <Award className={featured ? "h-5 w-5 shrink-0" : "h-4 w-4 shrink-0"} aria-hidden="true" />
      <h3 className={featured ? "text-base font-bold md:text-lg" : "text-sm font-bold"} style={{ color: "#0047AB" }}>{award.title}</h3>
    </div>
    {award.winners.length ? award.winners.map(winner => <div key={winner.playerId ?? winner.teamId} className={featured ? "mt-6" : "mt-4"}>
      <p className="text-sm text-[#486581]">{winner.teamName}</p>
      <p className={featured
        ? "mt-2 break-words text-3xl font-black leading-tight tracking-tight text-[#0D1B2A] md:text-5xl"
        : "mt-1 text-xl font-black text-[#0D1B2A]"}>{winner.playerName ?? (award.id === "goalkeeper" ? "골레이로" : "선수 확인 중")}</p>
      {winner.count !== undefined && <p className={featured ? "mt-3 text-base font-bold text-[#0047AB]" : "mt-2 text-sm font-bold text-[#0047AB]"}>
        {winner.count}{award.id === "top-scorer" ? "골" : "회 선정"}
      </p>}
      {award.id !== "top-scorer" && winner.rounds.length > 0 && <p className="mt-1 text-xs text-[#486581]">{winner.rounds.join("·")}경기 MOM</p>}
    </div>) : <p className="mt-4 text-sm text-[#486581]">기록 확인 중</p>}
    {award.status === "name-pending" && <p className="mt-3 text-xs text-[#486581]">수상 선수명 확인 중</p>}
    {award.status === "provisional" && <p className="mt-3 text-xs text-[#486581]">현재 경기 기록 기준 · 잠정 집계</p>}
    {award.id === "womens-mom" && award.status === "confirmed" && <p className="mt-3 text-xs text-[#486581]">운영진 확정 수상자</p>}
  </article>;
}
