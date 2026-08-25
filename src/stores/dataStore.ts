"use client";

import { create } from "zustand";
import { supabase, isDemoMode } from "@/config/supabase";
import {
  rowToPlayer,
  rowToTeam,
  teamToInsert,
  teamPatchToRow,
  rowToEvent,
  rowToMatch,
  rowToLiveMatch,
  matchToInsert,
  rowToTournament,
  rowToSeason,
  tournamentToInsert,
  rowToNotice,
  noticeToInsert,
  noticePatchToRow,
  rowToBoardPost,
  boardPostToInsert,
  boardPostPatchToRow,
  rowToBoardComment,
  boardCommentToInsert,
  rowToNotification,
  rowToTeamPhoto,
  rowToActivityEvent,
  rowToReport,
  type NoticeInputCreate,
  type BoardPostInputCreate,
} from "@/lib/mappers";
import { calculateCardRating } from "@/utils/formatters";
import type {
  Player,
  Team,
  Match,
  LiveMatch,
  MatchEvent,
  MatchEventType,
  Tournament,
  Season,
  TeamStanding,
  Notice,
  BoardPost,
  BoardComment,
  PostCategory,
  TeamRole,
  NotificationItem,
  TeamPhoto,
  TeamJoinRequest,
  TeamJoinRequestStatus,
  TeamDuesPeriod,
  TeamDuesPayment,
  TeamDuesPaymentStatus,
  TeamDuesExpense,
  ActivityEvent,
  Report,
  ReportReason,
  ReportTarget,
  SearchResults,
  BadgeMaster,
  PlayerBadgeRow,
  MatchLineupEntry,
  Position,
  Gender,
} from "@/types";

// 단일앱 통합 store: 공개사이트 read(RLS anon) + 운영 write(인증/RLS) 통합.
// fairground 풀 read+write 구현을 단일 소스화. 공개 페이지가 의존하는
// read 메서드 시그니처(fetchTeams/fetchPlayers/fetchTournaments 가 배열 반환,
// fetchStandings/subscribeLiveMatches 등)는 보존 — 페이지 컴포넌트 무파손.
// 데모 모드(localStorage) 분기 보존.

// ===== localStorage helpers for demo mode (원본 보존) =====
const LS_TEAMS = "fg_teams";
const LS_PLAYERS = "fg_players";
const LS_MATCHES = "fg_matches";
const LS_LIVE = "fg_liveMatches";
const LS_TOURNAMENTS = "fg_tournaments";

function getLocalTeams(): Record<string, Team> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(LS_TEAMS) || "{}"); } catch { return {}; }
}
function saveLocalTeams(teams: Record<string, Team>) {
  localStorage.setItem(LS_TEAMS, JSON.stringify(teams));
}
function getLocalPlayers(): Record<string, Player> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(LS_PLAYERS) || "{}"); } catch { return {}; }
}
function saveLocalPlayers(players: Record<string, Player>) {
  localStorage.setItem(LS_PLAYERS, JSON.stringify(players));
}
function getLocalMatches(): Record<string, Record<string, Match>> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(LS_MATCHES) || "{}"); } catch { return {}; }
}
function saveLocalMatches(m: Record<string, Record<string, Match>>) {
  localStorage.setItem(LS_MATCHES, JSON.stringify(m));
}
function getLocalLive(): Record<string, LiveMatch> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(LS_LIVE) || "{}"); } catch { return {}; }
}
function saveLocalLive(m: Record<string, LiveMatch>) {
  localStorage.setItem(LS_LIVE, JSON.stringify(m));
}
function getLocalTournaments(): Record<string, Tournament> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(LS_TOURNAMENTS) || "{}"); } catch { return {}; }
}
function saveLocalTournaments(t: Record<string, Tournament>) {
  localStorage.setItem(LS_TOURNAMENTS, JSON.stringify(t));
}

function generateId(): string {
  return "local_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

function eventsToArray(events: Record<string, MatchEvent> | MatchEvent[] | undefined): MatchEvent[] {
  if (!events) return [];
  if (Array.isArray(events)) return events;
  return Object.values(events);
}

// Supabase: 한 경기의 이벤트 조회 헬퍼 (created_at 오름차순).
async function fetchEvents(matchId: string): Promise<MatchEvent[]> {
  const { data, error } = await supabase
    .from("match_events")
    .select("*")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[dataStore] fetchEvents:", error.message);
    return [];
  }
  return (data ?? []).map(rowToEvent);
}

// ===== Store =====
interface DataState {
  players: Record<string, Player>;
  teams: Record<string, Team>;
  teamsLoading: boolean;
  liveMatches: LiveMatch[];
  liveMatchesLoading: boolean;
  tournaments: Record<string, Tournament>;
  currentSeason: Season | null;
  standings: TeamStanding[];
  standingsLoading: boolean;
  // 공개 페이지 호환용 일반 로딩 플래그(기존 web store 유지).
  loading: boolean;

  // --- Read (공개 페이지 소비 — 시그니처 보존) ---
  fetchPlayers: () => Promise<Player[]>;
  fetchPlayer: (id: string) => Promise<Player | null>;
  fetchTeams: () => Promise<Team[]>;
  fetchTeam: (id: string) => Promise<Team | null>;
  fetchTeamPlayers: (teamId: string) => Promise<Player[]>;
  fetchTournaments: () => Promise<Tournament[]>;
  fetchTournament: (id: string) => Promise<Tournament | null>;
  fetchMatches: (tournamentId: string) => Promise<Match[]>;
  fetchMatch: (tournamentId: string, matchId: string) => Promise<Match | null>;
  fetchStandings: () => Promise<void>;
  subscribeLiveMatches: () => () => void;
  // fairground 호환 별칭 (운영 라우트 이식 대비).
  fetchAllTournaments: () => Promise<Tournament[]>;

  // --- Write (운영/심판 콘솔 — fairground 풀 구현 이식) ---
  createTeam: (team: Omit<Team, "id">) => Promise<string>;
  updateTeam: (id: string, data: Partial<Team>) => Promise<void>;
  // 리그 승강 (admin 정산) — RPC 호출.
  recordParticipation: (teamId: string) => Promise<void>;       // 연속 streak +1 (cap 4)
  resetParticipationStreak: (teamId: string) => Promise<void>;  // 불참/끊김 → 0
  promoteTeam: (teamId: string) => Promise<void>;               // 시즌 상위 2팀 → 한 단계 위 + streak 0
  relegateTeam: (teamId: string) => Promise<void>;              // 시즌 하위 2팀 → 한 단계 아래
  createTournament: (tournament: Omit<Tournament, "id">) => Promise<string>;
  createMatch: (tournamentId: string, match: Omit<Match, "id">) => Promise<string>;
  startMatch: (tournamentId: string, matchId: string) => Promise<void>;
  pauseMatch: (matchId: string) => Promise<void>;
  resumeMatch: (matchId: string) => Promise<void>;
  endMatch: (tournamentId: string, matchId: string) => Promise<void>;
  /** 몰수패 처리 — 공식 기록 3:0 (지목 팀 0, 상대 3). 규정 제13조/대회규정 제9조. */
  forfeitMatch: (matchId: string, forfeitTeamId: string) => Promise<void>;
  substitutePlayer: (
    matchId: string,
    teamId: string,
    outId: string,
    inId: string,
    inName: string,
    minute: number,
    half: number,
  ) => Promise<void>;
  addMatchEvent: (
    tournamentId: string,
    matchId: string,
    event: { type: MatchEventType; playerId: string; playerName: string; teamId: string; minute: number; half: 1 | 2 },
  ) => Promise<void>;
  cancelMatchEvent: (tournamentId: string, matchId: string, eventId: string) => Promise<void>;
  updateMatchTimer: (matchId: string, elapsedSeconds: number, currentHalf: 1 | 2) => Promise<void>;
  notifyNextMatchReady: (matchId: string) => Promise<number>;
  setMatchMom: (tournamentId: string, matchId: string, playerId: string) => Promise<void>;

  // --- Notices (운영 → 회원 일방향, RLS: 누구나 read / is_referee_or_admin 만 write) ---
  // teamId 옵션: null 명시 = 글로벌만(team_id IS NULL),
  //   id 문자열 = 해당 팀 공지만, 미지정(undefined) = 글로벌만(기존 호환).
  fetchNotices: (opts?: { category?: string; teamId?: string | null }) => Promise<Notice[]>;
  fetchNotice: (id: string) => Promise<Notice | null>;
  createNotice: (input: NoticeInputCreate) => Promise<string>;
  updateNotice: (id: string, patch: Partial<NoticeInputCreate>) => Promise<void>;
  deleteNotice: (id: string) => Promise<void>;

  // --- Board posts (자유게시판, RLS: 누구나 read / 본인만 write·update / 본인+admin delete) ---
  // teamId 시맨틱은 fetchNotices와 동일.
  fetchBoardPosts: (opts?: {
    category?: PostCategory;
    sort?: "recent" | "comments";
    teamId?: string | null;
  }) => Promise<BoardPost[]>;
  fetchBoardPost: (id: string, opts?: { bumpView?: boolean }) => Promise<BoardPost | null>;
  createBoardPost: (input: BoardPostInputCreate) => Promise<string>;
  updateBoardPost: (
    id: string,
    patch: Partial<Pick<BoardPostInputCreate, "title" | "body" | "category">>,
  ) => Promise<void>;
  deleteBoardPost: (id: string) => Promise<void>;

  // --- Board comments ---
  fetchComments: (postId: string) => Promise<BoardComment[]>;
  addComment: (
    postId: string,
    body: string,
    authorId: string,
    parentCommentId?: string
  ) => Promise<string>;
  updateComment: (commentId: string, body: string) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;

