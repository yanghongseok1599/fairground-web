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
  BoardPost,
  BoardComment,
  Notice,
  PostCategory,
  NotificationItem,
  Report,
  ReportReason,
  ReportStatus,
  ReportTarget,
  NotificationKind,
  TeamPhoto,
  ActivityEvent,
  ActivityKind,
  PlayerRole,
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
type TournamentInsert = Database["public"]["Tables"]["tournaments"]["Insert"];
type SeasonRow = Database["public"]["Tables"]["seasons"]["Row"];

type NoticeRow = Database["public"]["Tables"]["notices"]["Row"];
type NoticeInsert = Database["public"]["Tables"]["notices"]["Insert"];
type NoticeUpdate = Database["public"]["Tables"]["notices"]["Update"];
type BoardPostRow = Database["public"]["Tables"]["board_posts"]["Row"];
type BoardPostInsert = Database["public"]["Tables"]["board_posts"]["Insert"];
type BoardPostUpdate = Database["public"]["Tables"]["board_posts"]["Update"];
type BoardCommentRow = Database["public"]["Tables"]["board_comments"]["Row"];
type BoardCommentInsert = Database["public"]["Tables"]["board_comments"]["Insert"];

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
type TeamGalleryRow = Database["public"]["Tables"]["team_gallery_photos"]["Row"];
type ActivityEventRow = Database["public"]["Tables"]["activity_events"]["Row"];

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
    profilePhotoLocked: r.profile_photo_locked ?? false,
    photoScale: r.photo_scale ?? undefined,
    photoOffsetX: r.photo_offset_x ?? undefined,
    cardType: r.card_type,
    cardSkin: r.card_skin === "hologram" ? "hologram" : "standard",
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
    email: r.email ?? undefined,
    gender: (r.gender as Player["gender"]) ?? undefined,
    birthDate: r.birth_date ?? undefined,
    hasPlayerExperience: r.has_player_experience ?? undefined,
    mbti: r.mbti ?? undefined,
    disposition: r.disposition ?? undefined,
    personalValues: r.personal_values ?? undefined,
    bio: r.bio ?? undefined,
    teamRole: r.team_role ?? undefined,
    attendanceStreak: r.attendance_streak ?? 0,
    attendanceStreakBest: r.attendance_streak_best ?? 0,
    createdAt: new Date(r.created_at).getTime(),
  };
}

// 신규 프로필 INSERT. admin 은 클라이언트 선택지에 없고, DB 정책도 차단한다.
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
    profile_photo_locked: p.profilePhotoLocked ?? false,
    photo_scale: p.photoScale ?? null,
    photo_offset_x: p.photoOffsetX ?? null,
    card_type: p.cardType === "premium" ? "premium" : "gold",
    card_skin: p.cardSkin ?? "standard",
    card_rating: p.cardRating,
    goals: p.stats.goals,
    assists: p.stats.assists,
    games: p.stats.games,
    mom: p.stats.mom,
    is_banned: p.penaltyStatus.isBanned,
    ban_matches_remaining: p.penaltyStatus.banMatchesRemaining,
    season_yellow_cards: p.penaltyStatus.seasonYellowCards,
    badges: p.badges,
    role: p.role,
    phone: p.phone ?? null,
    email: p.email ?? null,
    gender: p.gender ?? null,
    birth_date: p.birthDate ?? null,
    has_player_experience: p.hasPlayerExperience ?? false,
    mbti: p.mbti ?? null,
    disposition: p.disposition ?? null,
    personal_values: p.personalValues ?? null,
    bio: p.bio ?? null,
    team_role: p.teamRole ?? null,
  };
}

