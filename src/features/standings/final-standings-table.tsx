import Link from "next/link";
import { finalRankCardType } from "./final-placements";
import type { FinalPlacement } from "./final-placements";

export function FinalStandingsTable({ rows }: { rows: FinalPlacement[] }) {
  return <div className="overflow-hidden rounded-xl border border-border">
    <table className="w-full text-sm">
      <caption className="border-b bg-muted px-4 py-3 text-left font-bold">대회 최종 순위 · 순위결정전 결과</caption>
      <thead><tr className="border-b text-left"><th className="px-4 py-2">순위</th><th className="px-4 py-2">팀</th><th className="px-4 py-2">선수카드 등급</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.teamId} className="border-b last:border-0">
        <td className="px-4 py-3 font-bold">{row.rank}위</td>
        <td className="px-4 py-3"><Link href={`/teams/${row.teamId}`}>{row.teamName}</Link></td>
        <td className="px-4 py-3">{({ premium: "플래티넘", gold: "골드", silver: "실버", bronze: "브론즈" })[finalRankCardType(row.rank)!]}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}
