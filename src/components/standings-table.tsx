"use client";

import Image from "next/image";
import type { TeamStanding } from "@/types";

interface StandingsTableProps {
  standings: TeamStanding[];
  limit?: number;
  /**
   * When enabled, the leading rail uses one color for the upper half and
   * another for the lower half. The split label itself stays hidden so the
   * table remains visually quiet.
   */
  showPromotionSplit?: boolean;
}

const COLUMNS = [
  { key: "rank", label: "순위", align: "left" },
  { key: "team", label: "팀명", align: "left" },
  { key: "played", label: "경기수", align: "center" },
  { key: "wins", label: "승", align: "center" },
  { key: "draws", label: "무", align: "center" },
  { key: "losses", label: "패", align: "center" },
  { key: "goalsFor", label: "득점", align: "center" },
  { key: "goalsAgainst", label: "실점", align: "center" },
  { key: "goalDifference", label: "득실차", align: "center" },
  { key: "points", label: "승점", align: "center" },
] as const;

function TeamLogo({ team, size = 36 }: { team: TeamStanding; size?: number }) {
  if (team.teamLogo) {
    return (
      <Image
        src={team.teamLogo}
        alt=""
        width={size}
        height={size}
        className="shrink-0 object-contain"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="grid shrink-0 place-items-center rounded-sm text-[10px] font-black"
      style={{
        width: size,
        height: size,
        background: "var(--color-fg-paper-2)",
        color: "var(--color-fg-ink-dim)",
      }}
      aria-hidden
    >
      {team.teamName.slice(0, 2).toUpperCase()}
    </div>
  );
}

function getRailColor(index: number, upperCount: number) {
  if (upperCount < 0) return "var(--primary)";
  return index < upperCount ? "var(--primary)" : "#27c77a";
}

function getRankColor(index: number, upperCount: number) {
  if (index === 0) return "#ff4050";
  if (upperCount > 0 && index < upperCount) return "var(--primary)";
  return "var(--color-fg-ink-dim)";
}

export function StandingsTable({
  standings,
  limit,
  showPromotionSplit = false,
}: StandingsTableProps) {
  const rows = limit ? standings.slice(0, limit) : standings;
  const upperCount =
    showPromotionSplit && rows.length > 1 ? Math.ceil(rows.length / 2) : -1;

  return (
    <>
      <div
        className="border-y md:hidden"
        style={{
          borderColor: "var(--color-fg-line-soft)",
          background: "var(--color-fg-paper)",
        }}
      >
        <div
          className="grid grid-cols-[30px_minmax(104px,1fr)_30px_24px_24px_24px_36px_34px] items-center gap-1 px-2 py-3 text-[11px] font-black"
          style={{
            color: "var(--color-fg-ink-dim)",
            borderBottom: "1px solid var(--color-fg-paper-3)",
          }}
        >
          <span className="text-center">순위</span>
          <span>팀명</span>
          <span className="text-center">경기</span>
          <span className="text-center">승</span>
          <span className="text-center">무</span>
          <span className="text-center">패</span>
          <span className="text-center">득실</span>
          <span className="text-center">승점</span>
        </div>
        {rows.map((team, index) => {
          const isFirst = index === 0;
          const railColor = getRailColor(index, upperCount);

          return (
            <div
              key={team.teamId}
              className="grid grid-cols-[3px_minmax(0,1fr)]"
              style={{
                borderTop: index === 0 ? "0" : "1px solid var(--color-fg-paper-3)",
                background: isFirst ? "var(--color-fg-paper-2)" : "var(--color-fg-paper)",
              }}
            >
              <div style={{ background: railColor }} aria-hidden />
              <div className="grid min-w-0 grid-cols-[27px_minmax(104px,1fr)_30px_24px_24px_24px_36px_34px] items-center gap-1 px-2 py-3">
                <span
                  className="text-center text-[16px] font-bold leading-none tabular-nums"
                  style={{ color: getRankColor(index, upperCount) }}
                >
                  {index + 1}
                </span>
                <div className="flex min-w-0 items-center gap-2">
                  <TeamLogo team={team} size={24} />
                  <span
                    className="min-w-0 truncate text-[15px] font-black leading-tight"
                    style={{ color: "var(--primary)" }}
                  >
                    {team.teamName}
                  </span>
                </div>
                <span className="text-center text-[13px] font-semibold tabular-nums" style={{ color: "var(--color-fg-ink)" }}>
                  {team.gamesPlayed}
                </span>
                <span className="text-center text-[13px] font-semibold tabular-nums" style={{ color: "var(--color-fg-ink)" }}>
                  {team.wins}
                </span>
                <span className="text-center text-[13px] font-semibold tabular-nums" style={{ color: "var(--color-fg-ink)" }}>
                  {team.draws}
                </span>
                <span className="text-center text-[13px] font-semibold tabular-nums" style={{ color: "var(--color-fg-ink)" }}>
                  {team.losses}
                </span>
                <span className="text-center text-[13px] font-semibold tabular-nums" style={{ color: "var(--color-fg-ink)" }}>
                  {team.goalDifference}
                </span>
                <span className="text-center text-[14px] font-bold tabular-nums" style={{ color: "var(--color-fg-ink)" }}>
                  {team.points}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="hidden w-full max-w-full overflow-x-auto border-y md:block"
        style={{
          borderColor: "var(--color-fg-line-soft)",
          background: "var(--color-fg-paper)",
        }}
      >
        <table className="min-w-[820px] w-full border-collapse text-base" style={{ fontFamily: "var(--font-body)" }}>
        <caption className="sr-only">
          리그 순위표. 정렬 기준: 승점 내림차순.
          {upperCount > 0 && " 왼쪽 색상 막대는 상위 리그와 하위 리그 구간을 구분합니다."}
        </caption>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--color-fg-paper-3)" }}>
            {COLUMNS.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={[
                  "whitespace-nowrap px-4 py-4 text-[14px] font-black sm:text-base",
                  column.align === "left" ? "text-left" : "text-center",
                ].join(" ")}
                style={{ color: "var(--color-fg-ink-dim)" }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((team, index) => {
            const isFirst = index === 0;
            const railColor = getRailColor(index, upperCount);

            return (
              <tr
                key={team.teamId}
                style={{
                  borderTop: index === 0 ? "0" : "1px solid var(--color-fg-paper-3)",
                  background: isFirst ? "var(--color-fg-paper-2)" : "var(--color-fg-paper)",
                }}
              >
                <td
                  className="whitespace-nowrap px-4 py-4 align-middle"
                  style={{ borderLeft: `10px solid ${railColor}` }}
                >
                  <span
                    className="inline-block min-w-8 text-center text-[20px] font-bold tabular-nums"
                    style={{ color: getRankColor(index, upperCount) }}
                  >
                    {index + 1}
                  </span>
                </td>
                <th scope="row" className="min-w-[230px] whitespace-nowrap px-2 py-4 text-left align-middle font-normal">
                  <div className="flex items-center gap-3">
                    <TeamLogo team={team} />
                    <span className="text-[18px] font-black tracking-normal" style={{ color: "var(--primary)" }}>
                      {team.teamName}
                    </span>
                  </div>
                </th>
                <td className="px-4 py-4 text-center text-[17px] font-semibold tabular-nums" style={{ color: "var(--color-fg-ink)" }}>
                  {team.gamesPlayed}
                </td>
                <td className="px-4 py-4 text-center text-[17px] font-semibold tabular-nums" style={{ color: "var(--color-fg-ink)" }}>
                  {team.wins}
                </td>
                <td className="px-4 py-4 text-center text-[17px] font-semibold tabular-nums" style={{ color: "var(--color-fg-ink)" }}>
                  {team.draws}
                </td>
                <td className="px-4 py-4 text-center text-[17px] font-semibold tabular-nums" style={{ color: "var(--color-fg-ink)" }}>
                  {team.losses}
                </td>
                <td className="px-4 py-4 text-center text-[17px] font-semibold tabular-nums" style={{ color: "var(--color-fg-ink)" }}>
                  {team.goalsFor}
                </td>
                <td className="px-4 py-4 text-center text-[17px] font-semibold tabular-nums" style={{ color: "var(--color-fg-ink)" }}>
                  {team.goalsAgainst}
                </td>
                <td className="px-4 py-4 text-center text-[17px] font-semibold tabular-nums" style={{ color: "var(--color-fg-ink)" }}>
                  {team.goalDifference}
                </td>
                <td className="px-4 py-4 text-center text-[17px] font-semibold tabular-nums" style={{ color: "var(--color-fg-ink)" }}>
                  {team.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </>
  );
}
