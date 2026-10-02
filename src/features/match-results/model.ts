import type { Database } from "@/lib/database.types";
import type { Player, Team, TeamSeasonStats, TeamStanding, Match } from "@/types";

export const PLAYER_RESULT_COLUMNS = "id,card_type,card_rating,goals,assists,games,mom,badges,is_banned,ban_matches_remaining,season_yellow_cards,attendance_streak,attendance_streak_best";
export const TEAM_RESULT_COLUMNS = "id,name,season_stats,league_tier,participation_streak";
export const LEADERBOARD_RESULT_COLUMNS = "id,name,number,number_label,position,team_id,nationality,card_type,card_skin,card_rating,goals,assists,games,mom,badges,is_banned,ban_matches_remaining,season_yellow_cards,attendance_streak,attendance_streak_best,is_approved,role,created_at";

type ProfileRow = Database["public"]["Views"]["public_player_profiles"]["Row"];
export type PlayerResult = Pick<ProfileRow, "id" | "card_type" | "card_rating" | "goals" | "assists" | "games" | "mom" | "badges" | "is_banned" | "ban_matches_remaining" | "season_yellow_cards" | "attendance_streak" | "attendance_streak_best">;
export type TeamResult = Pick<Database["public"]["Tables"]["teams"]["Row"], "id" | "name" | "season_stats" | "league_tier" | "participation_streak">;
export type LeaderboardResult = PlayerResult & Pick<ProfileRow, "name" | "number" | "number_label" | "position" | "team_id" | "nationality" | "card_skin" | "is_approved" | "role" | "created_at">;
export type LeaderboardCategory = "goals" | "assists" | "mom" | "games" | "streak" | "rating";

/** Merge only earned results. Never overwrite photos, consent, profile edits or roles. */
export function mergePlayerResult(player: Player, result: PlayerResult): Player {
  if (player.id !== result.id) return player;
  const patch = {
    cardType: result.card_type,
    cardRating: result.card_rating,
    stats: { goals: result.goals, assists: result.assists, games: result.games, mom: result.mom },
    badges: result.badges,
    penaltyStatus: { isBanned: result.is_banned, banMatchesRemaining: result.ban_matches_remaining, seasonYellowCards: result.season_yellow_cards },
    attendanceStreak: result.attendance_streak,
    attendanceStreakBest: result.attendance_streak_best,
  };
  const unchanged = (Object.keys(patch) as Array<keyof typeof patch>)
    .every(key => JSON.stringify(player[key]) === JSON.stringify(patch[key]));
  return unchanged ? player : { ...player, ...patch };
}

export function leaderboardResultPlayer(result: LeaderboardResult, existing?: Player): Player {
  if (existing?.id === result.id) return mergePlayerResult(existing, result);
  return mergePlayerResult({
    id: result.id, uid: result.id, name: result.name, number: result.number, numberLabel: result.number_label,
    position: result.position, teamId: result.team_id ?? "", nationality: result.nationality,
    photoUrl: "", cardType: result.card_type, cardSkin: result.card_skin, cardRating: result.card_rating,
    stats: { goals: 0, assists: 0, games: 0, mom: 0 }, badges: [],
    penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 },
    isApproved: result.is_approved, role: result.role, createdAt: Date.parse(result.created_at),
  }, result);
}

export function teamResultStats(result: TeamResult): TeamSeasonStats {
  return { points: 0, rank: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, gamesPlayed: 0,
    ...(result.season_stats as Partial<TeamSeasonStats>) };
}

export function mergeTeamResult(team: Team, result: TeamResult): Team {
  if (team.id !== result.id) return team;
  const patch = { seasonStats: teamResultStats(result), leagueTier: result.league_tier, participationStreak: result.participation_streak };
  return JSON.stringify(patch) === JSON.stringify({ seasonStats: team.seasonStats, leagueTier: team.leagueTier, participationStreak: team.participationStreak })
    ? team : { ...team, ...patch };
}

export function resultStandings(results: TeamResult[], existing: TeamStanding[]): TeamStanding[] {
  const logos = new Map(existing.map(row => [row.teamId, row.teamLogo]));
  return results.map(row => {
    const stats = teamResultStats(row);
    return { ...stats, teamId: row.id, teamName: row.name, teamLogo: logos.get(row.id) ?? "", matchPoints: stats.points, participationBonus: 0 };
  }).sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.rank - b.rank || a.teamName.localeCompare(b.teamName));
}

export function isFinalResultChange(payload: { new?: unknown; old?: unknown }): boolean {
  const current = payload.new as { status?: string } | undefined;
  const previous = payload.old as { status?: string } | undefined;
  return current?.status === "finished" || current?.status === "cancelled" || previous?.status === "finished";
}

// 종료 경기로 대회 승점표 집계 (승 3 · 무 1 · 패 0).
export function tournamentResultStandings(matches: Match[]): TeamStanding[] {
  const acc = new Map<string, TeamStanding>();
  const ensure = (teamId: string, teamName: string): TeamStanding => {
    let s = acc.get(teamId);
    if (!s) {
      s = {
        teamId,
        teamName,
        teamLogo: "",
        points: 0,
        matchPoints: 0,
        participationBonus: 0,
        rank: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        gamesPlayed: 0,
      };
      acc.set(teamId, s);
    } else if (teamName && s.teamName !== teamName) {
      s.teamName = teamName;
    }
    return s;
  };

  for (const m of matches) {
    if (m.status !== "finished") continue;
    const home = ensure(m.homeTeamId, m.homeTeamName);
    const away = ensure(m.awayTeamId, m.awayTeamName);
    home.gamesPlayed += 1;
    away.gamesPlayed += 1;
    home.goalsFor += m.homeScore;
    home.goalsAgainst += m.awayScore;
    away.goalsFor += m.awayScore;
    away.goalsAgainst += m.homeScore;
    if (m.homeScore > m.awayScore) {
      home.wins += 1; away.losses += 1; home.matchPoints += 3;
    } else if (m.homeScore < m.awayScore) {
      away.wins += 1; home.losses += 1; away.matchPoints += 3;
    } else {
      home.draws += 1; away.draws += 1; home.matchPoints += 1; away.matchPoints += 1;
    }
  }

  const rows = [...acc.values()].map((s) => ({
    ...s,
    goalDifference: s.goalsFor - s.goalsAgainst,
    points: s.matchPoints,
  }));
  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDifference - a.goalDifference ||
      b.goalsFor - a.goalsFor ||
      a.teamName.localeCompare(b.teamName),
  );
  rows.forEach((s, i) => { s.rank = i + 1; });
  return rows;
}
