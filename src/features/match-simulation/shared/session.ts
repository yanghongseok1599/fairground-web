import { createStore } from "zustand/vanilla";
import { createPracticeStore } from "../store";
import { applyRecordingCommand, type RecordingCommand } from "./recording-commands";
import { readRoomFrame, seat, validMember, type RoomFrame, type RoomMember, type RoomMessage, type RoomRole } from "./protocol";

export interface RoomTransport {
  connect(handlers: {
    message: (message: RoomMessage) => void;
    members: (members: RoomMember[]) => void;
    connection: (connected: boolean) => void;
  }): void;
  send(message: RoomMessage): Promise<void>;
  close(): void;
}

interface SessionStatus {
  connected: boolean; ready: boolean; members: RoomMember[];
  referee: string | null; admin: string | null; error: string;
}

// One referee owns the clock and every state change. The administrator only
// requests recording/cancellation and resets; the referee acknowledges and deduplicates them.
// No leader failover runs a second clock when the referee loses connection.
export function createRoomSession(options: {
  room: string; role: RoomRole; id: string; saved?: RoomFrame;
  transport: () => RoomTransport; save?: (frame: RoomFrame) => void;
  now?: () => number; settleDelayMs?: number;
}) {
  const now = options.now ?? Date.now;
  const status = createStore<SessionStatus>()(() => ({ connected: false, ready: false, members: [], referee: null, admin: null, error: "" }));
  let cached = readRoomFrame(options.saved, options.room);
  let revision = cached?.revision ?? 0;
  let applying = false;
  let stopped = true;
  let transport: RoomTransport | undefined;
  let stopStore: (() => void) | undefined;
  let settling: ReturnType<typeof setTimeout> | undefined;
  let lastStateAt = 0;
  let recovery = false;
  let adminAnswered = false;
  const completed = new Map<string, string | undefined>();
  const recordings = new Map<string, Promise<string | undefined>>();
  const pending = new Map<string, { resolve: () => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  const controls = () => {
    const s = status.getState();
    return !stopped && s.connected && s.ready && s.referee === options.id;
  };
  const store = createPracticeStore(cached?.snapshot, { beforeMutation: () => {
    if (!controls()) throw new Error("심판 연결과 동기화가 완료된 후 다시 시도해주세요.");
  } });
  const remember = (frame: RoomFrame) => {
    cached = frame;
    revision = frame.revision;
    try { options.save?.(frame); } catch { /* Live sharing works without tab storage. */ }
  };
  const apply = (frame: RoomFrame, pause = false) => {
    const snapshot = { ...frame.snapshot, ...(pause ? { running: false, automatic: false } : {}) };
    applying = true;
    store.getState().replaceSnapshot(snapshot);
    applying = false;
    remember({ ...frame, snapshot });
  };
  const pause = () => {
    applying = true;
    store.getState().replaceSnapshot({ ...store.getState().snapshot, running: false, automatic: false });
    applying = false;
  };
  const send = async (message: RoomMessage) => {
    if (!transport || stopped) throw new Error("연결이 종료되었습니다.");
    await transport.send(message);
  };
  const sendQuietly = (message: RoomMessage) => {
    void send(message).catch(() => {
      if (stopped) return;
      status.setState({ ready: false, error: "연결이 끊겼습니다. 다시 연결한 뒤 기록을 확인해주세요." });
      pause();
    });
  };
  const publish = () => {
    const s = status.getState();
    if (stopped || !s.connected || s.referee !== options.id || !s.ready) return;
    const frame: RoomFrame = { room: options.room, owner: options.id, revision, snapshot: structuredClone(store.getState().snapshot) };
    remember(frame);
    sendQuietly({ type: "state", frame });
  };
  const rejectPending = () => {
    for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error("연결이 변경되었습니다. 경기 상태를 확인한 뒤 다시 시도해주세요.")); }
    pending.clear();
  };
  const bootstrap = () => {
    clearTimeout(settling);
    recovery = true;
    adminAnswered = false;
    status.setState({ ready: false });
    pause();
    sendQuietly({ type: "request", from: options.id });
    const finishRecovery = () => {
      settling = undefined;
      if (stopped || !status.getState().connected || status.getState().referee !== options.id) return;
      // Presence and broadcast arrival order differs across real devices. An
      // existing administrator must answer before a new referee starts a clock.
      if (status.getState().admin && !adminAnswered) {
        sendQuietly({ type: "request", from: options.id });
        settling = setTimeout(finishRecovery, options.settleDelayMs ?? 1800);
        return;
      }
      recovery = false;
      if (cached) apply(cached, true);
      revision += 1;
      status.setState({ ready: true, error: "" });
      publish();
    };
    settling = setTimeout(finishRecovery, options.settleDelayMs ?? 1800);
  };
  const onMembers = (members: RoomMember[]) => {
    if (stopped) return;
    const valid = members.filter(validMember);
    const referee = seat(valid, "referee"), admin = seat(valid, "admin");
    const previous = status.getState().referee;
    status.setState({ members: valid, referee, admin });
    if (referee !== previous) {
      clearTimeout(settling); recovery = false;
      rejectPending();
      status.setState({ ready: false });
      pause();
      if (referee === options.id && status.getState().connected) bootstrap();
      else {
        sendQuietly({ type: "request", from: options.id });
        if (admin === options.id && referee) sendQuietly({ type: "offer", from: options.id, to: referee, frame: cached ?? null });
      }
    }
  };
  const onMessage = (message: RoomMessage) => {
    if (stopped || !message || typeof message !== "object") return;
    const s = status.getState();
    if (message.type === "state") {
      const frame = readRoomFrame(message.frame, options.room);
      if (!frame || frame.owner !== s.referee || frame.owner === options.id) return;
      if (frame.revision < revision) {
        if (s.admin === options.id && cached) sendQuietly({ type: "offer", from: options.id, to: frame.owner, frame: cached });
        return;
      }
      apply(frame); lastStateAt = now();
      status.setState({ ready: true, error: "" });
    } else if (message.type === "request") {
      if (!s.members.some(m => m.id === message.from)) return;
      if (controls()) publish();
      else if (s.admin === options.id && message.from === s.referee) sendQuietly({ type: "offer", from: options.id, to: message.from, frame: cached ?? null });
    } else if (message.type === "offer") {
      if (s.referee !== options.id || message.to !== options.id || message.from !== s.admin) return;
      const frame = readRoomFrame(message.frame, options.room);
      if (!frame && message.frame !== null) return;
      adminAnswered = true;
      if (frame && (frame.revision > revision || (recovery && frame.revision === revision))) {
        apply(frame, true);
        if (!recovery) { revision += 1; publish(); }
      }
    } else if (message.type === "reset") {
      if (!controls() || message.from !== s.admin || typeof message.id !== "string" || message.id.length > 80) return;
      if (!completed.has(message.id)) {
        let error: string | undefined;
        if (message.matchId !== store.getState().snapshot.match.id) error = "이미 새 경기가 개설되었습니다. 화면을 확인해주세요.";
        else store.getState().reset();
        completed.set(message.id, error);
        if (completed.size > 100) completed.delete(completed.keys().next().value!);
      }
      publish();
      sendQuietly({ type: "ack", from: options.id, to: message.from, id: message.id, error: completed.get(message.id) });
    } else if (message.type === "recording") {
      if (!controls() || message.from !== s.admin || typeof message.id !== "string" || !message.id || message.id.length > 80) return;
      const key = `${message.from}:${message.id}`;
      if (!recordings.has(key)) {
        recordings.set(key, applyRecordingCommand(store.getState(), message.matchId, message.command)
          .then(() => undefined, e => e instanceof Error ? e.message : "기록하지 못했습니다."));
        if (recordings.size > 1000) recordings.delete(recordings.keys().next().value!);
      }
      void recordings.get(key)!.then(error => {
        if (!controls()) return;
        publish();
        sendQuietly({ type: "ack", from: options.id, to: message.from, id: message.id, error });
      });
    } else if (message.type === "ack" && message.to === options.id && message.from === s.referee) {
      const request = pending.get(message.id);
      if (!request) return;
      clearTimeout(request.timer); pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error)); else request.resolve();
    }
  };
  return {
    store, status, controls,
    async record(command: RecordingCommand) {
      const s = status.getState();
      if (controls()) return applyRecordingCommand(store.getState(), store.getState().snapshot.match.id, command);
      if (options.role !== "admin" || !s.connected || !s.ready || s.admin !== options.id || !s.referee) throw new Error("심판과 운영 관리자의 연결을 확인해주세요.");
      const id = crypto.randomUUID();
      const result = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error("기록 응답을 받지 못했습니다. 현재 기록을 확인한 뒤 다시 시도해주세요.")); }, 6000);
        pending.set(id, { resolve, reject, timer });
      });
      void send({ type: "recording", from: options.id, id, matchId: store.getState().snapshot.match.id, command }).catch(() => {
        const p = pending.get(id);
        if (p) { clearTimeout(p.timer); pending.delete(id); p.reject(new Error("기록 요청을 전송하지 못했습니다.")); }
      });
      return result;
    },
    start() {
      stopped = false;
      transport = options.transport();
      stopStore = store.subscribe((state, previous) => {
        if (!applying && state.snapshot !== previous.snapshot && controls()) { revision += 1; publish(); }
      });
      transport.connect({ message: onMessage, members: onMembers, connection: connected => {
        const wasConnected = status.getState().connected;
        status.setState({ connected, ready: false, ...(connected ? { error: "" } : {}) });
        if (!connected) {
          clearTimeout(settling); recovery = false;
          pause(); rejectPending();
          status.setState({ members: [], referee: null, admin: null });
        } else if (!wasConnected && status.getState().referee === options.id) bootstrap();
      } });
    },
    pulse() {
      if (stopped) return;
      if (controls()) {
        const previous = store.getState().snapshot;
        store.getState().tick();
        if (previous === store.getState().snapshot) publish();
      }
      else if (status.getState().connected) {
        if (now() - lastStateAt > 6000) status.setState({ ready: false });
        sendQuietly({ type: "request", from: options.id });
      }
    },
    async reset() {
      if (controls()) { store.getState().reset(); return; }
      const s = status.getState();
      if (!s.connected || !s.ready || s.admin !== options.id || !s.referee) throw new Error("심판이 연결된 뒤 새 경기를 개설할 수 있습니다.");
      const id = crypto.randomUUID();
      const result = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error("초기화 응답을 받지 못했습니다. 경기 상태를 확인해주세요.")); }, 6000);
        pending.set(id, { resolve, reject, timer });
      });
      // Attach the rejection handler before the network promise can settle.
      void send({ type: "reset", from: options.id, id, matchId: store.getState().snapshot.match.id }).catch(() => {
        const p = pending.get(id);
        if (p) { clearTimeout(p.timer); pending.delete(id); p.reject(new Error("초기화 요청을 전송하지 못했습니다.")); }
      });
      return result;
    },
    stop() {
      stopped = true; clearTimeout(settling); recovery = false;
      stopStore?.(); transport?.close(); transport = undefined;
      rejectPending(); pause();
      status.setState({ connected: false, ready: false, members: [], referee: null, admin: null });
    },
  };
}
