import { createStore } from "zustand/vanilla";
import { useDataStore } from "@/stores/dataStore";
import { useAuthStore } from "@/stores/authStore";
import type { MatchControlOperations } from "@/features/match-control/store-context";
import type { LiveMatch } from "@/types";
import { projectRoom, type CommandKind, type RecordingRoom } from "./model";
import { recordingDeviceId } from "./device";
import { updateRoom } from "./storage";
import { createObservedClock, finalizationWaitMessage, otherPendingCount } from "./control-safety";

export function createRecordingAdapter(initial: RecordingRoom, isActive: () => boolean = () => true) {
  const deviceId = recordingDeviceId();
  let room = initial;
  const observedClock = createObservedClock();
  const match = () => projectRoom(room);
  const ownsClock = () => { const clock = match().clock; return clock?.ownerId === room.actorId && clock.deviceId === deviceId; };
  const assertActive = () => { if (!isActive()) throw new Error("이 화면의 기록 준비가 해제되었습니다. 다시 준비한 뒤 기록해주세요."); };
  const enqueue = async (kind: CommandKind, payload: Record<string, string | number> = {}) => {
    assertActive();
    if (useAuthStore.getState().user?.uid !== room.actorId) throw new Error("기록 계정이 변경되었습니다. 원래 계정으로 로그인해주세요.");
    const command = { id: crypto.randomUUID(), kind, payload, at: Date.now() };
    room = await updateRoom(room.key, current => {
      assertActive();
      if (!current) throw new Error("기기 저장 기록이 없습니다.");
      if (current.blocked) throw new Error(current.error);
      const wait = finalizationWaitMessage(kind, otherPendingCount(current.matchId));
      if (wait) throw new Error(wait);
      const state = projectRoom(current);
      if (kind === "start" ? state.status !== "scheduled" : state.status !== "live") throw new Error("경기 상태가 변경되었습니다. 기록을 확인해주세요.");
      if (kind === "timer" && (state.clock?.ownerId !== room.actorId || state.clock.deviceId !== deviceId)) return current;
      command.payload = { ...payload, ...(kind === "pause" || kind === "end" ? observedClock.payload(state) : {}), _deviceId: deviceId, _clockVersion: state.clock?.version ?? 0, _actorName: useAuthStore.getState().player?.name ?? "기록자" };
      return { ...current, pending: [...current.pending, command], journal: [...current.journal, command], savedAt: command.at };
    });
    publish(room);
    window.dispatchEvent(new Event("fg-recording-enqueued"));
  };
  const store = createStore<MatchControlOperations>(() => ({
    ...useDataStore.getState(), allowsOfflineRecording: true, canPersistClock: ownsClock(),
    liveMatches: [match() as LiveMatch],
    fetchMatch: async () => match(),
    fetchTeamPlayers: async teamId => room.players.filter(p => p.teamId === teamId),
    fetchMatchLineup: async () => match().lineups ?? room.lineups,
    subscribeLiveMatches: () => () => {},
    startMatch: async () => enqueue("start"), pauseMatch: async () => enqueue("pause"), resumeMatch: async () => enqueue("resume"),
    endMatch: async () => enqueue("end"), forfeitMatch: async (_id, teamId) => enqueue("forfeit", { teamId }),
    updateMatchTimer: async (_id, seconds, half) => {
      observedClock.remember(seconds, half, match().clock?.version ?? 0);
      if (ownsClock()) await enqueue("timer", { seconds, half });
    },
    addMatchEvent: async (_t, _m, event) => enqueue("event", event),
    cancelMatchEvent: async (_t, _m, eventId) => {
      if (eventId.startsWith("auto:")) throw new Error("자동 퇴장은 해당 두 번째 경고를 취소해주세요.");
      await enqueue("cancel", eventId.startsWith("local:") ? { eventOperationId: eventId.slice(6) } : { eventId });
    },
    setMatchMom: async (_t, _m, playerId) => enqueue("mom", { playerId }),
    substitutePlayer: async (_m, teamId, outId, inId, inName, minute, half) => enqueue("substitute", { teamId, outId, inId, inName, minute, half }),
    notifyNextMatchReady: async id => navigator.onLine ? useDataStore.getState().notifyNextMatchReady(id).catch(() => 0) : 0,
  }));
  function publish(next: RecordingRoom) { room = next; store.setState({ canPersistClock: ownsClock(), liveMatches: [match() as LiveMatch] }); }
  return { store, publish };
}