  // --- Moderation ---
  createReport: (
    targetType: ReportTarget,
    targetId: string,
    reason: ReportReason,
    body?: string
  ) => Promise<void>;
  fetchPendingReports: () => Promise<Report[]>;
  resolveReport: (id: string, action: "resolve" | "dismiss") => Promise<void>;
  hideTarget: (
    targetType: ReportTarget,
    targetId: string,
    hide: boolean
  ) => Promise<void>;

  // --- Team roles ---
  // 팀 멤버 조회 (fetchTeamPlayers의 의미적 별칭).
  fetchTeamMembers: (teamId: string) => Promise<Player[]>;
  // 소유자 없는 팀을 승인된 멤버 본인이 감독으로 복구 등록.
  claimTeamCoach: (teamId: string) => Promise<void>;
  // 멤버의 팀 역할 변경. 권한은 Supabase RPC(set_team_member_role)가 강제.
  updatePlayerTeamRole: (playerId: string, teamRole: TeamRole) => Promise<void>;
  transferTeamOwnership: (teamId: string, newOwnerId: string) => Promise<void>;
  // Legacy 감독 application queue. Current team authority is assigned from
  // /teams/[id]/members through set_team_member_role.
  fetchPendingCoachApplications: () => Promise<Player[]>;
  approveCoach: (playerId: string) => Promise<void>;

  // === Community Engine ===
  toggleReaction: (
    target: "post" | "comment",
    id: string,
  ) => Promise<{ liked: boolean; count: number }>;
  fetchMyReactions: (target: "post" | "comment", ids: string[]) => Promise<Set<string>>;
  fetchNotifications: (opts?: { unreadOnly?: boolean; limit?: number }) => Promise<NotificationItem[]>;
  fetchUnreadNotificationCount: () => Promise<number>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  notifyMentions: (
    targetType: "post" | "comment",
    targetId: string,
    userIds: string[],
  ) => Promise<void>;
  searchProfilesByName: (
    query: string,
  ) => Promise<{ id: string; name: string; photoUrl: string; teamId: string }[]>;
  uploadTeamPhoto: (
    teamId: string,
    file: File,
    caption?: string,
    matchId?: string,
  ) => Promise<TeamPhoto>;
  deleteTeamPhoto: (id: string, storagePath: string) => Promise<void>;
  fetchTeamPhotos: (teamId: string, limit?: number) => Promise<TeamPhoto[]>;

  // ===== Team join requests =====
  requestJoinTeam: (teamId: string, message?: string) => Promise<string>;
  fetchTeamJoinRequests: (
    teamId: string,
    status?: TeamJoinRequestStatus,
  ) => Promise<TeamJoinRequest[]>;
  fetchMyJoinRequests: (playerId: string) => Promise<TeamJoinRequest[]>;
  setTeamJoinRequestStatus: (
    requestId: string,
    status: TeamJoinRequestStatus,
  ) => Promise<void>;
  cancelMyJoinRequest: (requestId: string) => Promise<void>;

  // ===== Team dues (회비) =====
  fetchTeamDuesPeriods: (teamId: string) => Promise<TeamDuesPeriod[]>;
  createTeamDuesPeriod: (input: {
    teamId: string;
    periodMonth: string;
    monthlyAmount: number;
    dueDate?: string;
    memo?: string;
  }) => Promise<string>;
  deleteTeamDuesPeriod: (periodId: string) => Promise<void>;
  fetchTeamDuesPayments: (periodId: string) => Promise<TeamDuesPayment[]>;
  fetchMyDuesPayments: (playerId: string) => Promise<TeamDuesPayment[]>;
  setTeamDuesPaymentStatus: (
    paymentId: string,
    status: TeamDuesPaymentStatus,
    amountPaid?: number,
  ) => Promise<void>;
  fetchTeamDuesExpenses: (teamId: string) => Promise<TeamDuesExpense[]>;
  addTeamDuesExpense: (input: {
    teamId: string;
    occurredOn: string;
    amount: number;
    category?: string;
    memo?: string;
  }) => Promise<string>;
  deleteTeamDuesExpense: (expenseId: string) => Promise<void>;

  // 전체 활동 피드. cursor 는 createdAt unix ms; 그보다 과거 행을 페이지로 반환.
  fetchActivityFeed: (opts?: { cursor?: number; limit?: number }) => Promise<ActivityEvent[]>;
  // 통합 검색 (글·공지·팀·플레이어 병렬, 각 카테고리 최대 5건)
  searchAll: (q: string) => Promise<SearchResults>;

  // === Badges ===
  // badges 마스터 read (정적, RLS anon select 허용).
  fetchAllBadges: () => Promise<BadgeMaster[]>;
  // player_badges 본인 행 (자동 트리거 채움). RLS: 누구나 select.
  fetchMyBadges: (playerId: string) => Promise<PlayerBadgeRow[]>;
  // profiles.badges 장착 슬롯 update. 최대 4개로 잘림.
  // 미획득 배지가 섞여 있으면 RLS/트리거가 거부 가능 → 호출부에서 사전 검증.
  updateEquippedBadges: (playerId: string, badgeIds: string[]) => Promise<void>;

  // --- Match lineups (감독·캡틴 제출, status='scheduled' 만 허용) ---
  fetchMatchLineup: (matchId: string) => Promise<MatchLineupEntry[]>;
  upsertLineupEntry: (
    matchId: string,
    teamId: string,
    playerId: string,
    opts?: { isStarter?: boolean; jerseyNumber?: number }
  ) => Promise<void>;
  removeLineupEntry: (matchId: string, teamId: string, playerId: string) => Promise<void>;
  setLineupStarter: (
    matchId: string,
    teamId: string,
    playerId: string,
    isStarter: boolean
  ) => Promise<void>;

  // --- Leaderboard ---
  fetchLeaderboard: (
    category: "goals" | "assists" | "mom" | "games" | "streak" | "rating",
    limit?: number
  ) => Promise<Player[]>;
}

/** SQL 예외 메시지 → 사용자용 한국어. raise(message) 패턴을 파싱한다. */
type JoinReqRow = {
  id: string;
  team_id: string;
  player_id: string;
  message: string | null;
  status: TeamJoinRequestStatus;
  created_at: string;
  processed_at: string | null;
  processed_by: string | null;
  profiles?: {
    name: string | null;
    email: string | null;
    phone: string | null;
    position: Position | null;
    number: number | null;
    gender: Gender | null;
    birth_date: string | null;
  } | null;
  teams?: { name: string | null } | null;
};

function rowToTeamJoinRequest(r: JoinReqRow): TeamJoinRequest {
  const profile = r.profiles;
  return {
    id: r.id,
    teamId: r.team_id,
    teamName: r.teams?.name ?? undefined,
    playerId: r.player_id,
    playerName: profile?.name ?? undefined,
    playerEmail: profile?.email ?? undefined,
    playerPhone: profile?.phone ?? undefined,
    playerPosition: profile?.position ?? undefined,
    playerNumber: profile?.number ?? undefined,
    playerGender: profile?.gender ?? undefined,
    playerBirthDate: profile?.birth_date ?? undefined,
    message: r.message ?? undefined,
    status: r.status,
    createdAt: new Date(r.created_at).getTime(),
    processedAt: r.processed_at ? new Date(r.processed_at).getTime() : undefined,
    processedBy: r.processed_by ?? undefined,
  };
}

// ── Team-dues row mappers ─────────────────────────────────────────────────
type DuesPeriodRow = {
  id: string;
  team_id: string;
  period_month: string;
  monthly_amount: number;
  due_date: string | null;
  memo: string | null;
  created_at: string;
  created_by: string | null;
};

function rowToDuesPeriod(r: DuesPeriodRow): TeamDuesPeriod {
  return {
    id: r.id,
    teamId: r.team_id,
    periodMonth: r.period_month,
    monthlyAmount: r.monthly_amount,
    dueDate: r.due_date ?? undefined,
    memo: r.memo ?? undefined,
    createdAt: new Date(r.created_at).getTime(),
    createdBy: r.created_by ?? undefined,
  };
}

type DuesPaymentRow = {
  id: string;
  period_id: string;
  player_id: string;
  status: TeamDuesPaymentStatus;
  amount_paid: number;
  paid_at: string | null;
  memo: string | null;
  recorded_by: string | null;
  updated_at: string;
  profiles?: { name: string | null } | null;
};

function rowToDuesPayment(r: DuesPaymentRow): TeamDuesPayment {
  return {
    id: r.id,
    periodId: r.period_id,
    playerId: r.player_id,
    playerName: r.profiles?.name ?? undefined,
    status: r.status,
    amountPaid: r.amount_paid,
    paidAt: r.paid_at ? new Date(r.paid_at).getTime() : undefined,
    memo: r.memo ?? undefined,
    recordedBy: r.recorded_by ?? undefined,
    updatedAt: new Date(r.updated_at).getTime(),
  };
}

type DuesExpenseRow = {
  id: string;
  team_id: string;
  occurred_on: string;
  category: string | null;
  amount: number;
  memo: string | null;
  created_at: string;
  created_by: string | null;
};

function rowToDuesExpense(r: DuesExpenseRow): TeamDuesExpense {
  return {
    id: r.id,
    teamId: r.team_id,
    occurredOn: r.occurred_on,
    category: r.category ?? undefined,
    amount: r.amount,
    memo: r.memo ?? undefined,
    createdAt: new Date(r.created_at).getTime(),
    createdBy: r.created_by ?? undefined,
  };
}

function friendlyError(raw: string | undefined | null): string {
  const m = (raw ?? "").toLowerCase();
  if (m.includes("rate_limit_exceeded")) {
    return "짧은 시간에 너무 많이 시도했어요. 잠시 후 다시 시도해주세요.";
  }
  return raw && raw.length > 0 ? raw : "알 수 없는 오류가 발생했습니다";
}

