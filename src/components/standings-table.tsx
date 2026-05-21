import { Fragment } from "react";
import Image from "next/image";
import type { TeamStanding } from "@/types";

interface StandingsTableProps {
  standings: TeamStanding[];
  limit?: number;
  /**
   * Show the promotion / relegation split line at the top 50% boundary.
   * Off for the compact landing preview (limited rows make a split noise).
   */
  showPromotionSplit?: boolean;
}

const COLUMNS: { key: string; label: string; long: string }[] = [
  { key: "rank", label: "#", long: "순위" },
  { key: "team", label: "팀", long: "팀" },
  { key: "gp", label: "경기", long: "경기 수" },
  { key: "w", label: "승", long: "승" },
  { key: "d", label: "무", long: "무" },
  { key: "l", label: "패", long: "패" },
  { key: "gf", label: "득점", long: "득점" },
  { key: "ga", label: "실점", long: "실점" },
  { key: "gd", label: "득실", long: "득실차" },
  { key: "pts", label: "승점", long: "승점" },
];

export function StandingsTable({
  standings,
  limit,
  showPromotionSplit = false,
}: StandingsTableProps) {
  const rows = limit ? standings.slice(0, limit) : standings;
  // Upper league = top half (ceil so an odd count keeps the extra team up).
  const upperCount =
    showPromotionSplit && rows.length > 1 ? Math.ceil(rows.length / 2) : -1;

  return (
    <div
      className="overflow-x-auto border"
      style={{
        borderColor: "var(--color-fg-line-soft)",
        background: "var(--color-fg-paper)",
      }}
    >
      <table className="w-full text-base" style={{ fontFamily: "var(--font-body)" }}>
        <caption className="sr-only">
          리그 순위표. 정렬 기준: 승점 내림차순.
          {upperCount > 0 && " 상위 절반은 다음 시즌 상위 리그, 하위 절반은 하위 리그로 배정됩니다."}
        </caption>
        <thead>
          <tr
            style={{
              background: "var(--color-fg-paper-2)",
              borderBottom: "1px solid var(--color-fg-line-soft)",
            }}
          >
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                scope="col"
                className="py-4 px-4 fg-label text-center"
                style={{ color: "var(--color-fg-ink-dim)" }}
              >
                {c.label}
                <span className="sr-only"> ({c.long})</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((team, i) => {
            const isTop = i === 0;
            const isUpper = upperCount > 0 && i < upperCount;
            // Visible boundary row right before the first lower-league team.
            const isSplitBoundary = upperCount > 0 && i === upperCount;
            return (
              <Fragment key={team.teamId}>
                {isSplitBoundary && (
                  <tr aria-hidden="true">
                    <td colSpan={COLUMNS.length} className="p-0">
                      <div
                        className="flex items-center gap-3 px-4 py-2"
                        style={{
                          background: "color-mix(in srgb, var(--color-fg-ink-dim) 8%, transparent)",
                          borderTop: "2px solid var(--color-fg-ink-dim)",
                          borderBottom: "1px solid var(--color-fg-paper-3)",
                        }}
                      >
                        <span
                          className="fg-label"
                          style={{ color: "var(--color-fg-ink-muted)" }}
                        >
                          ▼ 하위 리그 (LOWER LEAGUE)
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
                <tr
                  className="transition-colors"
                  style={{
                    borderTop: "1px solid var(--color-fg-paper-3)",
                    background: isTop
                      ? "color-mix(in srgb, var(--primary) 4%, transparent)"
                      : "transparent",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "color-mix(in srgb, var(--primary) 6%, transparent)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = isTop ? "color-mix(in srgb, var(--primary) 4%, transparent)" : "transparent"; }}
                >
                  <td className="py-4 px-4 text-center">
                    <span
                      className="tabular-nums font-bold text-[13px]"
                      style={{
                        color: isUpper ? "var(--primary)" : "var(--color-fg-ink-dim)",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </td>
                  <th scope="row" className="py-4 px-5 text-left font-normal">
                    <div className="flex items-center gap-3">
                      {team.teamLogo ? (
                        <Image
                          src={team.teamLogo}
                          alt=""
                          width={32}
                          height={32}
                          className="w-8 h-8 rounded-sm object-contain bg-[var(--color-fg-paper)]"
                        />
                      ) : (
                        <div
                          className="w-8 h-8 grid place-items-center text-[11px] tracking-wider"
                          style={{
                            background: isUpper ? "var(--primary)" : "var(--color-fg-paper-2)",
                            color: isUpper ? "var(--primary-foreground)" : "var(--color-fg-ink-dim)",
                            fontFamily: "var(--font-body)",
                            fontWeight: 800,
                          }}
                          aria-hidden
                        >
                          {team.teamName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span
                        className="tracking-wider"
                        style={{
                          color: "var(--color-fg-ink)",
                          fontSize: 15,
                          fontFamily: "var(--font-body)",
                          fontWeight: 700,
                        }}
                      >
                        {team.teamName}
                      </span>
                      {upperCount > 0 && (
                        <span
                          className="fg-label text-[9px] px-1.5 py-0.5"
                          style={{
                            color: isUpper ? "var(--primary)" : "var(--color-fg-ink-dim)",
                            border: `1px solid ${isUpper ? "color-mix(in srgb, var(--primary) 40%, transparent)" : "var(--color-fg-line-soft)"}`,
                            background: isUpper ? "color-mix(in srgb, var(--primary) 6%, transparent)" : "transparent",
                          }}
                        >
                          {isUpper ? "상위" : "하위"}
                        </span>
                      )}
                    </div>
                  </th>
                  {[team.gamesPlayed, team.wins, team.draws, team.losses, team.goalsFor, team.goalsAgainst, team.goalDifference].map((v, idx) => (
                    <td
                      key={idx}
                      className="py-4 px-4 text-center tabular-nums text-[13px]"
                      style={{
                        color: "var(--color-fg-ink-muted)",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      {v}
                    </td>
                  ))}
                  <td className="py-4 px-4 text-center">
                    <span
                      className="tabular-nums"
                      style={{
                        fontSize: 22,
                        color: isTop ? "var(--primary)" : "var(--color-fg-ink)",
                        lineHeight: 1,
                        fontFamily: "var(--font-body)",
                        fontWeight: 800,
                      }}
                    >
                      {team.points}
                    </span>
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