// 부분 수정 → row 패치. is_approved/통계는 매핑하지 않는다.
// role 은 player/captain/referee 등록 유형 저장에만 사용한다(admin 은 UI/정책에서 차단).
export function playerPatchToRow(d: Partial<Player>): ProfileUpdate {
  const u: ProfileUpdate = {};
  if (d.name !== undefined) u.name = d.name;
  if (d.number !== undefined) u.number = d.number;
  if (d.position !== undefined) u.position = d.position;
  if (d.teamId !== undefined) u.team_id = d.teamId || null;
  if (d.nationality !== undefined) u.nationality = d.nationality;
  if (d.photoUrl !== undefined) u.photo_url = d.photoUrl;
  if (d.profilePhotoUrl !== undefined) u.profile_photo_url = d.profilePhotoUrl ?? null;
  if (d.profilePhotoLocked !== undefined) u.profile_photo_locked = d.profilePhotoLocked ?? false;
  if (d.photoScale !== undefined) u.photo_scale = d.photoScale ?? null;
  if (d.photoOffsetX !== undefined) u.photo_offset_x = d.photoOffsetX ?? null;
  if (d.cardType !== undefined) u.card_type = d.cardType === "premium" ? "premium" : "gold";
  if (d.cardSkin !== undefined) u.card_skin = d.cardSkin;
  if (d.badges !== undefined) u.badges = d.badges;
  if (d.role !== undefined) u.role = d.role;
  if (d.phone !== undefined) u.phone = d.phone ?? null;
  if (d.email !== undefined) u.email = d.email ?? null;
  if (d.gender !== undefined) u.gender = d.gender ?? null;
  if (d.birthDate !== undefined) u.birth_date = d.birthDate ?? null;
  if (d.hasPlayerExperience !== undefined) u.has_player_experience = d.hasPlayerExperience ?? false;
  if (d.mbti !== undefined) u.mbti = d.mbti?.trim() || null;
  if (d.disposition !== undefined) u.disposition = d.disposition?.trim() || null;
  if (d.personalValues !== undefined) u.personal_values = d.personalValues?.trim() || null;
  if (d.bio !== undefined) u.bio = d.bio?.trim() || null;
  if (d.teamRole !== undefined) u.team_role = d.teamRole ?? null;
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
    description: r.description ?? undefined,
    introSubtitle: r.intro_subtitle ?? undefined,
    bannerUrl: r.banner_url ?? undefined,
    teamType: r.team_type,
    leagueTier: r.league_tier,
    participationStreak: r.participation_streak,
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
    description: t.description ?? null,
    intro_subtitle: t.introSubtitle ?? null,
    banner_url: t.bannerUrl ?? null,
    team_type: t.teamType ?? "community",
    league_tier: t.leagueTier ?? "bronze",
    participation_streak: t.participationStreak ?? 0,
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
  if (d.description !== undefined) u.description = d.description ?? null;
  if (d.introSubtitle !== undefined) u.intro_subtitle = d.introSubtitle ?? null;
  if (d.bannerUrl !== undefined) u.banner_url = d.bannerUrl ?? null;
  if (d.teamType !== undefined) u.team_type = d.teamType;
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
export function tournamentToInsert(t: Omit<Tournament, "id"> & { id?: string }): TournamentInsert {
  return {
    ...(t.id ? { id: t.id } : {}),
    season_id: t.seasonId || null,
    name: t.name,
    date: t.date || null,
    location: t.location || null,
    status: t.status ?? "upcoming",
    groups: (t.groups ?? []) as unknown as TournamentInsert["groups"],
    winning_team_id: t.winningTeamId ?? null,
    winning_team_name: t.winningTeamName ?? null,
  };
}

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
    fixturesPublished: Boolean(r.fixtures_published),
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

// ===== Notice =====
/**
 * profiles 조인 결과는 select 형태에 따라 객체 또는 배열로 올 수 있어 둘 다 허용.
 * RLS·스키마 변경 없이 작성자 이름만 클라에서 표시한다.
 */
type AuthorJoin = { name: string; role?: PlayerRole | null } | { name: string; role?: PlayerRole | null }[] | null | undefined;

function pickAuthorName(j: AuthorJoin): string | undefined {
  if (!j) return undefined;
  if (Array.isArray(j)) return j[0]?.name;
  return j.name;
}

function pickAuthorRole(j: AuthorJoin): PlayerRole | undefined {
  if (!j) return undefined;
  const role = Array.isArray(j) ? j[0]?.role : j.role;
  return role ?? undefined;
}

type NoticeRowWithAuthor = NoticeRow & { profiles?: AuthorJoin };

export function rowToNotice(r: NoticeRowWithAuthor): Notice {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    category: r.category,
    isPinned: r.is_pinned,
    isImportant: r.is_important,
    authorId: r.author_id ?? undefined,
    authorName: pickAuthorName(r.profiles),
    authorRole: pickAuthorRole(r.profiles),
    teamId: r.team_id ?? undefined,
    publishedAt: ts(r.published_at),
    createdAt: ts(r.created_at),
    updatedAt: ts(r.updated_at),
  };
}

