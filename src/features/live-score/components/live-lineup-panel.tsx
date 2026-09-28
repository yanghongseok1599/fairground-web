import type { Match, MatchLineupEntry } from "@/types";
import { Loader2, Star } from "lucide-react";

/** 라이브 카드용 라인업 readonly 패널. lazy 데이터 (undefined=미로드, "loading"=로딩중). */
export function LiveLineupPanel({
  match,
  data,
}: {
  match: Match;
  data: MatchLineupEntry[] | "loading" | undefined;
}) {
  if (data === undefined || data === "loading") {
    return (
      <div
        className="flex items-center justify-center py-4 text-xs"
        style={{ color: "var(--muted-foreground)" }}
      >
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        명단을 불러오는 중…
      </div>
    );
  }
  if (data.length === 0) {
    return (
      <p
        className="py-3 text-center text-xs"
        style={{ color: "var(--muted-foreground)" }}
      >
        제출된 라인업이 없습니다
      </p>
    );
  }
  const homeEntries = data.filter((e) => e.teamId === match.homeTeamId);
  const awayEntries = data.filter((e) => e.teamId === match.awayTeamId);
  return (
    <div className="grid grid-cols-2 gap-3">
      <LiveLineupColumn name={match.homeTeamName} entries={homeEntries} />
      <LiveLineupColumn name={match.awayTeamName} entries={awayEntries} />
    </div>
  );
}

function LiveLineupColumn({
  name,
  entries,
}: {
  name: string;
  entries: MatchLineupEntry[];
}) {
  const starters = entries.filter((e) => e.isStarter);
  const subs = entries.filter((e) => !e.isStarter);
  return (
    <div>
      <div className="mb-1.5 truncate text-[11px] font-semibold">{name}</div>
      {entries.length === 0 ? (
        <p
          className="text-[10px]"
          style={{ color: "var(--muted-foreground)" }}
        >
          (미제출)
        </p>
      ) : (
        <>
          {starters.length > 0 && (
            <ul className="mb-1.5 space-y-0.5">
              {starters.map((e) => (
                <li
                  key={e.playerId}
                  className="flex items-center gap-1 text-[11px]"
                >
                  <Star
                    className="h-2.5 w-2.5 shrink-0"
                    style={{
                      color: "var(--accent-gold, var(--primary))",
                      fill: "currentColor",
                    }}
                    aria-hidden
                  />
                  {e.jerseyNumber != null && (
                    <span className="font-bold tabular-nums">
                      #{e.jerseyNumber}
                    </span>
                  )}
                  <span className="truncate">
                    {e.playerName ?? e.playerId.slice(0, 8)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {subs.length > 0 && (
            <>
              <div
                className="mt-1 text-[9px] uppercase tracking-wide"
                style={{ color: "var(--muted-foreground)" }}
              >
                교체
              </div>
              <ul className="space-y-0.5">
                {subs.map((e) => (
                  <li
                    key={e.playerId}
                    className="flex items-center gap-1 text-[10px]"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {e.jerseyNumber != null && (
                      <span className="font-bold tabular-nums">
                        #{e.jerseyNumber}
                      </span>
                    )}
                    <span className="truncate">
                      {e.playerName ?? e.playerId.slice(0, 8)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
