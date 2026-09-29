import type { GroupStanding, Match, TournamentGroup } from "@/types";
import { buildFixtureTimetable, fixtureTimestamp, type FixtureTiming } from "./fixture-timetable.ts";

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
  schedule: FixtureTiming & { date: string; startRound?: number },
): Array<Omit<Match, "id">> {
  const teamMap = new Map(teams.map((team) => [team.id, team]));
  const seen = new Set<string>();
  for (const group of groups) {
    for (const id of group.teamIds) {
      if (!teamMap.has(id)) throw new Error("조 편성에 포함된 팀을 찾을 수 없습니다. 승인 상태를 확인해주세요.");
      if (seen.has(id)) throw new Error("같은 팀이 여러 조에 중복 편성되어 있습니다.");
      seen.add(id);
    }
  }
  const startRound = schedule.startRound ?? 1;
  if (!Number.isInteger(startRound) || startRound < 1) throw new Error("시작 경기 번호를 확인해주세요.");
  return groups.flatMap((group) => buildFixtureTimetable(group.teamIds.length, schedule).map((fixture) => {
    const home = teamMap.get(group.teamIds[fixture.home - 1])!;
    const away = teamMap.get(group.teamIds[fixture.away - 1])!;
    return {
      tournamentId, groupId: group.id, round: startRound + fixture.order - 1,
      homeTeamId: home.id, awayTeamId: away.id,
      homeTeamName: home.name, awayTeamName: away.name,
      homeScore: 0, awayScore: 0, status: "scheduled" as const,
      scheduledAt: fixtureTimestamp(schedule.date, fixture.startMinute), events: [],
    };
  }));
}

export function recommendGroupCount(teamCount: number): number {
  if (teamCount <= 4) return 1;
  if (teamCount <= 8) return 2;
  if (teamCount <= 12) return 3;
  return 4;
}