export interface NoticeInputCreate {
  title: string;
  body: string;
  category: string;
  isPinned?: boolean;
  isImportant?: boolean;
  authorId?: string | null;
  teamId?: string | null;
}

export function noticeToInsert(d: NoticeInputCreate): NoticeInsert {
  return {
    title: d.title,
    body: d.body,
    category: d.category,
    is_pinned: d.isPinned ?? false,
    is_important: d.isImportant ?? false,
    author_id: d.authorId ?? null,
    team_id: d.teamId ?? null,
  };
}

export function noticePatchToRow(d: Partial<NoticeInputCreate>): NoticeUpdate {
  const u: NoticeUpdate = {};
  if (d.title !== undefined) u.title = d.title;
  if (d.body !== undefined) u.body = d.body;
  if (d.category !== undefined) u.category = d.category;
  if (d.isPinned !== undefined) u.is_pinned = d.isPinned;
  if (d.isImportant !== undefined) u.is_important = d.isImportant;
  // updated_at 은 DB 트리거가 갱신하지 않으므로 클라에서 명시.
  u.updated_at = new Date().toISOString();
  return u;
}

// ===== Board Post =====
type BoardPostRowWithAuthor = BoardPostRow & { profiles?: AuthorJoin };

export function rowToBoardPost(r: BoardPostRowWithAuthor): BoardPost {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    category: r.category,
    authorId: r.author_id,
    authorName: pickAuthorName(r.profiles),
    authorRole: pickAuthorRole(r.profiles),
    viewCount: r.view_count,
    commentCount: r.comment_count,
    reactionCount: r.reaction_count ?? 0,
    teamId: r.team_id ?? undefined,
    isHidden: r.is_hidden ?? false,
    createdAt: ts(r.created_at),
    updatedAt: ts(r.updated_at),
  };
}

export interface BoardPostInputCreate {
  title: string;
  body: string;
  category: PostCategory;
  authorId: string;
  teamId?: string | null;
}

export function boardPostToInsert(d: BoardPostInputCreate): BoardPostInsert {
  return {
    title: d.title,
    body: d.body,
    category: d.category,
    author_id: d.authorId,
    team_id: d.teamId ?? null,
  };
}

export function boardPostPatchToRow(
  d: Partial<Pick<BoardPostInputCreate, "title" | "body" | "category">>,
): BoardPostUpdate {
  const u: BoardPostUpdate = {};
  if (d.title !== undefined) u.title = d.title;
  if (d.body !== undefined) u.body = d.body;
  if (d.category !== undefined) u.category = d.category;
  u.updated_at = new Date().toISOString();
  return u;
}

// ===== Board Comment =====
type BoardCommentRowWithAuthor = BoardCommentRow & { profiles?: AuthorJoin };

