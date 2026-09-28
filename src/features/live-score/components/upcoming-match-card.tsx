import Link from "next/link";
import { ArrowRight, Clock3, MapPin } from "lucide-react";
import { scheduledMatchTime, type UpcomingMatch } from "../schedule";

export function UpcomingMatchCard({ item }: { item: UpcomingMatch }) {
  const { match, tournament, groupName } = item;
  return (
    <article className="overflow-hidden rounded-xl border border-primary/25 bg-card" aria-label={`${match.homeTeamName} 대 ${match.awayTeamName} 대기 중`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/15 bg-primary/5 px-4 py-3">
        <span className="inline-flex items-center gap-2 text-xs font-bold text-primary"><Clock3 className="h-3.5 w-3.5" />대기 중</span>
        <span className="text-xs text-muted-foreground">{groupName ? `${groupName} · ` : ""}R{match.round}</span>
      </div>
      <div className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{tournament.name}</p>
        <div className="my-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
          <p className="min-w-0 break-words text-base font-bold sm:text-lg">{match.homeTeamName}</p>
          <span className="text-sm font-bold text-muted-foreground">VS</span>
          <p className="min-w-0 break-words text-base font-bold sm:text-lg">{match.awayTeamName}</p>
        </div>
        <p className="text-center text-sm font-semibold text-primary">{scheduledMatchTime(match.scheduledAt)}{match.scheduledAt > 0 ? " 예정" : ""}</p>
        {tournament.location && <p className="mt-2 flex items-center justify-center gap-1 text-center text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0" />{tournament.location}</p>}
        <Link href={`/matches/${match.id}`} className="mt-4 flex min-h-11 items-center justify-center gap-2 rounded-lg border border-primary/30 px-3 text-sm font-bold text-primary">경기 상세 보기<ArrowRight className="h-4 w-4" /></Link>
      </div>
    </article>
  );
}
