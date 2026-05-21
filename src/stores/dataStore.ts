"use client";

import { create } from "zustand";
import { supabase, isDemoMode } from "@/config/supabase";
import {
  rowToPlayer,
  rowToTeam,
  teamToInsert,
  teamPatchToRow,
  rowToEvent,
  eventToInsert,
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
  createTournament: (tournament: Omit<Tournament, "id">) => Promise<string>;
  createMatch: (tournamentId: string, match: Omit<Match, "id">) => Promise<string>;
  startMatch: (tournamentId: string, matchId: string) => Promise<void>;
  pauseMatch: (matchId: string) => Promise<void>;
  resumeMatch: (matchId: string) => Promise<void>;
  endMatch: (tournamentId: string, matchId: string) => Promise<void>;
  addMatchEvent: (
    tournamentId: string,
    matchId: string,
    event: { type: MatchEventType; playerId: string; playerName: string; teamId: string; minute: number; half: 1 | 2 },
  ) => Promise<void>;
  cancelMatchEvent: (tournamentId: string, matchId: string, eventId: string) => Promise<void>;
  updateMatchTimer: (matchId: string, elapsedSeconds: number, currentHalf: 1 | 2) => Promise<void>;
  setMatchMom: (tournamentId: string, matchId: string, playerId: string) => Promise<void>;

  // --- Notices (운영 → 회원 일방향, RLS: 누구나 read / is_referee_or_admin 만 write) ---
  fetchNotices: (opts?: { category?: string }) => Promise<Notice[]>;
  fetchNotice: (id: string) => Promise<Notice | null>;
  createNotice: (input: NoticeInputCreate) => Promise<string>;
  updateNotice: (id: string, patch: Partial<NoticeInputCreate>) => Promise<void>;
  deleteNotice: (id: string) => Promise<void>;

  // --- Board posts (자유게시판, RLS: 누구나 read / 본인만 write·update / 본인+admin delete) ---
  fetchBoardPosts: (opts?: { category?: PostCategory; sort?: "recent" | "comments" }) => Promise<BoardPost[]>;
  fetchBoardPost: (id: string, opts?: { bumpView?: boolean }) => Promise<BoardPost | null>;
  createBoardPost: (input: BoardPostInputCreate) => Promise<string>;
  updateBoardPost: (
    id: string,
    patch: Partial<Pick<BoardPostInputCreate, "title" | "body" | "category">>,
  ) => Promise<void>;
  deleteBoardPost: (id: string) => Promise<void>;

  // --- Board comments ---
  fetchComments: (postId: string) => Promise<BoardComment[]>;
  addComment: (postId: string, body: string, authorId: string) => Promise<string>;
  deleteComment: (commentId: string) => Promise<void>;
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
        return {
          teamId: t.id,
          teamName: t.name,
          teamLogo: t.logo,
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
    const { error } = await supabase
      .from("matches")
      .update({ status: "live", current_half: 1, elapsed_seconds: 0, is_running: true })
      .eq("id", matchId);
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
    const { error } = await supabase.from("matches").update({ is_running: false }).eq("id", matchId);
    if (error) console.error("[dataStore] pauseMatch:", error.message);
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
    const { error } = await supabase.from("matches").update({ is_running: true }).eq("id", matchId);
    if (error) console.error("[dataStore] resumeMatch:", error.message);
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
        if (p.cardType === "premium") p.cardRating = calculateCardRating(p.stats);
        players[p.id] = p;
      }
      saveLocalPlayers(players);
      return;
    }

    // Supabase: 단일 트랜잭션 RPC. 멱등(stats_applied) — 더블탭/재시도 안전 (D-B 해결).
    // 점수/MOM 은 라이브 중 matches 행에 이미 반영됨. RPC가 통계 집계 + status='finished' 처리.
    const { error } = await supabase.rpc("end_match", { p_match_id: matchId });
    if (error) {
      console.error("[dataStore] endMatch RPC:", error.message);
      throw new Error(error.message);
    }
    // NOTE(후속): premium 카드 cardRating 재계산은 RPC에 미포함(스키마 주석 참조).
    // card_rating 은 RLS 트리거가 클라 변경 차단 → 서버 RPC 확장으로 처리 예정.
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

    const { error: insErr } = await supabase.from("match_events").insert(eventToInsert(matchId, eventData));
    if (insErr) { console.error("[dataStore] addMatchEvent:", insErr.message); throw new Error(insErr.message); }

    if (eventData.type === "goal") {
      const { data: m } = await supabase
        .from("matches")
        .select("home_team_id,home_score,away_score")
        .eq("id", matchId)
        .maybeSingle();
      if (m) {
        const patch =
          eventData.teamId === m.home_team_id
            ? { home_score: (m.home_score ?? 0) + 1 }
            : { away_score: (m.away_score ?? 0) + 1 };
        const { error } = await supabase.from("matches").update(patch).eq("id", matchId);
        if (error) console.error("[dataStore] addMatchEvent score:", error.message);
      }
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

    const { data: evt } = await supabase
      .from("match_events")
      .select("*")
      .eq("id", eventId)
      .maybeSingle();
    if (!evt || evt.is_cancelled) return;
    const { error } = await supabase.from("match_events").update({ is_cancelled: true }).eq("id", eventId);
    if (error) { console.error("[dataStore] cancelMatchEvent:", error.message); throw new Error(error.message); }

    if (evt.type === "goal") {
      const { data: m } = await supabase
        .from("matches")
        .select("home_team_id,home_score,away_score")
        .eq("id", matchId)
        .maybeSingle();
      if (m) {
        const patch =
          evt.team_id === m.home_team_id
            ? { home_score: Math.max(0, (m.home_score ?? 0) - 1) }
            : { away_score: Math.max(0, (m.away_score ?? 0) - 1) };
        await supabase.from("matches").update(patch).eq("id", matchId);
      }
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
    const { error } = await supabase
      .from("matches")
      .update({ elapsed_seconds: elapsedSeconds, current_half: currentHalf })
      .eq("id", matchId);
    if (error) console.error("[dataStore] updateMatchTimer:", error.message);
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
    const { error } = await supabase.from("matches").update({ mom_player_id: playerId }).eq("id", matchId);
    if (error) { console.error("[dataStore] setMatchMom:", error.message); throw new Error(error.message); }
  },

  // ===== Notices =====
  // 데모 모드는 비활성(Supabase 전용). 데모 환경에서는 빈 배열을 안전히 반환.
  fetchNotices: async (opts) => {
    if (isDemoMode) return [];
    let q = supabase
      .from("notices")
      .select("*, profiles:author_id(name)")
      .order("is_pinned", { ascending: false })
      .order("published_at", { ascending: false });
    if (opts?.category) q = q.eq("category", opts.category);
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
      .select("*, profiles:author_id(name)")
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
      .select("*, profiles:author_id(name)")
      .order(sortField, { ascending: false });
    if (opts?.category) q = q.eq("category", opts.category);
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
      .select("*, profiles:author_id(name)")
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
    if (error || !data) throw new Error(error?.message ?? "createBoardPost failed");
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
      .select("*, profiles:author_id(name)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[dataStore] fetchComments:", error.message);
      return [];
    }
    return (data ?? []).map(rowToBoardComment);
  },

  addComment: async (postId, body, authorId) => {
    if (isDemoMode) throw new Error("데모 모드에서는 댓글을 작성할 수 없습니다");
    const { data, error } = await supabase
      .from("board_comments")
      .insert(boardCommentToInsert({ postId, body, authorId }))
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "addComment failed");
    return data.id;
  },

  deleteComment: async (commentId) => {
    if (isDemoMode) throw new Error("데모 모드에서는 댓글을 삭제할 수 없습니다");
    const { error } = await supabase.from("board_comments").delete().eq("id", commentId);
    if (error) { console.error("[dataStore] deleteComment:", error.message); throw new Error(error.message); }
  },
}));
