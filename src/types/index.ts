// ===== Player =====
export type Position = "GK" | "FIXO" | "ALA" | "PIVO";
export type CardType = "gold" | "premium";
export type PlayerRole = "player" | "captain" | "referee" | "admin";

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
