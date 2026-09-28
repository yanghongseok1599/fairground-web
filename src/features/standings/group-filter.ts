import type { TeamStanding, Tournament, TournamentGroup } from "@/types";

export function filterGroupStandings(standings: TeamStanding[], groups: TournamentGroup[], groupId: string) {
  const group = groups.find(item => item.id === groupId);
  if (!group) return standings;
  const teamIds = new Set(group.teamIds);
  // Keep the same points/tiebreak ordering; group ranks start at one.
  return standings.filter(team => teamIds.has(team.teamId)).map((team, index) => ({ ...team, rank: index + 1 }));
}

export function seasonGroupSource(tournaments: Tournament[], seasonId?: string) {
  if (!seasonId) return undefined;
  return tournaments.filter(t => t.seasonId === seasonId && t.groups.length > 0)
    .sort((a, b) => Number(b.status === "ongoing") - Number(a.status === "ongoing") || b.createdAt - a.createdAt)[0];
}