export const useDataStore = create<DataState>((setState, getState) => ({
  players: {},
  teams: {},
  teamsLoading: false,
  liveMatches: [],
  liveMatchesLoading: false,
  tournaments: {},
  currentSeason: null,
  standings: [],
  standingsLoading: false,
  loading: false,

  // ===== Read =====
  fetchPlayers: async () => {
    if (isDemoMode) {
      const players = getLocalPlayers();
      const list = Object.entries(players).map(([id, p]) => ({ ...p, id }));
      setState({ players });
      return list;
    }
    const { data, error } = await supabase.from("profiles").select("*");
    if (error) {
      console.error("[dataStore] fetchPlayers:", error.message);
      return [];
    }
    const players: Record<string, Player> = {};
    const list: Player[] = [];
    for (const row of data ?? []) {
      const p = rowToPlayer(row);
      players[p.id] = p;
      list.push(p);
    }
    setState({ players });
    return list;
  },

  fetchPlayer: async (id) => {
    if (isDemoMode) {
      const players = getLocalPlayers();
      const player = players[id] || null;
      if (player) setState((s) => ({ players: { ...s.players, [id]: player } }));
      return player;
    }
    const cached = getState().players[id];
    if (cached) return cached;
    const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    if (error) { console.error("[dataStore] fetchPlayer:", error.message); return null; }
    if (!data) return null;
    const player = rowToPlayer(data);
    setState((s) => ({ players: { ...s.players, [id]: player } }));
    return player;
  },

  fetchTeams: async () => {
    if (isDemoMode) {
      const teams = getLocalTeams();
      setState({ teams, teamsLoading: false });
      return Object.entries(teams).map(([id, t]) => ({ ...t, id }));
    }
    setState({ teamsLoading: true });
    const { data, error } = await supabase.from("teams").select("*");
    if (error) {
      console.error("[dataStore] fetchTeams:", error.message);
      setState({ teamsLoading: false });
      return [];
    }
    const teams: Record<string, Team> = {};
    const list: Team[] = [];
    for (const row of data ?? []) {
      const t = rowToTeam(row);
      teams[t.id] = t;
      list.push(t);
    }
    setState({ teams, teamsLoading: false });
    return list;
  },

  fetchTeam: async (id) => {
    if (isDemoMode) {
      const teams = getLocalTeams();
      const team = teams[id] || null;
      if (team) setState((s) => ({ teams: { ...s.teams, [id]: team } }));
      return team;
    }
    const cached = getState().teams[id];
    if (cached) return cached;
    const { data, error } = await supabase.from("teams").select("*").eq("id", id).maybeSingle();
    if (error) { console.error("[dataStore] fetchTeam:", error.message); return null; }
    if (!data) return null;
    const team = rowToTeam(data);
    setState((s) => ({ teams: { ...s.teams, [id]: team } }));
    return team;
  },

  fetchTeamPlayers: async (teamId) => {
    if (isDemoMode) {
      const players = getLocalPlayers();
      return Object.entries(players).filter(([, p]) => p.teamId === teamId).map(([id, p]) => ({ ...p, id }));
    }
    const { data, error } = await supabase.from("profiles").select("*").eq("team_id", teamId);
    if (error) { console.error("[dataStore] fetchTeamPlayers:", error.message); return []; }
    return (data ?? []).map(rowToPlayer);
  },

  fetchTournaments: async () => {
    if (isDemoMode) {
      const t = getLocalTournaments();
      const list = Object.entries(t).map(([id, v]) => ({ ...v, id }));
      const record: Record<string, Tournament> = {};
      list.forEach((tt) => { record[tt.id] = tt; });
      setState({ tournaments: record });
      return list;
    }
    const { data, error } = await supabase.from("tournaments").select("*");
    if (error) { console.error("[dataStore] fetchTournaments:", error.message); return []; }
    const record: Record<string, Tournament> = {};
    const list: Tournament[] = [];
    for (const row of data ?? []) {
      const t = rowToTournament(row);
      record[t.id] = t;
      list.push(t);
    }
    setState({ tournaments: record });
    return list;
  },

  // fairground 호환 별칭. fetchTournaments 와 동일 동작.
  fetchAllTournaments: async () => getState().fetchTournaments(),

  fetchTournament: async (id) => {
    if (isDemoMode) {
      const t = getLocalTournaments()[id] || null;
      if (t) setState((s) => ({ tournaments: { ...s.tournaments, [id]: t } }));
      return t;
    }
    const cached = getState().tournaments[id];
    if (cached) return cached;
    const { data, error } = await supabase.from("tournaments").select("*").eq("id", id).maybeSingle();
    if (error) { console.error("[dataStore] fetchTournament:", error.message); return null; }
    if (!data) return null;
    const tournament = rowToTournament(data);
    setState((s) => ({ tournaments: { ...s.tournaments, [id]: tournament } }));
    return tournament;
  },

  fetchMatches: async (tournamentId) => {
    if (isDemoMode) {
      const all = getLocalMatches();
      const tMatches = all[tournamentId] || {};
      return Object.entries(tMatches).map(([id, m]) => ({ ...m, id, events: eventsToArray(m.events) }));
    }
    const { data, error } = await supabase.from("matches").select("*").eq("tournament_id", tournamentId);
    if (error) { console.error("[dataStore] fetchMatches:", error.message); return []; }
    return Promise.all((data ?? []).map(async (row) => rowToMatch(row, await fetchEvents(row.id))));
  },

  fetchMatch: async (tournamentId, matchId) => {
    if (isDemoMode) {
      const all = getLocalMatches();
      const m = all[tournamentId]?.[matchId] || null;
      return m ? { ...m, events: eventsToArray(m.events) } : null;
    }
    const { data, error } = await supabase.from("matches").select("*").eq("id", matchId).maybeSingle();
    if (error) { console.error("[dataStore] fetchMatch:", error.message); return null; }
    if (!data) return null;
    return rowToMatch(data, await fetchEvents(matchId));
  },

  fetchStandings: async () => {
    if (isDemoMode) { setState({ standingsLoading: false, loading: false }); return; }
    setState({ standingsLoading: true, loading: true });
    // 그린필드: 별도 standings 노드 없음 → teams.season_stats 에서 파생.
    const [{ data: teams, error: tErr }, { data: seasons }] = await Promise.all([
      supabase.from("teams").select("*"),
      supabase.from("seasons").select("*").eq("is_active", true).limit(1),
    ]);
    if (tErr) {
      console.error("[dataStore] fetchStandings:", tErr.message);
      setState({ standingsLoading: false, loading: false });
      return;
    }
    const currentSeason = seasons && seasons.length ? rowToSeason(seasons[0]) : null;
    const standings: TeamStanding[] = (teams ?? [])
      .map((row) => {
        const t = rowToTeam(row);
        const ss = t.seasonStats;
        // 연속참여는 더 이상 승점에 가산하지 않는다. 대신 대진 편성 시
        // "휴식 시드 우선권"으로 보상한다(lib/fixture-scheduler). 순위 points 는
        // 순수 경기 승점만 반영. participationBonus 는 0으로 유지(표시 제거).
        return {
          teamId: t.id,
          teamName: t.name,
          teamLogo: t.logo,
          matchPoints: ss.points,
          participationBonus: 0,
          points: ss.points,
          rank: ss.rank,
          wins: ss.wins,
          draws: ss.draws,
          losses: ss.losses,
          goalsFor: ss.goalsFor,
          goalsAgainst: ss.goalsAgainst,
          goalDifference: ss.goalDifference,
          gamesPlayed: ss.gamesPlayed,
        };
      })
      .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor);
    setState({ currentSeason, standings, standingsLoading: false, loading: false });
  },

  subscribeLiveMatches: () => {
    if (isDemoMode) {
      const live = getLocalLive();
      const liveMatches = Object.entries(live).map(([id, m]) => ({ ...m, id }));
      setState({ liveMatches, liveMatchesLoading: false });
      return () => {};
    }
    setState({ liveMatchesLoading: true });

    const load = async () => {
      const { data, error } = await supabase.from("matches").select("*").eq("status", "live");
      if (error) {
        console.error("[dataStore] subscribeLiveMatches:", error.message);
        setState({ liveMatchesLoading: false });
        return;
      }
      const withEvents = await Promise.all(
        (data ?? []).map(async (row) => rowToLiveMatch(row, await fetchEvents(row.id))),
      );
      setState({ liveMatches: withEvents, liveMatchesLoading: false });
    };

    void load();
    // Realtime: matches/match_events 변경 시 재로딩 (Firebase onValue 대체).
    const channel = supabase
      .channel("web-live-matches")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "match_events" }, () => void load())
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  },

  // ===== Write (운영/심판 콘솔) =====
  createTeam: async (team) => {
    if (isDemoMode) {
      const id = generateId();
      const newTeam = { ...team, id };
      const teams = getLocalTeams();
      teams[id] = newTeam;
      saveLocalTeams(teams);
      setState((s) => ({ teams: { ...s.teams, [id]: newTeam } }));
      return id;
    }
    const { data, error } = await supabase
      .from("teams")
      .insert(teamToInsert({ ...team, captainId: team.captainId || undefined }))
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message ?? "createTeam failed");
    const created = rowToTeam(data);
    setState((s) => ({ teams: { ...s.teams, [created.id]: created } }));
    return created.id;
  },

  updateTeam: async (id, data) => {
    if (isDemoMode) {
      const teams = getLocalTeams();
      if (teams[id]) {
        teams[id] = { ...teams[id], ...data };
        saveLocalTeams(teams);
        setState((s) => ({ teams: { ...s.teams, [id]: { ...s.teams[id], ...data } } }));
      }
      return;
    }
    const { error } = await supabase.from("teams").update(teamPatchToRow(data)).eq("id", id);
    if (error) { console.error("[dataStore] updateTeam:", error.message); throw new Error(error.message); }
    setState((s) => ({
      teams: { ...s.teams, [id]: s.teams[id] ? { ...s.teams[id], ...data } : s.teams[id] },
    }));
  },

  // 승강 RPC 공통 처리 — 호출 후 해당 팀 재조회로 상태 반영. admin 검증은 RPC 내부.
  recordParticipation: async (teamId) => {
    if (isDemoMode) throw new Error("데모 모드에서는 처리할 수 없습니다");
    const { error } = await supabase.rpc("record_participation", { p_team_id: teamId });
    if (error) { console.error("[dataStore] recordParticipation:", error.message); throw new Error(friendlyError(error.message)); }
    const fresh = await getState().fetchTeam(teamId);
    if (fresh) setState((s) => ({ teams: { ...s.teams, [teamId]: fresh } }));
  },

  resetParticipationStreak: async (teamId) => {
    if (isDemoMode) throw new Error("데모 모드에서는 처리할 수 없습니다");
    const { error } = await supabase.rpc("reset_participation_streak", { p_team_id: teamId });
    if (error) { console.error("[dataStore] resetParticipationStreak:", error.message); throw new Error(friendlyError(error.message)); }
    const fresh = await getState().fetchTeam(teamId);
    if (fresh) setState((s) => ({ teams: { ...s.teams, [teamId]: fresh } }));
  },

  promoteTeam: async (teamId) => {
    if (isDemoMode) throw new Error("데모 모드에서는 처리할 수 없습니다");
    const { error } = await supabase.rpc("promote_team", { p_team_id: teamId });
    if (error) { console.error("[dataStore] promoteTeam:", error.message); throw new Error(friendlyError(error.message)); }
    const fresh = await getState().fetchTeam(teamId);
    if (fresh) setState((s) => ({ teams: { ...s.teams, [teamId]: fresh } }));
  },

  relegateTeam: async (teamId) => {
    if (isDemoMode) throw new Error("데모 모드에서는 처리할 수 없습니다");
    const { error } = await supabase.rpc("relegate_team", { p_team_id: teamId });
    if (error) { console.error("[dataStore] relegateTeam:", error.message); throw new Error(friendlyError(error.message)); }
    const fresh = await getState().fetchTeam(teamId);
    if (fresh) setState((s) => ({ teams: { ...s.teams, [teamId]: fresh } }));
  },

  createTournament: async (tournament) => {
    if (isDemoMode) {
      const id = generateId();
      const newTournament = { ...tournament, id };
      const tournaments = getLocalTournaments();
      tournaments[id] = newTournament;
      saveLocalTournaments(tournaments);
      setState((s) => ({ tournaments: { ...s.tournaments, [id]: newTournament } }));
      return id;
    }
    const { data, error } = await supabase
      .from("tournaments")
      .insert(tournamentToInsert(tournament))
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message ?? "createTournament failed");
    const created = rowToTournament(data);
    setState((s) => ({ tournaments: { ...s.tournaments, [created.id]: created } }));
    return created.id;
  },

  createMatch: async (tournamentId, match) => {
    if (isDemoMode) {
      const id = generateId();
      const newMatch = { ...match, id };
      const all = getLocalMatches();
      if (!all[tournamentId]) all[tournamentId] = {};
      all[tournamentId][id] = newMatch;
      saveLocalMatches(all);
      return id;
    }
    const { data, error } = await supabase
      .from("matches")
      .insert(matchToInsert({ ...match, tournamentId }))
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "createMatch failed");
    return data.id;
  },

  startMatch: async (tournamentId, matchId) => {
    if (isDemoMode) {
      const all = getLocalMatches();
      const m = all[tournamentId]?.[matchId];
      if (!m) return;
      m.status = "live";
      all[tournamentId][matchId] = m;
      saveLocalMatches(all);
      const live = getLocalLive();
      live[matchId] = { ...m, status: "live", currentHalf: 1, elapsedSeconds: 0, isRunning: true };
      saveLocalLive(live);
      setState({ liveMatches: Object.entries(live).map(([id, v]) => ({ ...v, id })) });
      return;
    }
    const { error } = await supabase.rpc("start_match", {
      p_match_id: matchId,
    });
    if (error) { console.error("[dataStore] startMatch:", error.message); throw new Error(error.message); }
  },

  pauseMatch: async (matchId) => {
    if (isDemoMode) {
      const live = getLocalLive();
      if (live[matchId]) {
        live[matchId].isRunning = false;
        saveLocalLive(live);
        setState({ liveMatches: Object.entries(live).map(([id, v]) => ({ ...v, id })) });
      }
      return;
    }
    const { error } = await supabase.rpc("pause_match", {
      p_match_id: matchId,
    });
    if (error) {
      console.error("[dataStore] pauseMatch:", error.message);
      throw new Error(error.message);
    }
  },

  resumeMatch: async (matchId) => {
    if (isDemoMode) {
      const live = getLocalLive();
      if (live[matchId]) {
        live[matchId].isRunning = true;
        saveLocalLive(live);
        setState({ liveMatches: Object.entries(live).map(([id, v]) => ({ ...v, id })) });
      }
      return;
    }
    const { error } = await supabase.rpc("resume_match", {
      p_match_id: matchId,
    });
    if (error) {
      console.error("[dataStore] resumeMatch:", error.message);
      throw new Error(error.message);
    }
  },

  endMatch: async (tournamentId, matchId) => {
    if (isDemoMode) {
      // 데모 분기: 원본 로직 보존
      const live = getLocalLive();
      const matchData = live[matchId] || null;
      if (!matchData) return;
      const events = eventsToArray(matchData.events as unknown as Record<string, MatchEvent>).filter((e) => !e.isCancelled);
      const all = getLocalMatches();
      if (all[tournamentId]?.[matchId]) {
        all[tournamentId][matchId] = {
          ...all[tournamentId][matchId],
          status: "finished",
          homeScore: matchData.homeScore,
          awayScore: matchData.awayScore,
          events: eventsToArray(matchData.events as unknown as Record<string, MatchEvent>),
          momPlayerId: matchData.momPlayerId,
        };
        saveLocalMatches(all);
      }
      delete live[matchId];
      saveLocalLive(live);
      setState({ liveMatches: Object.entries(live).map(([id, v]) => ({ ...v, id })) });
      const players = getLocalPlayers();
      const homePlayers = Object.values(players).filter((p) => p.teamId === matchData.homeTeamId);
      const awayPlayers = Object.values(players).filter((p) => p.teamId === matchData.awayTeamId);
      for (const p of [...homePlayers, ...awayPlayers]) {
        p.stats.games = (p.stats.games || 0) + 1;
        const goals = events.filter((e) => e.type === "goal" && e.playerId === p.id).length;
        const assists = events.filter((e) => e.type === "assist" && e.playerId === p.id).length;
        const yellows = events.filter((e) => e.type === "yellow_card" && e.playerId === p.id).length;
        p.stats.goals = (p.stats.goals || 0) + goals;
        p.stats.assists = (p.stats.assists || 0) + assists;
        if (matchData.momPlayerId === p.id) p.stats.mom = (p.stats.mom || 0) + 1;
        p.penaltyStatus.seasonYellowCards = (p.penaltyStatus.seasonYellowCards || 0) + yellows;
        p.cardRating = calculateCardRating(p.stats);
        players[p.id] = p;
      }
      saveLocalPlayers(players);
      return;
    }

    // Supabase: 단일 트랜잭션 RPC. 멱등(stats_applied) — 더블탭/재시도 안전.
    // 점수/MOM 은 라이브 중 matches 행에 이미 반영됨. RPC가 개인 통계,
    // 카드 레이팅, 팀 season_stats, status='finished' 처리를 함께 수행한다.
    const { error } = await supabase.rpc("end_match", { p_match_id: matchId });
    if (error) {
      console.error("[dataStore] endMatch RPC:", error.message);
      throw new Error(error.message);
    }
  },

  forfeitMatch: async (matchId, forfeitTeamId) => {
    if (isDemoMode) {
      const live = getLocalLive();
      const all = getLocalMatches();
      // 데모: 토너먼트 키를 모르므로 전체에서 매치 검색.
      for (const [tid, matches] of Object.entries(all)) {
        const mm = matches[matchId];
        if (!mm) continue;
        const homeForfeit = mm.homeTeamId === forfeitTeamId;
        all[tid][matchId] = {
          ...mm,
          status: "finished",
          homeScore: homeForfeit ? 0 : 3,
          awayScore: homeForfeit ? 3 : 0,
        };
        saveLocalMatches(all);
        break;
      }
      if (live[matchId]) { delete live[matchId]; saveLocalLive(live); }
      setState({ liveMatches: Object.entries(getLocalLive()).map(([id, v]) => ({ ...v, id })) });
      return;
    }
    const { error } = await supabase.rpc("forfeit_match", {
      p_match_id: matchId,
      p_forfeit_team_id: forfeitTeamId,
    });
    if (error) {
      console.error("[dataStore] forfeitMatch RPC:", error.message);
      throw new Error(error.message);
    }
  },

  substitutePlayer: async (matchId, teamId, outId, inId, inName, minute, half) => {
    if (isDemoMode) {
      // 데모 모드에는 라인업 로컬 저장소가 없음(match_lineups 는 Supabase 전용).
      // 교체할 로컬 상태가 없으므로 no-op 으로 둔다.
      return;
    }
    // Supabase: 서버 RPC 가 권한(팀 스태프/admin)·라이브 상태·OUT 선발/IN 벤치 검증,
    // is_starter 스왑 + substitution 이벤트 삽입을 단일 트랜잭션으로 처리.
    const { error } = await supabase.rpc("substitute_player", {
      p_match_id: matchId,
      p_team_id: teamId,
      p_out_player_id: outId,
      p_in_player_id: inId,
      p_in_player_name: inName,
      p_minute: minute,
      p_half: half,
    });
    if (error) {
      console.error("[dataStore] substitutePlayer RPC:", error.message);
      throw new Error(error.message);
    }
  },

  addMatchEvent: async (tournamentId, matchId, eventData) => {
    if (isDemoMode) {
      const eventId = generateId();
      const event: MatchEvent = { ...eventData, id: eventId, timestamp: Date.now() };
      const all = getLocalMatches();
      const m = all[tournamentId]?.[matchId];
      if (m) {
        const events = eventsToArray(m.events);
        events.push(event);
        m.events = events;
        if (event.type === "goal") {
          if (event.teamId === m.homeTeamId) m.homeScore = (m.homeScore || 0) + 1;
          else m.awayScore = (m.awayScore || 0) + 1;
        }
        all[tournamentId][matchId] = m;
        saveLocalMatches(all);
      }
      const live = getLocalLive();
      if (live[matchId]) {
        const lEvents = eventsToArray(live[matchId].events as unknown as Record<string, MatchEvent>);
        lEvents.push(event);
        live[matchId].events = lEvents;
        if (event.type === "goal") {
          if (event.teamId === live[matchId].homeTeamId) live[matchId].homeScore = (live[matchId].homeScore || 0) + 1;
          else live[matchId].awayScore = (live[matchId].awayScore || 0) + 1;
        }
        saveLocalLive(live);
        setState({ liveMatches: Object.entries(live).map(([id, v]) => ({ ...v, id })) });
      }
      return;
    }

    const { error } = await supabase.rpc("add_match_event", {
      p_match_id: matchId,
      p_type: eventData.type,
      p_player_id: eventData.playerId,
      p_player_name: eventData.playerName,
      p_team_id: eventData.teamId,
      p_minute: eventData.minute,
      p_half: eventData.half,
    });
    if (error) {
      console.error("[dataStore] addMatchEvent RPC:", error.message);
      throw new Error(error.message);
    }
  },

  cancelMatchEvent: async (_tournamentId, matchId, eventId) => {
    if (isDemoMode) {
      const live = getLocalLive();
      if (live[matchId]) {
        const events = eventsToArray(live[matchId].events as unknown as Record<string, MatchEvent>);
        const evt = events.find((e) => e.id === eventId);
        if (evt && !evt.isCancelled) {
          evt.isCancelled = true;
          if (evt.type === "goal") {
            if (evt.teamId === live[matchId].homeTeamId) live[matchId].homeScore = Math.max(0, live[matchId].homeScore - 1);
            else live[matchId].awayScore = Math.max(0, live[matchId].awayScore - 1);
          }
          live[matchId].events = events;
          saveLocalLive(live);
          setState({ liveMatches: Object.entries(live).map(([id, v]) => ({ ...v, id })) });
        }
      }
      return;
    }

    const { error } = await supabase.rpc("cancel_match_event", {
      p_match_id: matchId,
      p_event_id: eventId,
    });
    if (error) {
      console.error("[dataStore] cancelMatchEvent RPC:", error.message);
      throw new Error(error.message);
    }
  },

  updateMatchTimer: async (matchId, elapsedSeconds, currentHalf) => {
    if (isDemoMode) {
      const live = getLocalLive();
      if (live[matchId]) {
        live[matchId].elapsedSeconds = elapsedSeconds;
        live[matchId].currentHalf = currentHalf;
        saveLocalLive(live);
      }
      return;
    }
    const { error } = await supabase.rpc("update_match_timer", {
      p_match_id: matchId,
      p_elapsed_seconds: elapsedSeconds,
      p_current_half: currentHalf,
    });
    if (error) {
      console.error("[dataStore] updateMatchTimer:", error.message);
      throw new Error(error.message);
    }
  },

  notifyNextMatchReady: async (matchId) => {
    if (isDemoMode) return 0;
    const { data, error } = await supabase.rpc("notify_next_match_ready", {
      p_match_id: matchId,
    });
    if (error) {
      console.error("[dataStore] notifyNextMatchReady:", error.message);
      throw new Error(error.message);
    }
    return data ?? 0;
  },

  setMatchMom: async (tournamentId, matchId, playerId) => {
    if (isDemoMode) {
      const live = getLocalLive();
      if (live[matchId]) {
        live[matchId].momPlayerId = playerId;
        saveLocalLive(live);
        setState({ liveMatches: Object.entries(live).map(([id, v]) => ({ ...v, id })) });
      }
      const all = getLocalMatches();
      if (all[tournamentId]?.[matchId]) {
        all[tournamentId][matchId].momPlayerId = playerId;
        saveLocalMatches(all);
      }
      return;
    }
    const { error } = await supabase.rpc("set_match_mom", {
      p_match_id: matchId,
      p_player_id: playerId,
    });
    if (error) { console.error("[dataStore] setMatchMom RPC:", error.message); throw new Error(error.message); }
  },

  // ===== Notices =====
  // 데모 모드는 비활성(Supabase 전용). 데모 환경에서는 빈 배열을 안전히 반환.
  fetchNotices: async (opts) => {
    if (isDemoMode) return [];
    let q = supabase
      .from("notices")
      .select("*, profiles:author_id(name,role)")
      .order("is_pinned", { ascending: false })
      .order("published_at", { ascending: false });
    if (opts?.category) q = q.eq("category", opts.category);
    // teamId 시맨틱: 미지정(undefined) 또는 null → 글로벌만(team_id IS NULL).
    //   문자열 id → 해당 팀 스코프만(team_id = id).
    if (typeof opts?.teamId === "string") {
      q = q.eq("team_id", opts.teamId);
    } else {
      q = q.is("team_id", null);
    }
    const { data, error } = await q;
    if (error) {
      console.error("[dataStore] fetchNotices:", error.message);
      return [];
    }
    return (data ?? []).map(rowToNotice);
  },

  fetchNotice: async (id) => {
    if (isDemoMode) return null;
    const { data, error } = await supabase
      .from("notices")
      .select("*, profiles:author_id(name,role)")
      .eq("id", id)
      .maybeSingle();
    if (error) { console.error("[dataStore] fetchNotice:", error.message); return null; }
    return data ? rowToNotice(data) : null;
  },

  createNotice: async (input) => {
    if (isDemoMode) throw new Error("데모 모드에서는 공지를 작성할 수 없습니다");
    const { data, error } = await supabase
      .from("notices")
      .insert(noticeToInsert(input))
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "createNotice failed");
    return data.id;
  },

  updateNotice: async (id, patch) => {
    if (isDemoMode) throw new Error("데모 모드에서는 공지를 수정할 수 없습니다");
    const { error } = await supabase.from("notices").update(noticePatchToRow(patch)).eq("id", id);
    if (error) { console.error("[dataStore] updateNotice:", error.message); throw new Error(error.message); }
  },

  deleteNotice: async (id) => {
    if (isDemoMode) throw new Error("데모 모드에서는 공지를 삭제할 수 없습니다");
    const { error } = await supabase.from("notices").delete().eq("id", id);
    if (error) { console.error("[dataStore] deleteNotice:", error.message); throw new Error(error.message); }
  },

  // ===== Board posts =====
  fetchBoardPosts: async (opts) => {
    if (isDemoMode) return [];
    const sortField = opts?.sort === "comments" ? "comment_count" : "created_at";
    let q = supabase
      .from("board_posts")
      .select("*, profiles:author_id(name,role)")
      .order(sortField, { ascending: false });
    if (opts?.category) q = q.eq("category", opts.category);
    // teamId 시맨틱: 미지정(undefined) 또는 null → 글로벌만(team_id IS NULL).
    //   문자열 id → 해당 팀 스코프만(team_id = id).
    if (typeof opts?.teamId === "string") {
      q = q.eq("team_id", opts.teamId);
    } else {
      q = q.is("team_id", null);
    }
    const { data, error } = await q;
    if (error) {
      console.error("[dataStore] fetchBoardPosts:", error.message);
      return [];
    }
    return (data ?? []).map(rowToBoardPost);
  },

  fetchBoardPost: async (id, opts) => {
    if (isDemoMode) return null;
    // 조회수 증가는 멱등이 아니므로 페이지에서 useRef 가드로 1회만 호출.
    if (opts?.bumpView) {
      const { error: bumpErr } = await supabase.rpc("bump_post_view", { p_post_id: id });
      if (bumpErr) console.error("[dataStore] bump_post_view:", bumpErr.message);
    }
    const { data, error } = await supabase
      .from("board_posts")
      .select("*, profiles:author_id(name,role)")
      .eq("id", id)
      .maybeSingle();
    if (error) { console.error("[dataStore] fetchBoardPost:", error.message); return null; }
    return data ? rowToBoardPost(data) : null;
  },

  createBoardPost: async (input) => {
    if (isDemoMode) throw new Error("데모 모드에서는 게시글을 작성할 수 없습니다");
    const { data, error } = await supabase
      .from("board_posts")
      .insert(boardPostToInsert(input))
      .select("id")
      .single();
    if (error || !data) throw new Error(friendlyError(error?.message ?? "createBoardPost failed"));
    return data.id;
  },

  updateBoardPost: async (id, patch) => {
    if (isDemoMode) throw new Error("데모 모드에서는 게시글을 수정할 수 없습니다");
    const { error } = await supabase
      .from("board_posts")
      .update(boardPostPatchToRow(patch))
      .eq("id", id);
    if (error) { console.error("[dataStore] updateBoardPost:", error.message); throw new Error(error.message); }
  },

  deleteBoardPost: async (id) => {
    if (isDemoMode) throw new Error("데모 모드에서는 게시글을 삭제할 수 없습니다");
    const { error } = await supabase.from("board_posts").delete().eq("id", id);
    if (error) { console.error("[dataStore] deleteBoardPost:", error.message); throw new Error(error.message); }
  },

  // ===== Board comments =====
  fetchComments: async (postId) => {
    if (isDemoMode) return [];
    const { data, error } = await supabase
      .from("board_comments")
      .select("*, profiles:author_id(name,role)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[dataStore] fetchComments:", error.message);
      return [];
    }
    return (data ?? []).map(rowToBoardComment);
  },

  addComment: async (postId, body, authorId, parentCommentId) => {
    if (isDemoMode) throw new Error("데모 모드에서는 댓글을 작성할 수 없습니다");
    const { data, error } = await supabase
      .from("board_comments")
      .insert(boardCommentToInsert({ postId, body, authorId, parentCommentId }))
      .select("id")
      .single();
    if (error || !data) throw new Error(friendlyError(error?.message ?? "addComment failed"));
    return data.id;
  },

  updateComment: async (commentId, body) => {
    if (isDemoMode) throw new Error("데모 모드에서는 댓글을 수정할 수 없습니다");
    const { error } = await supabase
      .from("board_comments")
      .update({ body })
      .eq("id", commentId);
    if (error) { console.error("[dataStore] updateComment:", error.message); throw new Error(error.message); }
  },

  deleteComment: async (commentId) => {
    if (isDemoMode) throw new Error("데모 모드에서는 댓글을 삭제할 수 없습니다");
    const { error } = await supabase.from("board_comments").delete().eq("id", commentId);
    if (error) { console.error("[dataStore] deleteComment:", error.message); throw new Error(error.message); }
  },

  // ===== Moderation =====
  createReport: async (targetType, targetId, reason, body) => {
    if (isDemoMode) throw new Error("데모 모드에서는 신고할 수 없습니다");
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("로그인이 필요합니다");
    const { error } = await supabase.from("reports").insert({
      reporter_id: u.user.id,
      target_type: targetType,
      target_id: targetId,
      reason,
      body: body ?? null,
    });
    if (error) {
      if (error.code === "23505") {
        throw new Error("이미 신고하신 내용입니다");
      }
      throw new Error(friendlyError(error.message));
    }
  },

  fetchPendingReports: async () => {
    const { data, error } = await supabase
      .from("reports")
      .select("*, profiles:reporter_id(name)")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) { console.error("[dataStore] fetchPendingReports:", error.message); return []; }
    return ((data ?? []) as unknown as Parameters<typeof rowToReport>[0][]).map(rowToReport);
  },

  resolveReport: async (id, action) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("로그인이 필요합니다");
    const status = action === "resolve" ? "resolved" : "dismissed";
    const { error } = await supabase
      .from("reports")
      .update({
        status,
        resolved_by: u.user.id,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
  },

  hideTarget: async (targetType, targetId, hide) => {
    const tbl =
      targetType === "post" ? "board_posts"
      : targetType === "comment" ? "board_comments"
      : "team_gallery_photos";
    const { error } = await supabase
      .from(tbl)
      .update({ is_hidden: hide })
      .eq("id", targetId);
    if (error) throw new Error(error.message);
    // hidden 처리 시 활동 피드에서도 해당 row 제거 (admin RLS로 허용).
    if (hide) {
      const col = targetType === "post" ? "post_id" : targetType === "comment" ? "comment_id" : "photo_id";
      await supabase.from("activity_events").delete().eq(col, targetId);
    }
  },

  // ===== Team roles =====
  // fetchTeamMembers: 의미 명확성을 위한 별칭. 권한·필터는 RLS·UI 가드에서 처리.
  fetchTeamMembers: async (teamId) => {
    return getState().fetchTeamPlayers(teamId);
  },

  claimTeamCoach: async (teamId) => {
    if (isDemoMode) return;
    const { error } = await supabase.rpc("claim_team_coach", {
      p_team_id: teamId,
    });
    if (error) {
      console.error("[dataStore] claimTeamCoach:", error.message);
      throw new Error(error.message);
    }
    const fresh = await getState().fetchTeam(teamId);
    if (fresh) {
      setState((s) => ({ teams: { ...s.teams, [teamId]: fresh } }));
    }
  },

  // 멤버 역할 변경. 최종 강제는 security definer RPC(set_team_member_role).
  // - 본인이 본인 team_role 변경 → 거부
  // - 감독/admin/captain_id 소유자 → 모든 팀 역할 지정 가능
  // - manager → manager/captain/member 지정 가능
  updatePlayerTeamRole: async (playerId, teamRole) => {
    if (isDemoMode) throw new Error("데모 모드에서는 팀 역할을 변경할 수 없습니다");
    const { error } = await supabase.rpc("set_team_member_role", {
      p_player_id: playerId,
      p_team_role: teamRole,
    });
    if (error) {
      console.error("[dataStore] updatePlayerTeamRole:", error.message);
      throw new Error(error.message);
    }
  },

  // 팀 소유권(captain_id) 이전 — 현재 소유자(또는 admin)만. 새 소유자는 같은 팀의
  // 승인된 멤버여야 한다. 서버 RPC(transfer_team_ownership)+트리거가 최종 강제.
  transferTeamOwnership: async (teamId, newOwnerId) => {
    if (isDemoMode) throw new Error("데모 모드에서는 소유권을 이전할 수 없습니다");
    const { error } = await supabase.rpc("transfer_team_ownership", {
      p_team_id: teamId,
      p_new_owner_id: newOwnerId,
    });
    if (error) {
      console.error("[dataStore] transferTeamOwnership:", error.message);
      throw new Error(error.message);
    }
  },

  // 감독 신청 대기 큐 (admin 전용 UX, RLS 가 anon/일반에 차단).
  // 조건: team_role='coach' AND is_approved=false.
  fetchPendingCoachApplications: async () => {
    if (isDemoMode) return [];
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("team_role", "coach")
      .eq("is_approved", false);
    if (error) {
      console.error("[dataStore] fetchPendingCoachApplications:", error.message);
      return [];
    }
    return (data ?? []).map(rowToPlayer);
  },

  // 감독 승인 — admin 전용. RLS 가 차단 시 호출부에서 에러 표시.
  approveCoach: async (playerId) => {
    if (isDemoMode) throw new Error("데모 모드에서는 승인을 할 수 없습니다");
    const { error } = await supabase.rpc("set_player_approval", {
      p_player_id: playerId,
      p_is_approved: true,
    });
    if (error) {
      console.error("[dataStore] approveCoach:", error.message);
      throw new Error(error.message);
    }
  },

  // ===== Community Engine =====
  toggleReaction: async (target, id) => {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) throw new Error("로그인이 필요합니다");
    const userId = userRes.user.id;

    if (target === "post") {
      const { data: existing } = await supabase
        .from("post_reactions")
        .select("user_id")
        .eq("post_id", id)
        .eq("user_id", userId)
        .maybeSingle();
      if (existing) {
        await supabase.from("post_reactions").delete().eq("post_id", id).eq("user_id", userId);
      } else {
        const { error: insErr } = await supabase.from("post_reactions").insert({ post_id: id, user_id: userId });
        if (insErr) throw new Error(friendlyError(insErr.message));
      }
      const { data: parent } = await supabase
        .from("board_posts")
        .select("reaction_count")
        .eq("id", id)
        .maybeSingle();
      return { liked: !existing, count: parent?.reaction_count ?? 0 };
    } else {
      const { data: existing } = await supabase
        .from("comment_reactions")
        .select("user_id")
        .eq("comment_id", id)
        .eq("user_id", userId)
        .maybeSingle();
      if (existing) {
        await supabase
          .from("comment_reactions")
          .delete()
          .eq("comment_id", id)
          .eq("user_id", userId);
      } else {
        const { error: insErr } = await supabase
          .from("comment_reactions")
          .insert({ comment_id: id, user_id: userId });
        if (insErr) throw new Error(friendlyError(insErr.message));
      }
      const { data: parent } = await supabase
        .from("board_comments")
        .select("reaction_count")
        .eq("id", id)
        .maybeSingle();
      return { liked: !existing, count: parent?.reaction_count ?? 0 };
    }
  },

  fetchMyReactions: async (target, ids) => {
    if (ids.length === 0) return new Set();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) return new Set();
    const userId = userRes.user.id;
    if (target === "post") {
      const { data } = await supabase
        .from("post_reactions")
        .select("post_id")
        .eq("user_id", userId)
        .in("post_id", ids);
      return new Set((data ?? []).map((r) => r.post_id));
    } else {
      const { data } = await supabase
        .from("comment_reactions")
        .select("comment_id")
        .eq("user_id", userId)
        .in("comment_id", ids);
      return new Set((data ?? []).map((r) => r.comment_id));
    }
  },

  fetchNotifications: async (opts) => {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) return [];
    const userId = userRes.user.id;

    // 두 FK(actor_id, user_id)가 profiles 를 가리키므로 FK 이름으로 명시 disambiguate.
    let q = supabase
      .from("notifications")
      .select("*, profiles!notifications_actor_id_fkey(name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(opts?.limit ?? 20);
    if (opts?.unreadOnly) q = q.is("read_at", null);
    const { data, error } = await q;
    if (error) {
      console.error("[dataStore] fetchNotifications:", error.message);
      return [];
    }
    return (data ?? []).map(rowToNotification);
  },

  fetchUnreadNotificationCount: async () => {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) return 0;
    const userId = userRes.user.id;

    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) {
      console.error("[dataStore] fetchUnreadNotificationCount:", error.message);
      return 0;
    }
    return count ?? 0;
  },

  markNotificationRead: async (id) => {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) throw new Error("로그인이 필요합니다");
    const userId = userRes.user.id;

    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);
    if (error) {
      console.error("[dataStore] markNotificationRead:", error.message);
      throw new Error(friendlyError(error.message));
    }
  },

  markAllNotificationsRead: async () => {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) throw new Error("로그인이 필요합니다");
    const userId = userRes.user.id;

    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) {
      console.error("[dataStore] markAllNotificationsRead:", error.message);
      throw new Error(friendlyError(error.message));
    }
  },

  notifyMentions: async (targetType, targetId, userIds) => {
    if (userIds.length === 0) return;
    const { error } = await supabase.rpc("notify_mentions", {
      p_target_type: targetType,
      p_target_id: targetId,
      p_mentioned_user_ids: userIds,
    });
    if (error) console.error("[dataStore] notifyMentions:", error.message);
  },

  searchProfilesByName: async (query) => {
    if (!query.trim()) return [];
    const { data, error } = await supabase
      .from("profiles")
      .select("id,name,photo_url,profile_photo_url,profile_photo_locked,team_id")
      .ilike("name", `%${query.trim()}%`)
      .limit(8);
    if (error) {
      console.error("[dataStore] searchProfilesByName:", error.message);
      return [];
    }
    return (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      photoUrl: r.profile_photo_locked && r.profile_photo_url ? r.profile_photo_url : r.photo_url ?? r.profile_photo_url ?? "",
      teamId: r.team_id ?? "",
    }));
  },

  uploadTeamPhoto: async (teamId, file, caption, matchId) => {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) throw new Error("로그인이 필요합니다");
    const photoId = crypto.randomUUID();
    const ext = file.type === "image/webp" ? "webp" : "jpg";
    // 버킷 내부 경로: 버킷명 프리픽스 제외.
    const objectPath = `${teamId}/${photoId}.${ext}`;
    const storagePath = `team-galleries/${objectPath}`;
    const { error: upErr } = await supabase.storage
      .from("team-galleries")
      .upload(objectPath, file, {
        contentType: file.type,
        cacheControl: "31536000",
        upsert: false,
      });
    if (upErr) throw new Error(`업로드 실패: ${upErr.message}`);
    const { data: ins, error: insErr } = await supabase
      .from("team_gallery_photos")
      .insert({
        id: photoId,
        team_id: teamId,
        uploaded_by: userRes.user.id,
        storage_path: storagePath,
        caption: caption ?? null,
        match_id: matchId ?? null,
      })
      .select("*, profiles:uploaded_by(name)")
      .single();
    if (insErr || !ins) {
      // 롤백: Storage 파일 삭제
      await supabase.storage.from("team-galleries").remove([objectPath]);
      throw new Error(friendlyError(insErr?.message ?? "메타 저장 실패"));
    }
    const { data: pub } = supabase.storage
      .from("team-galleries")
      .getPublicUrl(objectPath);
    return rowToTeamPhoto(ins, pub.publicUrl);
  },

  deleteTeamPhoto: async (id, storagePath) => {
    const { error: dbErr } = await supabase
      .from("team_gallery_photos")
      .delete()
      .eq("id", id);
    if (dbErr) throw new Error(dbErr.message);
    const objectPath = storagePath.replace(/^team-galleries\//, "");
    await supabase.storage.from("team-galleries").remove([objectPath]);
  },

  fetchTeamPhotos: async (teamId, limit) => {
    const { data, error } = await supabase
      .from("team_gallery_photos")
      .select("*, profiles:uploaded_by(name)")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(limit ?? 60);
    if (error) {
      console.error("[dataStore] fetchTeamPhotos:", error.message);
      return [];
    }
    return (data ?? []).map((r) => {
      const objectPath = (r.storage_path as string).replace(/^team-galleries\//, "");
      const { data: pub } = supabase.storage
        .from("team-galleries")
        .getPublicUrl(objectPath);
      return rowToTeamPhoto(r, pub.publicUrl);
    });
  },

  // ===== Team join requests =====
  // Row → domain. Inline (no shared mapper) because the table is single-purpose.
  requestJoinTeam: async (teamId, message) => {
    if (isDemoMode) throw new Error("데모 모드에서는 가입 신청을 보낼 수 없습니다");
    const { data: { user } } = await supabase.auth.getUser();
    const uid = user?.id;
    if (!uid) throw new Error("로그인이 필요합니다");
    const { data, error } = await supabase
      .from("team_join_requests")
      .insert({
        team_id: teamId,
        player_id: uid,
        message: message?.trim() || null,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "가입 신청에 실패했습니다");
    return data.id;
  },

  fetchTeamJoinRequests: async (teamId, status) => {
    if (isDemoMode) return [];
    let q = supabase
      .from("team_join_requests")
      .select("*, profiles:player_id(name,email,phone,position,number,gender,birth_date), teams:team_id(name)")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) {
      console.error("[dataStore] fetchTeamJoinRequests:", error.message);
      return [];
    }
    return (data ?? []).map((r) => rowToTeamJoinRequest(r as unknown as JoinReqRow));
  },

  fetchMyJoinRequests: async (playerId) => {
    if (isDemoMode) return [];
    const { data, error } = await supabase
      .from("team_join_requests")
      .select("*, profiles:player_id(name,email,phone,position,number,gender,birth_date), teams:team_id(name)")
      .eq("player_id", playerId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[dataStore] fetchMyJoinRequests:", error.message);
      return [];
    }
    return (data ?? []).map((r) => rowToTeamJoinRequest(r as unknown as JoinReqRow));
  },

  setTeamJoinRequestStatus: async (requestId, status) => {
    if (isDemoMode) throw new Error("데모 모드에서는 처리할 수 없습니다");
    const { error } = await supabase
      .from("team_join_requests")
      .update({ status })
      .eq("id", requestId);
    if (error) {
      console.error("[dataStore] setTeamJoinRequestStatus:", error.message);
      throw new Error(error.message);
    }
  },

  // 본인이 제출한 pending 신청을 취소(DELETE). RLS DELETE 정책이
  // (auth.uid() = player_id AND status='pending')일 때만 허용하므로 다른
  // 상태/타인의 행은 서버에서 거부된다.
  cancelMyJoinRequest: async (requestId) => {
    if (isDemoMode) throw new Error("데모 모드에서는 처리할 수 없습니다");
    const { error } = await supabase
      .from("team_join_requests")
      .delete()
      .eq("id", requestId)
      .eq("status", "pending");
    if (error) {
      console.error("[dataStore] cancelMyJoinRequest:", error.message);
      throw new Error(error.message);
    }
  },

  // ===== Team dues =====
  // periods: 월별 회비 사이클. 디렉터만 mutate, 멤버는 read.
  fetchTeamDuesPeriods: async (teamId) => {
    if (isDemoMode) return [];
    const { data, error } = await supabase
      .from("team_dues_periods")
      .select("*")
      .eq("team_id", teamId)
      .order("period_month", { ascending: false });
    if (error) {
      console.error("[dataStore] fetchTeamDuesPeriods:", error.message);
      return [];
    }
    return (data ?? []).map((r) => rowToDuesPeriod(r as DuesPeriodRow));
  },

  createTeamDuesPeriod: async ({ teamId, periodMonth, monthlyAmount, dueDate, memo }) => {
    if (isDemoMode) throw new Error("데모 모드에서는 처리할 수 없습니다");
    const auth = await supabase.auth.getUser();
    const uid = auth.data.user?.id ?? null;
    const { data, error } = await supabase
      .from("team_dues_periods")
      .insert({
        team_id: teamId,
        period_month: periodMonth,
        monthly_amount: monthlyAmount,
        due_date: dueDate ?? null,
        memo: memo ?? null,
        created_by: uid,
      })
      .select("id")
      .single();
    if (error) {
      console.error("[dataStore] createTeamDuesPeriod:", error.message);
      throw new Error(friendlyError(error.message));
    }
    return data.id;
  },

  deleteTeamDuesPeriod: async (periodId) => {
    if (isDemoMode) throw new Error("데모 모드에서는 처리할 수 없습니다");
    const { error } = await supabase
      .from("team_dues_periods")
      .delete()
      .eq("id", periodId);
    if (error) {
      console.error("[dataStore] deleteTeamDuesPeriod:", error.message);
      throw new Error(error.message);
    }
  },

  fetchTeamDuesPayments: async (periodId) => {
    if (isDemoMode) return [];
    const { data, error } = await supabase
      .from("team_dues_payments")
      .select("*, profiles:player_id(name)")
      .eq("period_id", periodId)
      .order("updated_at", { ascending: false });
    if (error) {
      console.error("[dataStore] fetchTeamDuesPayments:", error.message);
      return [];
    }
    return (data ?? []).map((r) => rowToDuesPayment(r as unknown as DuesPaymentRow));
  },

  fetchMyDuesPayments: async (playerId) => {
    if (isDemoMode) return [];
    const { data, error } = await supabase
      .from("team_dues_payments")
      .select("*, profiles:player_id(name)")
      .eq("player_id", playerId)
      .order("updated_at", { ascending: false });
    if (error) {
      console.error("[dataStore] fetchMyDuesPayments:", error.message);
      return [];
    }
    return (data ?? []).map((r) => rowToDuesPayment(r as unknown as DuesPaymentRow));
  },

  setTeamDuesPaymentStatus: async (paymentId, status, amountPaid) => {
    if (isDemoMode) throw new Error("데모 모드에서는 처리할 수 없습니다");
    const patch: { status: TeamDuesPaymentStatus; amount_paid?: number } = { status };
    if (typeof amountPaid === "number") patch.amount_paid = amountPaid;
    const { error } = await supabase
      .from("team_dues_payments")
      .update(patch)
      .eq("id", paymentId);
    if (error) {
      console.error("[dataStore] setTeamDuesPaymentStatus:", error.message);
      throw new Error(error.message);
    }
  },

  fetchTeamDuesExpenses: async (teamId) => {
    if (isDemoMode) return [];
    const { data, error } = await supabase
      .from("team_dues_expenses")
      .select("*")
      .eq("team_id", teamId)
      .order("occurred_on", { ascending: false });
    if (error) {
      console.error("[dataStore] fetchTeamDuesExpenses:", error.message);
      return [];
    }
    return (data ?? []).map((r) => rowToDuesExpense(r as DuesExpenseRow));
  },

  addTeamDuesExpense: async ({ teamId, occurredOn, amount, category, memo }) => {
    if (isDemoMode) throw new Error("데모 모드에서는 처리할 수 없습니다");
    const auth = await supabase.auth.getUser();
    const uid = auth.data.user?.id ?? null;
    const { data, error } = await supabase
      .from("team_dues_expenses")
      .insert({
        team_id: teamId,
        occurred_on: occurredOn,
        amount,
        category: category ?? null,
        memo: memo ?? null,
        created_by: uid,
      })
      .select("id")
      .single();
    if (error) {
      console.error("[dataStore] addTeamDuesExpense:", error.message);
      throw new Error(friendlyError(error.message));
    }
    return data.id;
  },

  deleteTeamDuesExpense: async (expenseId) => {
    if (isDemoMode) throw new Error("데모 모드에서는 처리할 수 없습니다");
    const { error } = await supabase
      .from("team_dues_expenses")
      .delete()
      .eq("id", expenseId);
    if (error) {
      console.error("[dataStore] deleteTeamDuesExpense:", error.message);
      throw new Error(error.message);
    }
  },

  // activity_events 페이지네이션 read. RLS 가 anon select 를 허용.
  // cursor(unix ms) 보다 과거의 행을 created_at desc 로 한 페이지 반환.
  fetchActivityFeed: async (opts) => {
    let q = supabase
      .from("activity_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(opts?.limit ?? 30);
    if (opts?.cursor) {
      q = q.lt("created_at", new Date(opts.cursor).toISOString());
    }
    const { data, error } = await q;
    if (error) {
      console.error("[dataStore] fetchActivityFeed:", error.message);
      return [];
    }
    return (data ?? []).map(rowToActivityEvent);
  },

  searchAll: async (q) => {
    const empty: SearchResults = { posts: [], notices: [], teams: [], players: [] };
    const query = q.trim();
    if (query.length < 1) return empty;
    const escaped = query.replace(/[%_\\]/g, (c) => `\\${c}`);
    const pattern = `%${escaped}%`;
    const limit = 5;

    const [postsRes, noticesRes, teamsRes, playersRes] = await Promise.all([
      supabase
        .from("board_posts")
        .select("id, title, created_at, profiles:author_id(name)")
        .eq("is_hidden", false)
        .or(`title.ilike.${pattern},body.ilike.${pattern}`)
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase
        .from("notices")
        .select("id, title, is_important, created_at")
        .or(`title.ilike.${pattern},body.ilike.${pattern}`)
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase
        .from("teams")
        .select("id, name, logo")
        .eq("is_approved", true)
        .ilike("name", pattern)
        .limit(limit),
      supabase
        .from("profiles")
        .select("id, name, photo_url, profile_photo_url, profile_photo_locked, number, team_id")
        .eq("is_approved", true)
        .ilike("name", pattern)
        .limit(limit),
    ]);

    type PostRow = { id: string; title: string; created_at: string; profiles?: { name: string } | { name: string }[] | null };
    type NoticeRow = { id: string; title: string; is_important: boolean; created_at: string };
    type TeamRow = { id: string; name: string; logo: string };
    type PlayerRow = {
      id: string;
      name: string;
      photo_url: string | null;
      profile_photo_url: string | null;
      profile_photo_locked: boolean | null;
      number: number;
      team_id: string | null;
    };

    const posts = ((postsRes.data ?? []) as unknown as PostRow[]).map((r) => {
      const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      return {
        id: r.id,
        title: r.title,
        authorName: p?.name,
        createdAt: new Date(r.created_at).getTime(),
      };
    });
    const notices = ((noticesRes.data ?? []) as unknown as NoticeRow[]).map((r) => ({
      id: r.id,
      title: r.title,
      isImportant: r.is_important,
      createdAt: new Date(r.created_at).getTime(),
    }));
    const teams = ((teamsRes.data ?? []) as unknown as TeamRow[]).map((r) => ({
      id: r.id, name: r.name, logo: r.logo,
    }));
    const players = ((playersRes.data ?? []) as unknown as PlayerRow[]).map((r) => ({
      id: r.id,
      name: r.name,
      photoUrl: r.profile_photo_locked && r.profile_photo_url ? r.profile_photo_url : r.photo_url ?? r.profile_photo_url ?? undefined,
      number: r.number,
      teamId: r.team_id ?? undefined,
    }));

    return { posts, notices, teams, players };
  },

  // ===== Badges =====
  // badges 마스터 read. 데모 모드는 빈 배열(서버 의존 기능).
  fetchAllBadges: async () => {
    if (isDemoMode) return [];
    const { data, error } = await supabase
      .from("badges")
      .select("id,name,description,category,icon,max_progress,unlock_condition")
      .order("category", { ascending: true })
      .order("id", { ascending: true });
    if (error) {
      console.error("[dataStore] fetchAllBadges:", error.message);
      return [];
    }
    type Row = {
      id: string; name: string; description: string; category: string;
      icon: string | null; max_progress: number | null; unlock_condition: string | null;
    };
    return ((data ?? []) as unknown as Row[]).map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      category: r.category,
      icon: r.icon,
      maxProgress: r.max_progress,
      unlockCondition: r.unlock_condition,
    }));
  },

  fetchMyBadges: async (playerId) => {
    if (isDemoMode) return [];
    const { data, error } = await supabase
      .from("player_badges")
      .select("badge_id,is_earned,progress,earned_at")
      .eq("player_id", playerId);
    if (error) {
      console.error("[dataStore] fetchMyBadges:", error.message);
      return [];
    }
    type Row = { badge_id: string; is_earned: boolean; progress: number; earned_at: string | null };
    return ((data ?? []) as unknown as Row[]).map((r) => ({
      badgeId: r.badge_id,
      isEarned: r.is_earned,
      progress: r.progress ?? 0,
      earnedAt: r.earned_at ? new Date(r.earned_at).getTime() : undefined,
    }));
  },

  updateEquippedBadges: async (playerId, badgeIds) => {
    if (isDemoMode) throw new Error("데모 모드에서는 배지를 장착할 수 없습니다");
    // 최대 4개로 잘라서 저장. 미획득 배지 포함 검증은 호출부+RLS 양쪽에서.
    const clipped = badgeIds.slice(0, 4);
    const { error } = await supabase
      .from("profiles")
      .update({ badges: clipped })
      .eq("id", playerId);
    if (error) {
      console.error("[dataStore] updateEquippedBadges:", error.message);
      throw new Error(error.message);
    }
  },

  // ===== Match lineups =====
  fetchMatchLineup: async (matchId) => {
    const { data, error } = await supabase
      .from("match_lineups")
      .select("match_id, team_id, player_id, is_starter, jersey_number, created_at, profiles:player_id(name)")
      .eq("match_id", matchId)
      .order("is_starter", { ascending: false })
      .order("jersey_number", { ascending: true, nullsFirst: false });
    if (error) {
      console.error("[dataStore] fetchMatchLineup:", error.message);
      return [];
    }
    type Row = {
      match_id: string; team_id: string; player_id: string;
      is_starter: boolean; jersey_number: number | null; created_at: string;
      profiles?: { name: string } | { name: string }[] | null;
    };
    return ((data ?? []) as unknown as Row[]).map((r) => {
      const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      return {
        matchId: r.match_id,
        teamId: r.team_id,
        playerId: r.player_id,
        playerName: p?.name,
        isStarter: r.is_starter,
        jerseyNumber: r.jersey_number ?? undefined,
        createdAt: new Date(r.created_at).getTime(),
      };
    });
  },

  upsertLineupEntry: async (matchId, teamId, playerId, opts) => {
    const { error } = await supabase.from("match_lineups").upsert(
      {
        match_id: matchId,
        team_id: teamId,
        player_id: playerId,
        is_starter: opts?.isStarter ?? false,
        jersey_number: opts?.jerseyNumber ?? null,
      },
      { onConflict: "match_id,team_id,player_id" }
    );
    if (error) throw new Error(friendlyError(error.message));
  },

  removeLineupEntry: async (matchId, teamId, playerId) => {
    const { error } = await supabase
      .from("match_lineups")
      .delete()
      .eq("match_id", matchId)
      .eq("team_id", teamId)
      .eq("player_id", playerId);
    if (error) throw new Error(friendlyError(error.message));
  },

  setLineupStarter: async (matchId, teamId, playerId, isStarter) => {
    const { error } = await supabase
      .from("match_lineups")
      .update({ is_starter: isStarter })
      .eq("match_id", matchId)
      .eq("team_id", teamId)
      .eq("player_id", playerId);
    if (error) throw new Error(friendlyError(error.message));
  },

  fetchLeaderboard: async (category, limit) => {
    const orderCol =
      category === "goals" ? "goals"
      : category === "assists" ? "assists"
      : category === "mom" ? "mom"
      : category === "games" ? "games"
      : category === "streak" ? "attendance_streak"
      : "card_rating";

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("is_approved", true)
      .eq("is_banned", false)
      .gt(orderCol, 0)
      .order(orderCol, { ascending: false })
      .order("name", { ascending: true })
      .limit(limit ?? 20);
    if (error) {
      console.error("[dataStore] fetchLeaderboard:", error.message);
      return [];
    }
    return (data ?? []).map(rowToPlayer);
  },
}));
