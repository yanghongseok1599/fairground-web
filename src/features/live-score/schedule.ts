import type { LiveMatch, Match, Tournament } from "@/types";
import { isTournamentFixturesPublic } from "@/features/tournaments/public-fixtures";
export { compareScheduledMatches as compareMatchOrder, scheduledMatchTime } from "../../lib/match-schedule.ts";
import { compareScheduledMatches as compareMatchOrder } from "../../lib/match-schedule.ts";

export type ScoreboardMatch = Match & {
  createdAt: number;
  currentHalf: 1 | 2;
  elapsedSeconds: number;
  isRunning: boolean;
};
export interface LiveScoreSnapshot {
  matches: ScoreboardMatch[];
  tournaments: Tournament[];
}
export interface UpcomingMatch {
  match: ScoreboardMatch;
  tournament: Tournament;
  groupName?: string;
}

export function selectLiveScoreboard({ matches, tournaments }: LiveScoreSnapshot) {
  const ordered = [...matches].sort(compareMatchOrder);
  const live = ordered.filter((m): m is ScoreboardMatch & LiveMatch => m.status === "live");
  const upcoming: UpcomingMatch[] = [];
  for (const tournament of tournaments) {
    if (!isTournamentFixturesPublic(tournament) || tournament.status === "completed") continue;
    const current = live.filter((m) => m.tournamentId === tournament.id).at(-1);
    const waiting = ordered.filter((m) => m.tournamentId === tournament.id && m.status === "scheduled"
      && (!current || compareMatchOrder(m, current) > 0));
    const first = waiting[0];
    if (!first) continue;
    // No court field exists in the current schema. Keep simultaneous fixtures visible;
    // never invent a court assignment from the group or the array index.
    const nextSlot = first.scheduledAt > 0
      ? waiting.filter((m) => m.scheduledAt === first.scheduledAt)
      : [first];
    for (const match of nextSlot) upcoming.push({
      match, tournament,
      groupName: tournament.groups.find((g) => g.id === match.groupId)?.name,
    });
  }
  upcoming.sort((a, b) => compareMatchOrder(a.match, b.match));
  const recent = ordered.filter((m) => m.status === "finished").reverse().slice(0, 6);
  return { live, upcoming, recent };
}
