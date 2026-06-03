import type { GroupStanding, Match, TournamentGroup } from "@/types";

export interface AutoMatchTeam {
  id: string;
  name: string;
  points?: number;
  goalDifference?: number;
  goalsFor?: number;
}

const GROUP_NAMES = ["A", "B", "C", "D", "E", "F", "G", "H"];

function emptyStanding(team: AutoMatchTeam): GroupStanding {
  return {
    teamId: team.id,
    teamName: team.name,
    points: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    gamesPlayed: 0,
  };
}

export function buildAutoGroups(teams: AutoMatchTeam[], groupCount: number): TournamentGroup[] {
  const safeGroupCount = Math.max(1, Math.min(groupCount, teams.length || 1));
  const seededTeams = [...teams].sort(
    (a, b) =>
      (b.points ?? 0) - (a.points ?? 0) ||
      (b.goalDifference ?? 0) - (a.goalDifference ?? 0) ||
      (b.goalsFor ?? 0) - (a.goalsFor ?? 0) ||
      a.name.localeCompare(b.name, "ko")
  );

  const buckets: AutoMatchTeam[][] = Array.from({ length: safeGroupCount }, () => []);
  seededTeams.forEach((team, index) => {
    const block = Math.floor(index / safeGroupCount);
    const offset = index % safeGroupCount;
    const target = block % 2 === 0 ? offset : safeGroupCount - 1 - offset;
    buckets[target].push(team);
  });

  return buckets.map((bucket, index) => ({
    id: `group-${GROUP_NAMES[index].toLowerCase()}`,
    name: `${GROUP_NAMES[index]}조`,
    teamIds: bucket.map((team) => team.id),
    standings: bucket.map(emptyStanding),
  }));
}

export function buildGroupRoundRobinMatches(
  groups: TournamentGroup[],
  teams: AutoMatchTeam[],
  tournamentId: string,
  startRound = 1,
): Array<Omit<Match, "id">> {
  const teamMap = new Map(teams.map((team) => [team.id, team]));
  const matches: Array<Omit<Match, "id">> = [];

  for (const group of groups) {
    let round = startRound;
    for (let i = 0; i < group.teamIds.length; i += 1) {
      for (let j = i + 1; j < group.teamIds.length; j += 1) {
        const homeTeamId = group.teamIds[i];
        const awayTeamId = group.teamIds[j];
        const homeTeam = teamMap.get(homeTeamId);
        const awayTeam = teamMap.get(awayTeamId);
        if (!homeTeam || !awayTeam) continue;
        matches.push({
          tournamentId,
          groupId: group.id,
          round,
          homeTeamId,
          awayTeamId,
          homeTeamName: homeTeam.name,
          awayTeamName: awayTeam.name,
          homeScore: 0,
          awayScore: 0,
          status: "scheduled",
          scheduledAt: Date.now(),
          events: [],
        });
        round += 1;
      }
    }
  }

  return matches;
}

export function recommendGroupCount(teamCount: number): number {
  if (teamCount <= 4) return 1;
  if (teamCount <= 8) return 2;
  if (teamCount <= 12) return 3;
  return 4;
}
