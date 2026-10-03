"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useDataStore } from "@/stores/dataStore";
import { AdminGuard } from "@/components/admin-guard";
import { MatchControlStoreContext } from "@/features/match-control/store-context";
import { prepareOfflineShell } from "./offline-shell";
import { readRooms, updateRoom } from "./storage";
import { readSnapshot } from "./transport";
import { createRecordingAdapter } from "./adapter";
import { syncRecordings } from "./engine";
import { projectRoom, reconcileSnapshot, type RecordingRoom } from "./model";
import { recordingDeviceId } from "./device";
import { joinRecordingChannel, type SharedRecordingState } from "./shared-channel";
import { blockingPendingCount, observeOtherPending } from "./control-safety";
import { canReleaseRejectedEnd, releaseRejectedEnd } from "./control-recovery";
import { startRoomSession, type RoomSessionGuard } from "./room-session";
import { createRoomPublication, prepareRecordingRoom } from "./room-bootstrap";
import { createJerseyRefresh } from "./jersey-sync";
import { readRecordingJerseys } from "./jersey-api";

const SharedContext = createContext<SharedRecordingState>({ connected: false, names: [], pendingElsewhere: 0, blockingPendingElsewhere: 0 });
export const useSharedRecordingState = () => useContext(SharedContext);
const RecordingContext = createContext<RecordingRoom | null>(null);
export function RecordingStatus() {
  const room = useContext(RecordingContext);
  const shared = useContext(SharedContext);
  const canBackup = useAuthStore(state => state.player?.role === "admin");
  const [notice, setNotice] = useState("");
  const [recovering, setRecovering] = useState(false);
  if (!room) return null;
  const pending = room.pending.length;
  const recoverableEnd = canReleaseRejectedEnd(room);
  const needsAttention = pending > 0 || room.blocked || !!room.error || !!notice ||
    !!room.notice || recovering || recoverableEnd || !shared.connected ||
    shared.pendingElsewhere > 0 || shared.blockingPendingElsewhere > 0;
  const releaseEnd = async () => {
    if (!recoverableEnd || recovering) return;
    const operationId = room.pending[0].id;
    setRecovering(true);
    setNotice("");
    try {
      const latest = await readSnapshot(room.matchId);
      if (useAuthStore.getState().user?.uid !== room.actorId) throw new Error("기록 계정이 변경되었습니다. 원래 계정으로 로그인해주세요.");
      await updateRoom(room.key, current => {
        if (!current) throw new Error("기기 저장 기록이 없습니다.");
        return releaseRejectedEnd(current, latest, operationId);
      });
    } catch (error) { setNotice(error instanceof Error ? error.message : "최신 경기 상태를 확인하지 못했습니다. 기존 기록을 보관하고 있습니다."); }
    finally { setRecovering(false); }
  };
  const retry = async () => {
    try {
      await updateRoom(room.key, current => {
        if (!current) throw new Error("저장 기록을 찾을 수 없습니다.");
        return { ...current, blocked: false, error: undefined };
      });
      await syncRecordings(room.actorId, true);
    } catch { setNotice(canBackup ? "기기 저장소를 확인하지 못했습니다. 창을 유지하고 연결·기기 저장 상태를 확인해주세요." : "기기 저장소를 확인하지 못했습니다. 창을 유지하고 관리자에게 알려주세요."); }
  };
  const backup = async () => {
    const rooms = await readRooms(room.actorId);
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), rooms }, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `fairground-records-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className={`${needsAttention ? "" : "hidden md:block"} shrink-0 border-b px-3 py-2 text-xs ${pending ? "bg-amber-50 text-amber-950" : "bg-emerald-50 text-emerald-950"}`} data-slot="recording-sync-status">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p role="status" aria-live="polite"><strong>{pending ? `이 기기에 저장됨 · 서버 전송 대기 ${pending}건` : "동기화 완료 · 서버 저장 확인"}</strong>{pending > 0 && <span className="ml-2">연결되면 자동 전송</span>}</p>
      <div className="flex flex-wrap gap-2">{recoverableEnd && <button type="button" onClick={() => void releaseEnd()} disabled={recovering} className="min-h-9 rounded border px-2">{recovering ? "최신 경기 확인 중…" : "이전 종료 요청 해제"}</button>}{pending > 0 && <button type="button" onClick={() => void retry()} disabled={recovering} className="min-h-9 rounded border px-2">동기화 재시도</button>}{canBackup && <button type="button" onClick={() => void backup().catch(() => setNotice("백업 저장에 실패했습니다. 다시 시도해주세요."))} className="hidden min-h-9 rounded border px-2 md:inline-flex md:items-center">기록 백업</button>}</div>
    </div>
    <p className="mt-1">{shared.connected ? "실시간 공유 연결됨" : "공유 연결 확인 중 · 미전송 기록은 이 기기에 보관"}{shared.names.length > 0 && ` · ${shared.names.join(", ")}`}{projectRoom(room).clock?.ownerName && ` · 시간 관리: ${projectRoom(room).clock?.ownerName}`}</p>
    {shared.pendingElsewhere > 0 && <p role="status" className="mt-1">다른 기기에 전송 대기 {shared.pendingElsewhere}건이 있습니다.{shared.blockingPendingElsewhere > 0 && ` 기록 ${shared.blockingPendingElsewhere}건의 동기화가 완료될 때까지 경기 종료를 기다립니다.`}</p>}
    {room.notice && <p role="status" className="mt-1">{room.notice}</p>}
    {(room.error || notice) && <p role="alert" className="mt-1">{notice || room.error}</p>}
  </div>;
}

export function MatchRecordingProvider({ matchId, children }: { matchId: string; children: ReactNode }) {
  const user = useAuthStore(s => s.user);
  const player = useAuthStore(s => s.player);
  const [loaded, setLoaded] = useState<{ room: RecordingRoom; adapter: ReturnType<typeof createRecordingAdapter>; active: () => boolean } | null>(null);
  const [shared, setShared] = useState<SharedRecordingState>({ connected: false, names: [], pendingElsewhere: 0, blockingPendingElsewhere: 0 });
  const [error, setError] = useState("");
  const [preparation, setPreparation] = useState<"preparing" | "waiting">("preparing");
  const [attempt, setAttempt] = useState(0);
  const actorId = user?.uid;
  const hasProfile = !!player;
  const allowed = player?.role === "admin" || (player?.role === "referee" && player.isApproved);
  useEffect(() => {
    if (!actorId) return;
    let disposed = false;
    let ownsRoom = false;
    let guard: RoomSessionGuard | undefined;
    let session: ReturnType<typeof startRoomSession> | undefined;
    let refreshing = false;
    let refreshAgain = false;
    let channel: ReturnType<typeof joinRecordingChannel> | undefined;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let pendingElsewhere = 0;
    let blockingPendingElsewhere = 0;
    const stopObservingPending = observeOtherPending(matchId, () => blockingPendingElsewhere);
    const active = () => !disposed && ownsRoom && guard?.active() === true;
    const publication = createRoomPublication(room => createRecordingAdapter(room, active), (room, adapter) => {
      channel?.setPending(room.pending.length, blockingPendingCount(room.pending), room.revision);
      setLoaded({ room, adapter, active }); setError("");
    });
    const publish = (room: RecordingRoom) => {
      if (active()) publication.publish(room);
    };
    const refreshJerseys = createJerseyRefresh({
      active, current: () => publication.current, read: readRecordingJerseys, publish,
      update: (key, change) => updateRoom(key, change, guard?.signal),
    });
    const refresh = async () => {
      if (!active() || !publication.current) return;
      if (refreshing) { refreshAgain = true; return; }
      refreshing = true;
      try {
        const stored = (await readRooms(actorId)).find(r => r.matchId === matchId);
        if (!stored || !active()) return;
        if (stored.revision !== publication.current?.revision) publish(stored);
        if (navigator.onLine && allowed) {
          void refreshJerseys();
          const base = await readSnapshot(matchId);
          if (!active()) return;
          // Merge the latest stored queue, including commands entered during the read.
          const updated = await updateRoom(stored.key, next => { guard!.assertActive(); return reconcileSnapshot(next ?? stored, base); }, guard!.signal);
          publish(updated);
        }
      } catch { /* Cached records remain available. Writes have a separate retry status. */ }
      finally { refreshing = false; if (refreshAgain && active()) { refreshAgain = false; scheduleRefresh(); } }
    };
    const scheduleRefresh = () => { clearTimeout(debounce); debounce = setTimeout(() => void refresh(), 150); };
    const storageChanged = () => { if (active()) void readRooms(actorId).then(rooms => { const next = rooms.find(r => r.matchId === matchId); if (next && next.revision !== publication.current?.revision) publish(next); }).catch(() => {}); };
    if (navigator.locks) {
      session = startRoomSession({
        locks: navigator.locks, name: `fg-recording-room:${actorId}:${matchId}`,
        onWaiting: () => { if (!disposed) { setLoaded(null); setPreparation("waiting"); } },
        onPreparing: () => { if (!disposed) { ownsRoom = true; setLoaded(null); setPreparation("preparing"); } },
        onError: e => { ownsRoom = false; if (!disposed) { setLoaded(null); channel?.close(); setError(e instanceof Error ? e.message : "경기 준비에 실패했습니다. 저장된 기록을 유지하고 있습니다. 다시 준비해주세요."); } },
        prepare: async scope => {
          guard = scope;
          await prepareRecordingRoom({ actorId, matchId, allowed: !!allowed, hasProfile, guard: scope,
            readRooms, readSnapshot, updateRoom, publish,
            fetchPlayers: teamId => useDataStore.getState().fetchTeamPlayers(teamId, { forRecording: true }),
          });
          scope.assertActive();
          if (allowed) {
            channel = joinRecordingChannel({ matchId, actorId, deviceId: recordingDeviceId(), name: useAuthStore.getState().player?.name ?? "기록자",
              refresh: scheduleRefresh, onState: state => {
                if (!active()) return;
                const previousPending = blockingPendingElsewhere;
                // A disconnected presence channel cannot confirm another queue has drained.
                if (state.connected) { pendingElsewhere = state.pendingElsewhere; blockingPendingElsewhere = state.blockingPendingElsewhere; }
                setShared({ ...state, pendingElsewhere, blockingPendingElsewhere });
                if (previousPending > 0 && blockingPendingElsewhere === 0) void syncRecordings(actorId, true);
              } });
            const current = publication.current;
            channel.setPending(current?.pending.length ?? 0, blockingPendingCount(current?.pending ?? []), current?.revision ?? 0);
          }
          void navigator.storage?.persist?.().catch(() => false);
          void refresh();
        },
      });
    } else { setTimeout(() => { if (!disposed) setError("최신 Chrome 또는 Safari에서 경기 기록을 열어주세요."); }, 0); }
    const stopPreparingShell = prepareOfflineShell();
    const interval = window.setInterval(() => void refresh(), 4000);
    window.addEventListener("fg-recording-change", storageChanged);
    window.addEventListener("online", scheduleRefresh);
    window.addEventListener("focus", scheduleRefresh);
    return () => { disposed = true; stopObservingPending(); channel?.close(); clearTimeout(debounce); window.removeEventListener("online", scheduleRefresh); window.removeEventListener("focus", scheduleRefresh); stopPreparingShell(); ownsRoom = false; session?.close(); clearInterval(interval); window.removeEventListener("fg-recording-change", storageChanged); };
  }, [actorId, matchId, allowed, hasProfile, attempt]);
  const ready = loaded && loaded.active() && loaded.room.actorId === actorId && loaded.room.matchId === matchId ? loaded : null;
  if (ready && (allowed || !hasProfile)) return <SharedContext.Provider value={shared}><RecordingContext.Provider value={ready.room}><MatchControlStoreContext.Provider value={ready.adapter.store}>{children}</MatchControlStoreContext.Provider></RecordingContext.Provider></SharedContext.Provider>;
  return <AdminGuard><div className="mx-auto max-w-lg space-y-3 p-6"><p role={error ? "alert" : "status"}>{error || (preparation === "waiting" ? "다른 탭에서 이 경기를 기록 중입니다. 해당 경기 탭을 닫으면 이 화면에서 자동으로 준비합니다. 저장된 기록은 유지됩니다." : "경기와 선수 명단을 준비하고 있습니다.")}</p>{error && <button onClick={() => { setError(""); setPreparation("preparing"); setAttempt(a => a + 1); }} className="min-h-11 rounded border px-4">다시 준비</button>}</div></AdminGuard>;
}
