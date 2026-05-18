// Supabase profiles row(snake_case, flat) <-> 앱 Player(camelCase, nested) 매퍼.
// Firebase RTDB → Supabase 마이그레이션의 경계 어댑터.
// 단일 출처: authStore/dataStore가 공통 사용 (드리프트 D-E 방지).
import type {
  Player,
  Team,
  TeamSeasonStats,
  Match,
  LiveMatch,
  MatchEvent,
  Tournament,
  TournamentGroup,
  Season,
} from "@/types";
import type { Database } from "@/lib/database.types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
type TeamRow = Database["public"]["Tables"]["teams"]["Row"];
type TeamInsert = Database["public"]["Tables"]["teams"]["Insert"];
type TeamUpdate = Database["public"]["Tables"]["teams"]["Update"];
type MatchRow = Database["public"]["Tables"]["matches"]["Row"];
type MatchEventRow = Database["public"]["Tables"]["match_events"]["Row"];
type MatchEventInsert = Database["public"]["Tables"]["match_events"]["Insert"];
type TournamentRow = Database["public"]["Tables"]["tournaments"]["Row"];
type SeasonRow = Database["public"]["Tables"]["seasons"]["Row"];

const ts = (s: string | null): number => (s ? new Date(s).getTime() : 0);

export function rowToPlayer(r: ProfileRow): Player {
  return {
    id: r.id,
    uid: r.id,
    name: r.name,
    number: r.number,
    position: r.position,
    teamId: r.team_id ?? "",
    nationality: r.nationality,
    photoUrl: r.photo_url,
    profilePhotoUrl: r.profile_photo_url ?? undefined,
    photoScale: r.photo_scale ?? undefined,
    photoOffsetX: r.photo_offset_x ?? undefined,
    cardType: r.card_type,
    cardRating: r.card_rating,
    stats: { goals: r.goals, assists: r.assists, games: r.games, mom: r.mom },
    badges: r.badges,
    penaltyStatus: {
      isBanned: r.is_banned,
      banMatchesRemaining: r.ban_matches_remaining,
      seasonYellowCards: r.season_yellow_cards,
    },
    isApproved: r.is_approved,
    role: r.role,
    phone: r.phone ?? undefined,
    createdAt: new Date(r.created_at).getTime(),
  };
}

// 신규 프로필 INSERT. is_approved/role 은 의도적으로 생략 → DB 기본값(false/'player').
// RLS 특권컬럼 트리거가 클라이언트의 role 자가지정을 차단(D-C 해결)하므로 안전.
export function playerToInsert(p: Player): ProfileInsert {
  return {
    id: p.id,
    name: p.name,
    number: p.number,
    position: p.position,
    team_id: p.teamId || null,
    nationality: p.nationality,
    photo_url: p.photoUrl,
    profile_photo_url: p.profilePhotoUrl ?? null,
    photo_scale: p.photoScale ?? null,
    photo_offset_x: p.photoOffsetX ?? null,
    card_type: p.cardType,
    card_rating: p.cardRating,
    goals: p.stats.goals,
    assists: p.stats.assists,
    games: p.stats.games,
    mom: p.stats.mom,
    is_banned: p.penaltyStatus.isBanned,
    ban_matches_remaining: p.penaltyStatus.banMatchesRemaining,
    season_yellow_cards: p.penaltyStatus.seasonYellowCards,
    badges: p.badges,
    phone: p.phone ?? null,
  };
}

// 부분 수정 → row 패치. role/is_approved/통계는 매핑하지 않는다
// (RLS 트리거가 비admin의 변경을 거부 — 의도된 권한 경계).
export function playerPatchToRow(d: Partial<Player>): ProfileUpdate {
  const u: ProfileUpdate = {};
  if (d.name !== undefined) u.name = d.name;
  if (d.number !== undefined) u.number = d.number;
  if (d.position !== undefined) u.position = d.position;
  if (d.teamId !== undefined) u.team_id = d.teamId || null;
  if (d.nationality !== undefined) u.nationality = d.nationality;
  if (d.photoUrl !== undefined) u.photo_url = d.photoUrl;
  if (d.profilePhotoUrl !== undefined) u.profile_photo_url = d.profilePhotoUrl ?? null;
  if (d.photoScale !== undefined) u.photo_scale = d.photoScale ?? null;
  if (d.photoOffsetX !== undefined) u.photo_offset_x = d.photoOffsetX ?? null;
  if (d.cardType !== undefined) u.card_type = d.cardType;
  if (d.badges !== undefined) u.badges = d.badges;
  if (d.phone !== undefined) u.phone = d.phone ?? null;
  return u;
}

// ===== Team =====
const EMPTY_TEAM_STATS: TeamSeasonStats = {
  points: 0, rank: 0, wins: 0, draws: 0, losses: 0,
  goalsFor: 0, goalsAgainst: 0, goalDifference: 0, gamesPlayed: 0,
};

