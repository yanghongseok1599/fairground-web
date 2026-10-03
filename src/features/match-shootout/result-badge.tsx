import type { Match } from "@/types";
import { shootoutResultText } from "./model";
import { ShootoutAttemptsSummary } from "./attempts-summary";
import { shootoutAttemptTotals } from "./attempts";

/** 승부차기는 정규 스코어와 분리하여 공개한다. */
export function ShootoutResultBadge({ match, className = "" }: { match: Match; className?: string }) {
  const attempts = match.homeShootoutAttempts && match.awayShootoutAttempts
    ? { home: match.homeShootoutAttempts, away: match.awayShootoutAttempts } : undefined;
  const hasAttempts = attempts && attempts.home.length + attempts.away.length > 0;
  const totals = hasAttempts ? shootoutAttemptTotals(attempts) : undefined;
  const text = hasAttempts && match.status !== "finished"
    ? `승부차기 ${match.status === "live" ? "진행" : "기록"} · O ${totals![0]} : ${totals![1]}`
    : shootoutResultText(match);
  if (!text) return null;
  return <div className={`break-words ${className}`}>
    <p role="status" aria-live="polite" className="text-sm font-bold tabular-nums text-primary">{text}</p>
    {hasAttempts && <ShootoutAttemptsSummary homeName={match.homeTeamName} awayName={match.awayTeamName} attempts={attempts} />}
  </div>;
}
