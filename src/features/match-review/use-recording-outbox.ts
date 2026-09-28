"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createRecordingOutbox } from "./outbox";
import type { RecordingInput } from "./types";

export function useRecordingOutbox(accountId: string | undefined, matchId: string, enabled: boolean) {
  const scope = useRef("");
  const queue = useRef<ReturnType<typeof createRecordingOutbox> | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [storageError, setStorageError] = useState("");
  const refresh = useCallback(() => {
    try { setPendingCount(queue.current?.list().length ?? 0); setStorageError(""); }
    catch { setStorageError("기기에 보관된 기록을 읽지 못했습니다. 데이터를 지우지 말고 확인해주세요."); }
  }, []);
  useEffect(() => {
    queue.current = null; scope.current="";
    if (!enabled || !accountId) return;
    try { queue.current = createRecordingOutbox(window.localStorage, accountId, matchId); scope.current=accountId+":"+matchId; refresh(); }
    catch { setStorageError("이 브라우저에 기록을 보관할 수 없습니다. 저장 설정을 확인해주세요."); }
    window.addEventListener("storage", refresh);
    return () => { queue.current=null; window.removeEventListener("storage", refresh); };
  }, [accountId, matchId, enabled, refresh]);

  const save = async (input: RecordingInput, send: (input: RecordingInput)=>Promise<void>) => {
    if (!enabled) return send(input);
    const q=queue.current;
    if (!q || scope.current !== accountId+":"+matchId || storageError) throw new Error(storageError || "기록 보관을 준비하고 있습니다. 로그인 상태를 확인해주세요.");
    const entry=q.stage(input); refresh();
    try { await q.send(entry,send); } finally { refresh(); }
  };
  const retry = async (send: (input: RecordingInput)=>Promise<void>) => {
    const q=queue.current;
    if (!q || scope.current !== accountId+":"+matchId || storageError) throw new Error(storageError || "보관된 기록을 불러오지 못했습니다.");
    try { for (const entry of q.list()) await q.send(entry,send); } finally { refresh(); }
  };
  const assertClear = () => {
    if(enabled && (!queue.current || scope.current !== accountId+":"+matchId || storageError || queue.current.list().length)) {
      throw new Error("이 기기의 미확정 입력을 먼저 재확인해주세요. 기기 기록은 유지됩니다.");
    }
  };
  return { save, retry, assertClear, pendingCount, storageError };
}
