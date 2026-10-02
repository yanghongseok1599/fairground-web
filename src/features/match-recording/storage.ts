import type { RecordingRoom } from "./model";

const DATABASE = "fairground-match-recording-v1";
let opening: Promise<IDBDatabase> | undefined;
function database(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("rooms", { keyPath: "key" });
    request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); opening = undefined; }; resolve(request.result); };
    request.onerror = () => { opening = undefined; reject(request.error); };
    request.onblocked = () => { opening = undefined; reject(new Error("기기 저장소를 열 수 없습니다. 다른 경기 탭을 닫고 다시 시도해주세요.")); };
  });
  return opening;
}
export const roomKey = (actorId: string, matchId: string) => `${actorId}:${matchId}`;
export async function readRooms(actorId: string): Promise<RecordingRoom[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("rooms", "readonly");
    const request = tx.objectStore("rooms").getAll();
    tx.oncomplete = () => resolve((request.result as RecordingRoom[]).filter(r => r.actorId === actorId));
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
}
/** Resolve only after the IndexedDB transaction has durably committed. No memory fallback. */
export async function updateRoom(key: string, change: (room?: RecordingRoom) => RecordingRoom, signal?: AbortSignal): Promise<RecordingRoom> {
  const cancellation = () => signal?.reason ?? new DOMException("기기 저장 준비가 취소되었습니다.", "AbortError");
  if (signal?.aborted) throw cancellation();
  const db = await database();
  if (signal?.aborted) throw cancellation();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("rooms", "readwrite", { durability: "strict" });
    const store = tx.objectStore("rooms");
    let saved: RecordingRoom;
    let failure: unknown;
    const abort = () => {
      // Abort only this initializer's open transaction, never a committed write
      // or another recorder's queue. Existing callers do not pass a signal.
      try { tx.abort(); failure ??= cancellation(); } catch { /* Already committed; oncomplete still confirms durability. */ }
    };
    const cleanup = () => signal?.removeEventListener("abort", abort);
    signal?.addEventListener("abort", abort, { once: true });
    const request = store.get(key);
    request.onsuccess = () => {
      try {
        saved = change(request.result);
        saved.revision = (request.result?.revision ?? 0) + 1;
        store.put(saved);
      } catch (error) { failure = error; tx.abort(); }
    };
    tx.oncomplete = () => { cleanup(); window.dispatchEvent(new Event("fg-recording-change")); resolve(saved); };
    tx.onabort = () => { cleanup(); reject(failure ?? tx.error ?? new Error("이 기기에 저장하지 못했습니다. 저장 공간을 확인한 뒤 다시 기록해주세요.")); };
    tx.onerror = () => { failure ??= tx.error; };
  });
}
