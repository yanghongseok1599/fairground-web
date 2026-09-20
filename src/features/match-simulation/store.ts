import { createStore } from "zustand/vanilla";
import type { MatchControlOperations } from "@/features/match-control/store-context";
import type { MatchEvent, MatchEventType } from "@/types";
import { clampMatchElapsedSeconds, MATCH_DURATION_SECONDS, matchMinuteFromElapsed } from "@/lib/match-config";
import { createPracticeFixture, PRACTICE_HOME_ID, PRACTICE_AWAY_ID } from "./fixtures";

type PracticeEvent = MatchEvent & { automaticRed?: boolean };
export interface PracticeSnapshot extends ReturnType<typeof createPracticeFixture> {
  elapsedSeconds: number;
  running: boolean;
  speed: number;
  automatic: boolean;
  nextIncident: number;
}

const SCENARIO: { second: number; side: string; number: number; type: MatchEventType }[] = [
  { second: 60, side: PRACTICE_HOME_ID, number: 3, type: "goal" },
  { second: 61, side: PRACTICE_HOME_ID, number: 4, type: "assist" },
  { second: 150, side: PRACTICE_AWAY_ID, number: 2, type: "foul" },
  { second: 151, side: PRACTICE_AWAY_ID, number: 2, type: "yellow_card" },
  { second: 240, side: PRACTICE_AWAY_ID, number: 5, type: "goal" },
  { second: 241, side: PRACTICE_AWAY_ID, number: 3, type: "assist" },
  { second: 420, side: PRACTICE_HOME_ID, number: 5, type: "goal" },
  { second: 421, side: PRACTICE_HOME_ID, number: 4, type: "assist" },
  { second: 540, side: PRACTICE_AWAY_ID, number: 2, type: "yellow_card" },
];

export interface PracticeStore extends MatchControlOperations {
  snapshot: PracticeSnapshot;
  tick: () => void;
  setSpeed: (speed: number) => void;
  startAutomatic: () => void;
  stopAutomatic: () => void;
  reset: () => void;
}

function freshSnapshot(): PracticeSnapshot {
  return {
    ...createPracticeFixture(`practice-${crypto.randomUUID()}`, Date.now()),
    elapsedSeconds: 0, running: false, speed: 1, automatic: false, nextIncident: 0,
  };
}

function recalculate(snapshot: PracticeSnapshot) {
  const events = snapshot.match.events.filter(e => !e.isCancelled);
  snapshot.match.homeScore = events.filter(e => e.type === "goal" && e.teamId === PRACTICE_HOME_ID).length;
  snapshot.match.awayScore = events.filter(e => e.type === "goal" && e.teamId === PRACTICE_AWAY_ID).length;
}

function reconcileRedCard(snapshot: PracticeSnapshot, playerId: string) {
  const events = snapshot.match.events as PracticeEvent[];
  const yellows = events.filter(e => e.playerId === playerId && e.type === "yellow_card" && !e.isCancelled);
  if (yellows.length < 2) {
    for (const e of events) if (e.playerId === playerId && e.automaticRed) e.isCancelled = true;
  } else if (!events.some(e => e.playerId === playerId && e.type === "red_card" && !e.isCancelled)) {
    events.push({ ...yellows[yellows.length - 1], id: crypto.randomUUID(), type: "red_card", automaticRed: true, timestamp: Date.now() });
  }
}

function addIncident(snapshot: PracticeSnapshot, input: Parameters<MatchControlOperations["addMatchEvent"]>[2]) {
  if (snapshot.match.status !== "live") throw new Error("진행 중인 테스트 경기에만 기록할 수 있습니다.");
  const player = snapshot.players.find(p => p.id === input.playerId && p.teamId === input.teamId);
  if (!player) throw new Error("테스트 경기 선수를 선택해주세요.");
  snapshot.match.events.push({ ...input, playerName: player.name, id: crypto.randomUUID(), timestamp: Date.now() });
  if (input.type === "yellow_card") reconcileRedCard(snapshot, input.playerId);
  recalculate(snapshot);
}

