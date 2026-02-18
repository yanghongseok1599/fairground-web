import type { TeamStanding } from "@/types";

interface StandingsTableProps {
  standings: TeamStanding[];
  limit?: number;
}

export function StandingsTable({ standings, limit }: StandingsTableProps) {
  const rows = limit ? standings.slice(0, limit) : standings;

  return (
    <div className="overflow-x-auto rounded-2xl border border-fg-gray-200">
      <table className="w-full text-base">
        <thead>
          <tr style={{ background: "#0D1B2A" }}>
            {["#", "팀", "경기", "승", "무", "패", "득점", "실점", "득실", "승점"].map((h) => (
              <th
                key={h}
                className="py-4 px-4 text-sm font-semibold text-center"
                style={{ color: "#627D98", fontFamily: "var(--font-space-mono)", letterSpacing: "1px" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((team, i) => (
            <tr
              key={team.teamId}
              className="border-t border-fg-gray-200 transition-colors hover:bg-fg-gray-100"
            >
              <td className="py-4 px-4 text-center">
                <span
                  className="text-sm font-bold tabular-nums"
                  style={{
                    color: i < 3 ? "#00C853" : "#627D98",
                    fontFamily: "var(--font-outfit)",
                  }}
                >
                  {i + 1}
                </span>
              </td>
              <td className="py-4 px-5">
                <div className="flex items-center gap-3">
                  {team.teamLogo ? (
                    <img src={team.teamLogo} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-fg-gray-200 flex items-center justify-center text-[10px] font-bold text-fg-gray-500">
                      {team.teamName.slice(0, 2)}
                    </div>
                  )}
                  <span className="font-semibold text-fg-navy text-sm">{team.teamName}</span>
                </div>
              </td>
              {[team.gamesPlayed, team.wins, team.draws, team.losses, team.goalsFor, team.goalsAgainst, team.goalDifference].map((v, idx) => (
                <td key={idx} className="py-4 px-4 text-center tabular-nums text-fg-gray-800 text-sm">{v}</td>
              ))}
              <td className="py-4 px-4 text-center">
                <span
                  className="font-black tabular-nums"
                  style={{ fontFamily: "var(--font-outfit)", fontSize: 17, color: "#0D1B2A" }}
                >
                  {team.points}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
