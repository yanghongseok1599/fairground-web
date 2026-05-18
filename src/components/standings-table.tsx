import type { TeamStanding } from "@/types";

interface StandingsTableProps {
  standings: TeamStanding[];
  limit?: number;
}

export function StandingsTable({ standings, limit }: StandingsTableProps) {
  const rows = limit ? standings.slice(0, limit) : standings;

  return (
    <div className="overflow-x-auto border" style={{ borderColor: "#E5E8EE", background: "#ffffff" }}>
      <table className="w-full text-base">
        <thead>
          <tr style={{ background: "#F4F6FA", borderBottom: "1px solid #E5E8EE" }}>
            {["#", "팀", "경기", "승", "무", "패", "득점", "실점", "득실", "승점"].map((h) => (
              <th
                key={h}
                className="py-4 px-4 fg-label text-center"
                style={{ color: "#7A8496" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((team, i) => {
            const isTop = i === 0;
            const isPodium = i < 3;
            return (
              <tr
                key={team.teamId}
                className="transition-colors"
                style={{
                  borderTop: "1px solid #EAEEF5",
                  background: isTop ? "rgba(27,94,255,0.04)" : "transparent",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(27,94,255,0.06)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = isTop ? "rgba(27,94,255,0.04)" : "transparent"; }}
              >
                <td className="py-4 px-4 text-center">
                  <span
                    className="fg-mono tabular-nums font-bold text-[13px]"
                    style={{ color: isPodium ? "#1B5EFF" : "#7A8496" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </td>
                <td className="py-4 px-5">
                  <div className="flex items-center gap-3">
                    {team.teamLogo ? (
                      <img src={team.teamLogo} alt="" className="w-8 h-8 rounded-sm object-cover" />
                    ) : (
                      <div
                        className="w-8 h-8 grid place-items-center fg-display text-[11px] tracking-wider"
                        style={{
                          background: isPodium ? "#1B5EFF" : "#F4F6FA",
                          color: isPodium ? "#ffffff" : "#7A8496",
                        }}
                      >
                        {team.teamName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span
                      className="fg-display tracking-wider"
                      style={{ color: "#0A1220", fontSize: 15 }}
                    >
                      {team.teamName}
                    </span>
                  </div>
                </td>
                {[team.gamesPlayed, team.wins, team.draws, team.losses, team.goalsFor, team.goalsAgainst, team.goalDifference].map((v, idx) => (
                  <td
                    key={idx}
                    className="py-4 px-4 text-center fg-mono tabular-nums text-[13px]"
                    style={{ color: "#4E5A6B" }}
                  >
                    {v}
                  </td>
                ))}
                <td className="py-4 px-4 text-center">
                  <span
                    className="fg-display fg-mono tabular-nums"
                    style={{
                      fontSize: 22,
                      color: isTop ? "#1B5EFF" : "#0A1220",
                      lineHeight: 1,
                    }}
                  >
                    {team.points}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
