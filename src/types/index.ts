// ===== Player =====
export type Position = "GK" | "FIXO" | "ALA" | "PIVO";
export type CardType = "bronze" | "silver" | "gold" | "premium";
export type PlayerRole = "player" | "captain" | "referee" | "admin";
export type TeamRole = "member" | "captain" | "manager" | "coach";
export type Gender = "male" | "female" | "other" | "prefer_not_to_say";

export interface PlayerStats {
  goals: number;
  assists: number;
  games: number;
  mom: number;
}

export interface PenaltyStatus {
  isBanned: boolean;
  banMatchesRemaining: number;
  seasonYellowCards: number;
}

export interface Player {
  id: string;
  uid: string;
  name: string;
  number: number;
  position: Position;
  teamId: string;
  teamName?: string;
  nationality: string;
  photoUrl: string;        // 카드용 (배경제거)
  profilePhotoUrl?: string; // 프로필용 (원본)
  photoScale?: number;
  photoOffsetX?: number;
  cardType: CardType;
  cardRating: number;
  stats: PlayerStats;
  badges: string[];
  penaltyStatus: PenaltyStatus;
  isApproved: boolean;
  role: PlayerRole;
  phone?: string;
  email?: string;
  gender?: Gender;
  birthDate?: string;
  hasPlayerExperience?: boolean;
  mbti?: string;
  disposition?: string;
  personalValues?: string;
  bio?: string;
  teamRole?: TeamRole;
  createdAt: number;
}

// ===== Team =====
export interface TeamSeasonStats {
  points: number;
  rank: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  gamesPlayed: number;
}

export interface Team {
  id: string;
  name: string;
  logo: string;
  isApproved: boolean;
  captainId?: string;
  foundedYear?: number;
  memberCount: number;
  seasonStats: TeamSeasonStats;
  createdAt: number;
  description?: string;
  introSubtitle?: string;
  bannerUrl?: string;
}

// ===== Match =====
export type MatchStatus = "scheduled" | "live" | "finished" | "cancelled";
export type MatchEventType =
  | "goal"
  | "assist"
  | "yellow_card"
  | "red_card"
  | "substitution"
  | "mom";

export interface MatchEvent {
  id: string;
  type: MatchEventType;
  playerId: string;
  playerName: string;
  teamId: string;
  minute: number;
  half: 1 | 2;
  timestamp: number;
  isCancelled?: boolean;
}

export interface Match {
  id: string;
  tournamentId: string;
  groupId?: string;
  round: number;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  status: MatchStatus;
  scheduledAt: number;
  events: MatchEvent[];
  momPlayerId?: string;
}

export interface LiveMatch extends Match {
  status: "live";
  currentHalf: 1 | 2;
  elapsedSeconds: number;
  isRunning: boolean;
}

// ===== Tournament =====
export type TournamentStatus = "upcoming" | "ongoing" | "completed";

export interface GroupStanding {
  teamId: string;
  teamName: string;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  gamesPlayed: number;
}

export interface TournamentGroup {
  id: string;
  name: string;
  teamIds: string[];
  standings: GroupStanding[];
}

export interface Tournament {
  id: string;
  seasonId: string;
  name: string;
  date: string;
  location: string;
  status: TournamentStatus;
  groups: TournamentGroup[];
  matchIds: string[];
  winningTeamId?: string;
  winningTeamName?: string;
  createdAt: number;
}

// ===== Season =====
export interface Season {
  id: string;
  year: number;
  name: string;
  isActive: boolean;
  tournamentIds: string[];
  startDate: string;
  endDate: string;
}

export interface TeamStanding {
  teamId: string;
  teamName: string;
  teamLogo: string;
  points: number;
  rank: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  gamesPlayed: number;
}

// ===== Badge =====
export type BadgeCategory = "field" | "goalkeeper" | "referee";

export interface Badge {
  id: string;
  name: string;
  icon: string;
  imageUrl: string;
  description: string;
  unlockCondition: string;
  maxProgress?: number;
  category: BadgeCategory;
}

export interface PlayerBadge {
  badgeId: string;
  earnedAt?: number;
  progress: number;
  isEarned: boolean;
}

// ===== Board / Notices =====
export type PostCategory = "자유" | "매치후기" | "팁" | "모집" | "질문";
export const POST_CATEGORIES: readonly PostCategory[] = [
  "자유",
  "매치후기",
  "팁",
  "모집",
  "질문",
] as const;

export type NoticeCategory = "운영" | "일정" | "결과" | "규정";
export const NOTICE_CATEGORIES: readonly NoticeCategory[] = [
  "운영",
  "일정",
  "결과",
  "규정",
] as const;

export interface BoardPost {
  id: string;
  title: string;
  body: string;
  category: PostCategory;
  authorId: string;
  authorName?: string;
  viewCount: number;
  commentCount: number;
  reactionCount?: number;
  teamId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface BoardComment {
  id: string;
  postId: string;
  parentCommentId?: string;
  body: string;
  authorId: string;
  authorName?: string;
  reactionCount?: number;
  isEdited?: boolean;
  createdAt: number;
  updatedAt?: number;
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  /** 자유 형식 카테고리 — UI는 NOTICE_CATEGORIES 제안값을 사용. */
  category: string;
  isPinned: boolean;
  isImportant: boolean;
  authorId?: string;
  authorName?: string;
  teamId?: string;
  publishedAt: number;
  createdAt: number;
  updatedAt: number;
}

// ===== Community Engine =====
export type NotificationKind = "mention" | "reply" | "reaction" | "team_notice" | "coach_approved";

export interface NotificationItem {
  id: string;
  userId: string;
  kind: NotificationKind;
  actorId?: string;
  actorName?: string;
  postId?: string;
  commentId?: string;
  teamId?: string;
  title: string;
  snippet?: string;
  readAt?: number;
  createdAt: number;
}

export interface TeamPhoto {
  id: string;
  teamId: string;
  uploadedBy?: string;
  uploadedByName?: string;
  storagePath: string;
  publicUrl: string;
  caption?: string;
  matchId?: string;
  createdAt: number;
}

// ===== Activity Feed =====
// activity_events 테이블 1행을 표현. kind 별로 사용되는 외래키 필드가 다르다.
// 트리거가 자동 채우므로 클라이언트는 read-only.
export type ActivityKind =
  | "post_created"
  | "comment_created"
  | "match_finished"
  | "photo_uploaded"
  | "badge_earned"
  | "player_joined"
  | "tournament_created";

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  actorId?: string;
  actorName?: string;
  postId?: string;
  commentId?: string;
  matchId?: string;
  photoId?: string;
  badgeId?: string;
  playerId?: string;
  teamId?: string;
  tournamentId?: string;
  title: string;
  snippet?: string;
  createdAt: number;
}
