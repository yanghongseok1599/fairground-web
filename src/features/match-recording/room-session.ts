export interface RoomSessionGuard {
  active: () => boolean;
  assertActive: () => void;
  signal: AbortSignal;
}

/** Own one writable room until closed; bootstrap cancellation must not retain its lock. */
export function startRoomSession(options: {
  locks: Pick<LockManager, "request">;
  name: string;
  prepare: (guard: RoomSessionGuard) => Promise<void>;
  onWaiting: () => void;
  onPreparing: () => void;
  onError: (error: unknown) => void;
  timeoutMs?: number;
}) {
  let active = true;
  const waiting = new AbortController();
  let release!: () => void;
  const closed = new Promise<void>(resolve => { release = resolve; });
  const guard: RoomSessionGuard = {
    signal: waiting.signal,
    active: () => active,
    assertActive: () => { if (!active) throw new DOMException("경기 준비가 취소되었습니다.", "AbortError"); },
  };
  const close = () => { active = false; waiting.abort(); release(); };
  const fail = (error: unknown) => {
    if (!active) return;
    close();
    options.onError(error);
  };
  const own = async () => {
    if (!active) return;
    options.onPreparing();
    const timeout = setTimeout(() => fail(new Error("경기 준비 응답이 지연되고 있습니다. 저장된 기록은 유지됩니다. 연결을 확인한 뒤 다시 준비해주세요.")), options.timeoutMs ?? 30_000);
    try {
      const preparing = Promise.resolve().then(() => {
        guard.assertActive();
        return options.prepare(guard);
      }).catch(fail);
      // A cancelled HTTP/Auth/IDB promise may never settle. Release ownership
      // immediately; guards also reject any late initialization writes.
      await Promise.race([preparing, closed]);
      clearTimeout(timeout);
      if (active) await closed;
    } finally { clearTimeout(timeout); }
  };
  void options.locks.request(options.name, { ifAvailable: true }, async lock => {
    if (!active) return false;
    if (!lock) { options.onWaiting(); return true; }
    await own();
    return false;
  }).then(async shouldWait => {
    if ((await shouldWait) && active) return options.locks.request(options.name, { signal: waiting.signal }, own);
  }).catch(fail);
  return { close, active: guard.active };
}