export function rowToBoardComment(r: BoardCommentRowWithAuthor): BoardComment {
  return {
    id: r.id,
    postId: r.post_id,
    parentCommentId: r.parent_comment_id ?? undefined,
    body: r.body,
    authorId: r.author_id,
    authorName: pickAuthorName(r.profiles),
    authorRole: pickAuthorRole(r.profiles),
    reactionCount: r.reaction_count ?? 0,
    isEdited: r.is_edited ?? false,
    isHidden: r.is_hidden ?? false,
    createdAt: ts(r.created_at),
    updatedAt: r.updated_at ? ts(r.updated_at) : undefined,
  };
}

export interface BoardCommentInputCreate {
  postId: string;
  body: string;
  authorId: string;
  parentCommentId?: string;
}

export function boardCommentToInsert(d: BoardCommentInputCreate): BoardCommentInsert {
  return {
    post_id: d.postId,
    body: d.body,
    author_id: d.authorId,
    parent_comment_id: d.parentCommentId ?? null,
  };
}

// ===== Community Engine =====
type NotificationRowWithActor = NotificationRow & { profiles?: AuthorJoin };
export function rowToNotification(r: NotificationRowWithActor): NotificationItem {
  return {
    id: r.id,
    userId: r.user_id,
    kind: r.kind as NotificationKind,
    actorId: r.actor_id ?? undefined,
    actorName: pickAuthorName(r.profiles),
    postId: r.post_id ?? undefined,
    commentId: r.comment_id ?? undefined,
    teamId: r.team_id ?? undefined,
    matchId: r.match_id ?? undefined,
    title: r.title,
    snippet: r.snippet ?? undefined,
    readAt: r.read_at ? new Date(r.read_at).getTime() : undefined,
    createdAt: ts(r.created_at),
  };
}

type TeamGalleryRowWithUploader = TeamGalleryRow & { profiles?: AuthorJoin };
export function rowToTeamPhoto(r: TeamGalleryRowWithUploader, publicUrl: string): TeamPhoto {
  return {
    id: r.id,
    teamId: r.team_id,
    uploadedBy: r.uploaded_by ?? undefined,
    uploadedByName: pickAuthorName(r.profiles),
    storagePath: r.storage_path,
    publicUrl,
    caption: r.caption ?? undefined,
    matchId: r.match_id ?? undefined,
    createdAt: ts(r.created_at),
  };
}

// ===== Activity Feed =====
// activity_events 트리거가 채운 row → 앱 ActivityEvent.
// 모든 외래키는 nullable. createdAt 은 unix ms 로 변환(ts 헬퍼 재사용).
export function rowToActivityEvent(r: ActivityEventRow): ActivityEvent {
  return {
    id: r.id,
    kind: r.kind as ActivityKind,
    actorId: r.actor_id ?? undefined,
    actorName: r.actor_name ?? undefined,
    postId: r.post_id ?? undefined,
    commentId: r.comment_id ?? undefined,
    matchId: r.match_id ?? undefined,
    photoId: r.photo_id ?? undefined,
    badgeId: r.badge_id ?? undefined,
    playerId: r.player_id ?? undefined,
    teamId: r.team_id ?? undefined,
    tournamentId: r.tournament_id ?? undefined,
    title: r.title,
    snippet: r.snippet ?? undefined,
    createdAt: ts(r.created_at),
  };
}

// ===== Reports =====
type ReportRow = Database["public"]["Tables"]["reports"]["Row"];
type ReportRowWithReporter = ReportRow & { profiles?: AuthorJoin };

export function rowToReport(r: ReportRowWithReporter): Report {
  return {
    id: r.id,
    reporterId: r.reporter_id,
    reporterName: pickAuthorName(r.profiles),
    targetType: r.target_type as ReportTarget,
    targetId: r.target_id,
    reason: r.reason as ReportReason,
    body: r.body ?? undefined,
    status: r.status as ReportStatus,
    resolvedBy: r.resolved_by ?? undefined,
    resolvedAt: r.resolved_at ? ts(r.resolved_at) : undefined,
    createdAt: ts(r.created_at),
  };
}
