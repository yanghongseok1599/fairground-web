import type { Match, MatchLineupEntry, Player, Position } from "@/types";

export const PRACTICE_TOURNAMENT_ID = "practice-tournament";
export const PRACTICE_HOME_ID = "practice-blue";
export const PRACTICE_AWAY_ID = "practice-red";

export function createPracticeFixture(id: string, now: number) {
  const positions: Position[] = ["GK", "FIXO", "ALA", "ALA", "PIVO", "ALA", "PIVO"];
  const players: Player[] = [PRACTICE_HOME_ID, PRACTICE_AWAY_ID].flatMap((teamId, side) =>
    positions.map((position, index) => ({
      id: `${teamId}-${index + 1}`, uid: `${teamId}-${index + 1}`,
      name: `${side ? "레드" : "블루"} ${index + 1}번`, number: index + 1, position,
      teamId, teamName: side ? "테스트 레드" : "테스트 블루", nationality: "KOR",
      photoUrl: "", cardType: "bronze", cardRating: 70,
      stats: { goals: 0, assists: 0, games: 0, mom: 0 }, badges: [],
      penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 },
      isApproved: true, role: "player", createdAt: now,
    })),
  );
  const match: Match = {
    id, tournamentId: PRACTICE_TOURNAMENT_ID, round: 1,
    homeTeamId: PRACTICE_HOME_ID, awayTeamId: PRACTICE_AWAY_ID,
    homeTeamName: "테스트 블루", awayTeamName: "테스트 레드",
    homeScore: 0, awayScore: 0, status: "scheduled", scheduledAt: now, events: [],
  };
  const lineup: MatchLineupEntry[] = players.map(p => ({
    matchId: id, teamId: p.teamId, playerId: p.id, playerName: p.name,
    isStarter: p.number <= 5, jerseyNumber: p.number, createdAt: now,
  }));
  return { match, players, lineup };
}