// This module has no Supabase, auth or production-store dependency. Every
// operation is implemented locally; an unknown match can never fall through.
export function createPracticeStore(saved?: PracticeSnapshot) {
  const initial = saved ? { ...structuredClone(saved), running: false, automatic: false } : freshSnapshot();
  return createStore<PracticeStore>()((set, get) => {
    const liveMatches = (s: PracticeSnapshot) => s.match.status === "live" ? [{
      ...s.match, status: "live" as const, currentHalf: 1 as const,
      elapsedSeconds: s.elapsedSeconds, isRunning: s.running,
    }] : [];
    const update = (fn: (snapshot: PracticeSnapshot) => void) => {
      const snapshot = structuredClone(get().snapshot);
      fn(snapshot);
      set({ snapshot, liveMatches: liveMatches(snapshot) });
    };
    const assertMatch = (id: string, tournament?: string) => {
      const match = get().snapshot.match;
      if (id !== match.id || (tournament !== undefined && tournament !== match.tournamentId)) throw new Error("테스트 경기를 찾을 수 없습니다.");
    };
    const requireLive = () => {
      if (get().snapshot.match.status !== "live") throw new Error("진행 중인 테스트 경기가 아닙니다.");
    };
    return {
      snapshot: initial, liveMatches: liveMatches(initial), managesClock: true,
      fetchMatch: async (tournament, id) => { assertMatch(id, tournament); return structuredClone(get().snapshot.match); },
      fetchTeamPlayers: async teamId => structuredClone(get().snapshot.players.filter(p => p.teamId === teamId)),
      fetchMatchLineup: async id => { assertMatch(id); return structuredClone(get().snapshot.lineup); },
      subscribeLiveMatches: () => () => undefined,
      notifyNextMatchReady: async id => { assertMatch(id); return 0; },
      startMatch: async (tournament, id) => {
        assertMatch(id, tournament);
        if (get().snapshot.match.status !== "scheduled") throw new Error("이미 시작한 경기입니다.");
        update(s => { s.match.status = "live"; s.running = true; });
      },
      pauseMatch: async id => { assertMatch(id); requireLive(); update(s => { s.running = false; }); },
      resumeMatch: async id => {
        assertMatch(id); requireLive();
        if (get().snapshot.elapsedSeconds >= MATCH_DURATION_SECONDS) throw new Error("규정 시간이 끝났습니다.");
        update(s => { s.running = true; });
      },
      updateMatchTimer: async (id, seconds) => {
        assertMatch(id); requireLive();
        update(s => { s.elapsedSeconds = clampMatchElapsedSeconds(seconds); if (s.elapsedSeconds >= MATCH_DURATION_SECONDS) s.running = false; });
      },
      addMatchEvent: async (tournament, id, event) => { assertMatch(id, tournament); update(s => addIncident(s, event)); },
      cancelMatchEvent: async (tournament, id, eventId) => {
        assertMatch(id, tournament); requireLive();
        update(s => {
          const event = s.match.events.find(e => e.id === eventId);
          if (!event) throw new Error("기록을 찾을 수 없습니다.");
          event.isCancelled = true;
          if (event.type === "yellow_card") reconcileRedCard(s, event.playerId);
          recalculate(s);
        });
      },
      setMatchMom: async (tournament, id, playerId) => {
        assertMatch(id, tournament); requireLive();
        if (!get().snapshot.players.some(p => p.id === playerId)) throw new Error("테스트 선수를 선택해주세요.");
        update(s => { s.match.momPlayerId = playerId; });
      },
      endMatch: async (tournament, id) => {
        assertMatch(id, tournament);
        if (get().snapshot.match.status === "finished") return;
        requireLive();
        update(s => {
          s.running = false; s.automatic = false; s.match.status = "finished";
          const events = s.match.events.filter(e => !e.isCancelled);
          for (const p of s.players) p.stats = {
            games: 1, goals: events.filter(e => e.playerId === p.id && e.type === "goal").length,
            assists: events.filter(e => e.playerId === p.id && e.type === "assist").length,
            mom: s.match.momPlayerId === p.id ? 1 : 0,
          };
        });
      },
      forfeitMatch: async (id, teamId) => {
        assertMatch(id);
        if (get().snapshot.match.status === "finished" || ![PRACTICE_HOME_ID, PRACTICE_AWAY_ID].includes(teamId)) throw new Error("몰수패 처리할 수 없습니다.");
        update(s => {
          s.running = false; s.automatic = false; s.match.status = "finished";
          s.match.homeScore = teamId === PRACTICE_HOME_ID ? 0 : 3;
          s.match.awayScore = teamId === PRACTICE_AWAY_ID ? 0 : 3;
        });
      },
      substitutePlayer: async (id, teamId, outId, inId, _name, minute, half) => {
        assertMatch(id); requireLive();
        update(s => {
          const outgoing = s.lineup.find(p => p.playerId === outId && p.teamId === teamId && p.isStarter);
          const incoming = s.lineup.find(p => p.playerId === inId && p.teamId === teamId && !p.isStarter);
          if (!outgoing || !incoming || outId === inId) throw new Error("코트와 벤치의 선수를 선택해주세요.");
          outgoing.isStarter = false; incoming.isStarter = true;
          addIncident(s, { type: "substitution", playerId: inId, playerName: incoming.playerName ?? "", teamId, minute, half: half === 2 ? 2 : 1 });
        });
      },
      tick: () => {
        if (!get().snapshot.running || get().snapshot.match.status !== "live") return;
        update(s => {
          s.elapsedSeconds = clampMatchElapsedSeconds(s.elapsedSeconds + s.speed);
          while (s.automatic && s.nextIncident < SCENARIO.length && SCENARIO[s.nextIncident].second <= s.elapsedSeconds) {
            const incident = SCENARIO[s.nextIncident++];
            addIncident(s, { type: incident.type, playerId: `${incident.side}-${incident.number}`, playerName: "", teamId: incident.side, minute: matchMinuteFromElapsed(incident.second), half: 1 });
          }
          if (s.elapsedSeconds >= MATCH_DURATION_SECONDS) { s.running = false; s.automatic = false; }
        });
      },
      setSpeed: speed => { if ([1, 10, 60].includes(speed)) update(s => { s.speed = speed; }); },
      startAutomatic: () => {
        if (["finished", "cancelled"].includes(get().snapshot.match.status) || get().snapshot.elapsedSeconds >= MATCH_DURATION_SECONDS) return;
        update(s => { s.match.status = "live"; s.running = true; s.automatic = true; s.speed = 60; });
      },
      stopAutomatic: () => update(s => { s.automatic = false; s.running = false; }),
      reset: () => { const snapshot = freshSnapshot(); set({ snapshot, liveMatches: [] }); },
    };
  });
}