export function rowToTeam(r: TeamRow): Team {
  return {
    id: r.id,
    name: r.name,
    logo: r.logo,
    isApproved: r.is_approved,
    captainId: r.captain_id ?? undefined,
    foundedYear: r.founded_year ?? undefined,
    memberCount: r.member_count,
    seasonStats: (r.season_stats as unknown as TeamSeasonStats) ?? EMPTY_TEAM_STATS,
    createdAt: ts(r.created_at),
  };
}

export function teamToInsert(t: Omit<Team, "id"> & { id?: string }): TeamInsert {
  return {
    ...(t.id ? { id: t.id } : {}),
    name: t.name,
    logo: t.logo ?? "",
    is_approved: t.isApproved ?? false,
    captain_id: t.captainId ?? null,
    founded_year: t.foundedYear ?? null,
    member_count: t.memberCount ?? 0,
    season_stats: (t.seasonStats ?? EMPTY_TEAM_STATS) as unknown as TeamInsert["season_stats"],
  };
}

export function teamPatchToRow(d: Partial<Team>): TeamUpdate {
  const u: TeamUpdate = {};
  if (d.name !== undefined) u.name = d.name;
  if (d.logo !== undefined) u.logo = d.logo;
  if (d.isApproved !== undefined) u.is_approved = d.isApproved;
  if (d.captainId !== undefined) u.captain_id = d.captainId ?? null;
  if (d.foundedYear !== undefined) u.founded_year = d.foundedYear ?? null;
  if (d.memberCount !== undefined) u.member_count = d.memberCount;
  if (d.seasonStats !== undefined) u.season_stats = d.seasonStats as unknown as TeamUpdate["season_stats"];
  return u;
}

// ===== MatchEvent =====
export function rowToEvent(r: MatchEventRow): MatchEvent {
  return {
    id: r.id,
    type: r.type,
    playerId: r.player_id ?? "",
    playerName: r.player_name,
    teamId: r.team_id ?? "",
    minute: r.minute,
    half: (r.half === 2 ? 2 : 1) as 1 | 2,
    timestamp: ts(r.created_at),
    isCancelled: r.is_cancelled,
  };
}

export function eventToInsert(
  matchId: string,
  e: { type: MatchEvent["type"]; playerId: string; playerName: string; teamId: string; minute: number; half: 1 | 2 },
): MatchEventInsert {
  return {
    match_id: matchId,
    type: e.type,
    player_id: e.playerId || null,
    player_name: e.playerName,
    team_id: e.teamId || null,
    minute: e.minute,
    half: e.half,
  };
}

// ===== Match (events 는 별도 조회해 주입) =====
export function rowToMatch(r: MatchRow, events: MatchEvent[] = []): Match {
  return {
    id: r.id,
    tournamentId: r.tournament_id ?? "",
    groupId: r.group_id ?? undefined,
    round: r.round,
    homeTeamId: r.home_team_id ?? "",
    awayTeamId: r.away_team_id ?? "",
    homeTeamName: r.home_team_name,
    awayTeamName: r.away_team_name,
    homeScore: r.home_score,
    awayScore: r.away_score,
    status: r.status,
    scheduledAt: ts(r.scheduled_at),
    events,
    momPlayerId: r.mom_player_id ?? undefined,
  };
}

export function rowToLiveMatch(r: MatchRow, events: MatchEvent[] = []): LiveMatch {
  return {
    ...rowToMatch(r, events),
    status: "live",
    currentHalf: (r.current_half === 2 ? 2 : 1) as 1 | 2,
    elapsedSeconds: r.elapsed_seconds,
    isRunning: r.is_running,
  };
}

export function matchToInsert(
  m: Omit<Match, "id"> & { id?: string },
): Database["public"]["Tables"]["matches"]["Insert"] {
  return {
    ...(m.id ? { id: m.id } : {}),
    tournament_id: m.tournamentId || null,
    group_id: m.groupId ?? null,
    round: m.round ?? 0,
    home_team_id: m.homeTeamId || null,
    away_team_id: m.awayTeamId || null,
    home_team_name: m.homeTeamName ?? "",
    away_team_name: m.awayTeamName ?? "",
    home_score: m.homeScore ?? 0,
    away_score: m.awayScore ?? 0,
    status: m.status ?? "scheduled",
    scheduled_at: m.scheduledAt ? new Date(m.scheduledAt).toISOString() : null,
    mom_player_id: m.momPlayerId ?? null,
  };
}

// ===== Tournament / Season (groups/tournamentIds 는 jsonb/파생) =====
export function rowToTournament(r: TournamentRow): Tournament {
  return {
    id: r.id,
    seasonId: r.season_id ?? "",
    name: r.name,
    date: r.date ?? "",
    location: r.location ?? "",
    status: (r.status as Tournament["status"]) ?? "upcoming",
    groups: (r.groups as unknown as TournamentGroup[]) ?? [],
    matchIds: [],
    winningTeamId: r.winning_team_id ?? undefined,
    winningTeamName: r.winning_team_name ?? undefined,
    createdAt: ts(r.created_at),
  };
}

export function rowToSeason(r: SeasonRow): Season {
  return {
    id: r.id,
    year: r.year,
    name: r.name,
    isActive: r.is_active,
    tournamentIds: [],
    startDate: r.start_date ?? "",
    endDate: r.end_date ?? "",
  };
}
