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
  attendanceStreak?: number;
  attendanceStreakBest?: number;
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

// 팀 운영 형태.
//  - community: 동호회. 모든 멤버가 회비/지출/잔액 전체 공개(투명 운영).
//  - club: 개인 운영자(감독) 의 수익형 클럽. 멤버는 본인 내역만 보이고
//          전체 장부는 디렉터 전용.
export type TeamType = "community" | "club";

// 리그 단계 — 4단계 메탈 등급. 꾸준한 참가(3회)로 한 단계 승업, 성적 하위로 강등.
// bronze(신규/최하위) → silver → gold → premium(최상위).
export type LeagueTier = "bronze" | "silver" | "gold" | "premium";

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
  teamType: TeamType;
  // 리그 승강
  leagueTier: LeagueTier;
  participationStreak: number; // 연속 대회 참여 수 0–4 (대진 편성 시 휴식 시드 우선권)
}

// ===== Match =====
export type MatchStatus = "scheduled" | "live" | "finished" | "cancelled";
export type MatchEventType =
  | "goal"
  | "assist"
  | "yellow_card"
  | "red_card"
  | "foul"
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
  points: number; // 경기 승점 (랭킹 기준)
  matchPoints: number; // 경기로 얻은 순수 승점
  participationBonus: number; // deprecated: 순위에는 반영하지 않음
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

// 서버 badges 마스터 테이블 1행. 클라이언트는 read-only.
// 트리거가 profiles 통계 update 시 player_badges 를 자동 채워줌.
export interface BadgeMaster {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string | null;
  maxProgress: number | null;
  unlockCondition: string | null;
}

// player_badges 1행. 자동 트리거 채움(read-only from client).
export interface PlayerBadgeRow {
  badgeId: string;
  isEarned: boolean;
  progress: number;
  earnedAt?: number;
}

// ===== Match Lineup =====
// 매치 출전 명단 (감독·매니저·주장이 경기 시작 전 제출).
// is_starter: 선발 5명 / 교체 등록 N (총 등록 ≤ 20).
export interface MatchLineupEntry {
  matchId: string;
  teamId: string;
  playerId: string;
  playerName?: string;
  isStarter: boolean;
  jerseyNumber?: number;
  createdAt: number;
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
  authorRole?: PlayerRole;
  viewCount: number;
  commentCount: number;
  reactionCount?: number;
  teamId?: string;
  isHidden?: boolean;
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
  authorRole?: PlayerRole;
  reactionCount?: number;
  isEdited?: boolean;
  isHidden?: boolean;
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
  authorRole?: PlayerRole;
  teamId?: string;
  publishedAt: number;
  createdAt: number;
  updatedAt: number;
}

// ===== Community Engine =====
export type NotificationKind = "mention" | "reply" | "reaction" | "team_notice" | "coach_approved" | "tier_promoted";

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

// ===== Team join request =====
export type TeamJoinRequestStatus = "pending" | "approved" | "rejected";

export interface TeamJoinRequest {
  id: string;
  teamId: string;
  teamName?: string;
  playerId: string;
  playerName?: string;
  message?: string;
  status: TeamJoinRequestStatus;
  createdAt: number;
  processedAt?: number;
  processedBy?: string;
}

// ===== Team Dues (회비) =====
// periodMonth: ISO date string "YYYY-MM-01" — always the first of the month.
export interface TeamDuesPeriod {
  id: string;
  teamId: string;
  periodMonth: string;
  monthlyAmount: number;
  dueDate?: string;
  memo?: string;
  createdAt: number;
  createdBy?: string;
}

export type TeamDuesPaymentStatus = "unpaid" | "paid" | "exempt" | "partial";

export interface TeamDuesPayment {
  id: string;
  periodId: string;
  playerId: string;
  playerName?: string;
  status: TeamDuesPaymentStatus;
  amountPaid: number;
  paidAt?: number;
  memo?: string;
  recordedBy?: string;
  updatedAt: number;
}

export interface TeamDuesExpense {
  id: string;
  teamId: string;
  occurredOn: string;
  category?: string;
  amount: number;
  memo?: string;
  createdAt: number;
  createdBy?: string;
}

// ===== Search =====
export interface SearchHitPost {
  id: string;
  title: string;
  authorName?: string;
  createdAt: number;
}
export interface SearchHitNotice {
  id: string;
  title: string;
  isImportant?: boolean;
  createdAt: number;
}
export interface SearchHitTeam {
  id: string;
  name: string;
  logo?: string;
}
export interface SearchHitPlayer {
  id: string;
  name: string;
  photoUrl?: string;
  number?: number;
  teamId?: string;
}
export interface SearchResults {
  posts: SearchHitPost[];
  notices: SearchHitNotice[];
  teams: SearchHitTeam[];
  players: SearchHitPlayer[];
}

// ===== Moderation =====
export type ReportTarget = "post" | "comment" | "photo";
export type ReportReason = "spam" | "abuse" | "sexual" | "illegal" | "other";
export type ReportStatus = "pending" | "resolved" | "dismissed";

export interface Report {
  id: string;
  reporterId: string;
  reporterName?: string;
  targetType: ReportTarget;
  targetId: string;
  reason: ReportReason;
  body?: string;
  status: ReportStatus;
  resolvedBy?: string;
  resolvedAt?: number;
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
  | "tournament_created"
  | "tier_promoted";

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
